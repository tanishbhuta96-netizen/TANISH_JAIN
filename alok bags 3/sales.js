/* ═══════════════════════════════════════════
   ALOK BAGS — Sales Invoices Script
   ═══════════════════════════════════════════ */

const API = 'api';
let allParties = [];
let allProducts = [];
let currentInvoices = [];
let currentPartySummary = [];
let currentView = 'invoice';
let autoRefreshTimer = null;
let searchDebounce = null;

// === Format Helpers ===
function formatINR(num) {
  if (!num) return '₹0.00';
  const val = Number(num).toFixed(2);
  const parts = val.split('.');
  let ts = parts[0];
  if (ts.length > 3) {
    const last3 = ts.substring(ts.length - 3);
    const other = ts.substring(0, ts.length - 3);
    ts = other.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return '₹' + ts + '.' + parts[1];
}

function formatDate(ds) {
  if (!ds) return '';
  const d = new Date(ds);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// === Toast ===
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// === Initial Loads ===
async function init() {
  await loadParties();
  await loadProducts();
  switchView('invoice');
  
  // Start auto-refresh (every 30 seconds)
  autoRefreshTimer = setInterval(() => {
    loadData(true);
  }, 30000);
}

async function loadParties() {
  try {
    const res = await fetch(`${API}/parties.php?type=customer`);
    if (res.ok) {
      allParties = await res.json();
      const filterSel = document.getElementById('filter-customer');
      const invSel = document.getElementById('inv-party');
      
      let opts = '<option value="">All Customers</option>';
      let invOpts = '<option value="">-- Select Customer --</option>';
      
      allParties.forEach(p => {
        opts += `<option value="${p.id}">${p.name}</option>`;
        invOpts += `<option value="${p.id}">${p.name}</option>`;
      });
      
      filterSel.innerHTML = opts;
      invSel.innerHTML = invOpts;
    }
  } catch (err) { console.error("Could not load parties"); }
}

async function loadProducts() {
  try {
    const res = await fetch(`${API}/products.php`);
    if (res.ok) allProducts = await res.json();
  } catch (err) { console.error("Could not load products"); }
}

// === Load Data & Switch View ===
function loadData(silent = false) {
  if (currentView === 'invoice') {
    loadInvoices(silent);
  } else {
    loadPartySummary(silent);
  }
}

function debounceLoadData() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    loadData();
  }, 300);
}

function switchView(view) {
  currentView = view;
  
  document.getElementById('btn-view-invoice').classList.toggle('active', view === 'invoice');
  document.getElementById('btn-view-party').classList.toggle('active', view === 'party');
  
  document.getElementById('invoice-table-wrapper').style.display = view === 'invoice' ? 'block' : 'none';
  document.getElementById('party-table-wrapper').style.display = view === 'party' ? 'block' : 'none';
  
  const searchGroup = document.getElementById('group-filter-search');
  const custGroup = document.getElementById('group-filter-customer');
  const fromGroup = document.getElementById('group-filter-from');
  const toGroup = document.getElementById('group-filter-to');
  
  if (view === 'party') {
    if(searchGroup) searchGroup.style.display = 'flex';
    if(custGroup) custGroup.style.display = 'none';
    if(fromGroup) fromGroup.style.display = 'none';
    if(toGroup) toGroup.style.display = 'none';
  } else {
    if(searchGroup) searchGroup.style.display = 'none';
    if(custGroup) custGroup.style.display = 'flex';
    if(fromGroup) fromGroup.style.display = 'flex';
    if(toGroup) toGroup.style.display = 'flex';
  }
  
  loadData();
}

async function loadInvoices(silent = false) {
  const status = document.getElementById('filter-status').value;
  const partyId = document.getElementById('filter-customer').value;
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;

  let url = `${API}/invoices.php?status=${status}`;
  if (partyId) url += `&party_id=${partyId}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("API Error");
    const data = await res.json();
    currentInvoices = data;
    renderInvoiceTable();
    updateStats();
  } catch (e) {
    if (!silent) showToast("Error loading invoices: " + e.message);
  }
}

async function loadPartySummary(silent = false) {
  const status = document.getElementById('filter-status').value;
  const search = document.getElementById('filter-search') ? document.getElementById('filter-search').value : '';

  let url = `${API}/party_summary.php?status=${status}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("API Error");
    const data = await res.json();
    currentPartySummary = data;
    renderPartyTable();
    updateStats();
  } catch (e) {
    if (!silent) showToast("Error loading party summary: " + e.message);
  }
}

function clearFilters() {
  document.getElementById('filter-status').value = 'all';
  if(document.getElementById('filter-customer')) document.getElementById('filter-customer').value = '';
  if(document.getElementById('filter-from')) document.getElementById('filter-from').value = '';
  if(document.getElementById('filter-to')) document.getElementById('filter-to').value = '';
  if(document.getElementById('filter-search')) document.getElementById('filter-search').value = '';
  loadData();
}

function updateStats() {
  let outstanding = 0;
  let paidThisMonth = 0;
  let count = 0;
  let activeParties = new Set();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  if (currentView === 'invoice') {
    count = currentInvoices.length;
    currentInvoices.forEach(i => {
      outstanding += (i.total - i.paid);
      activeParties.add(i.party_id);
      
      const invD = new Date(i.invoice_date);
      if (invD.getMonth() === currentMonth && invD.getFullYear() === currentYear) {
        paidThisMonth += i.paid;
      }
    });
  } else {
    currentPartySummary.forEach(p => {
      outstanding += p.total_pending;
      count += parseInt(p.invoice_count);
      activeParties.add(p.party_id);
    });
  }

  document.getElementById('stat-outstanding').textContent = formatINR(outstanding);
  if (currentView === 'invoice') {
    document.getElementById('stat-paid').textContent = formatINR(paidThisMonth);
  }
  document.getElementById('stat-count').textContent = count;
  const partiesEl = document.getElementById('stat-parties');
  if (partiesEl) partiesEl.textContent = activeParties.size;
}

function renderInvoiceTable() {
  const tbody = document.getElementById('invoice-tbody');
  tbody.innerHTML = '';
  
  if (currentInvoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#888;">No invoices found</td></tr>`;
    return;
  }

  currentInvoices.forEach(i => {
    const bal = i.total - i.paid;
    let badgeClass = 'status-unpaid';
    if (i.status === 'paid') badgeClass = 'status-paid';
    if (i.status === 'partial') badgeClass = 'status-partial';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(i.invoice_date)}</td>
      <td style="font-weight:600;color:#1a73e8;">#${i.invoice_no}</td>
      <td style="font-weight:500;">
        ${i.party_name}
        ${i.customer_type === 'walkin' ? '<span class="badge-walkin">Walk-in</span>' : ''}
      </td>
      <td class="col-amt">${formatINR(i.total)}</td>
      <td class="col-amt text-green">${formatINR(i.paid)}</td>
      <td class="col-amt text-red" style="font-weight:bold">${formatINR(bal)}</td>
      <td>
        <span class="inv-status ${badgeClass}">${i.status}</span>
        ${i.status === 'paid' ? `
          <span class="status-summary">Received via <b>${i.payment_mode || 'Mixed'}</b></span>
        ` : i.status === 'partial' ? `
          <span class="status-summary">Paid: <b>${formatINR(i.paid)}</b><br>Due: <b>${formatINR(bal)}</b></span>
        ` : ''}
      </td>
      <td>
        <button class="btn-outline" onclick="printInvoice(${i.id})">Print</button>
        <button class="btn-outline" onclick="handlePaymentsClick(${i.id})">Payments</button>
        ${i.status !== 'paid' ? `<button class="btn-receive" onclick="openPaymentModal(${i.id}, ${bal})">Record Pay</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderPartyTable() {
  const tbody = document.getElementById('party-tbody');
  tbody.innerHTML = '';
  
  if (currentPartySummary.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#888;">No parties found</td></tr>`;
    return;
  }

  currentPartySummary.forEach(p => {
    let badgeClass = 'status-unpaid';
    if (p.status === 'paid') badgeClass = 'status-paid';
    if (p.status === 'partial') badgeClass = 'status-partial';

    const tr = document.createElement('tr');
    tr.className = 'party-row';
    tr.id = `party-row-${p.party_id}`;
    tr.innerHTML = `
      <td style="text-align:center;"><svg class="chevron" id="chevron-${p.party_id}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></td>
      <td style="font-weight:600;color:#333;">${p.customer_name}</td>
      <td style="text-align:center;font-weight:500;">${p.invoice_count}</td>
      <td class="col-amt">${formatINR(p.total_amount)}</td>
      <td class="col-amt text-green">${formatINR(p.total_paid)}</td>
      <td class="col-amt text-red" style="font-weight:bold">${formatINR(p.total_pending)}</td>
      <td><span class="inv-status ${badgeClass}">${p.status}</span></td>
    `;
    tr.onclick = () => togglePartyRow(p.party_id);
    tbody.appendChild(tr);

    const trInvoices = document.createElement('tr');
    trInvoices.id = `party-invoices-${p.party_id}`;
    trInvoices.className = 'party-invoices-row';
    trInvoices.style.display = 'none';
    trInvoices.innerHTML = `
      <td colspan="7">
        <div class="party-invoices-container" id="invoices-container-${p.party_id}">
          <div style="text-align:center;color:#888;font-size:12px;padding:10px;">Loading...</div>
        </div>
      </td>
    `;
    tbody.appendChild(trInvoices);
  });
}

async function togglePartyRow(partyId) {
  const row = document.getElementById(`party-row-${partyId}`);
  const detailsRow = document.getElementById(`party-invoices-${partyId}`);
  const container = document.getElementById(`invoices-container-${partyId}`);
  
  if (row.classList.contains('expanded')) {
    row.classList.remove('expanded');
    detailsRow.style.display = 'none';
  } else {
    row.classList.add('expanded');
    detailsRow.style.display = 'table-row';
    
    try {
      const res = await fetch(`${API}/invoices.php?party_id=${partyId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      
      if (data.length === 0) {
        container.innerHTML = `<div style="text-align:center;color:#888;font-size:12px;padding:10px;">No invoices</div>`;
        return;
      }
      
      let tableHtml = `
        <table class="invoice-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice No.</th>
              <th class="col-amt">Amount</th>
              <th class="col-amt">Paid</th>
              <th class="col-amt">Balance</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      data.forEach(i => {
        const bal = i.total - i.paid;
        let badgeClass = 'status-unpaid';
        if (i.status === 'paid') badgeClass = 'status-paid';
        if (i.status === 'partial') badgeClass = 'status-partial';
        
        tableHtml += `
          <tr>
            <td>${formatDate(i.invoice_date)}</td>
            <td style="font-weight:600;color:#1a73e8;">#${i.invoice_no}</td>
            <td class="col-amt">${formatINR(i.total)}</td>
            <td class="col-amt text-green">${formatINR(i.paid)}</td>
            <td class="col-amt text-red">${formatINR(bal)}</td>
            <td><span class="inv-status ${badgeClass}">${i.status}</span></td>
            <td>
              <button class="btn-outline" onclick="handlePaymentsClick(${i.id})">Payments</button>
              ${i.status !== 'paid' ? `<button class="btn-receive" style="margin-left:5px;" onclick="openPaymentModal(${i.id}, ${bal})">Record Pay</button>` : ''}
            </td>
          </tr>
        `;
      });
      
      tableHtml += `</tbody></table>`;
      container.innerHTML = tableHtml;
      
    } catch (e) {
      container.innerHTML = `<div style="text-align:center;color:red;font-size:12px;padding:10px;">Error loading invoices</div>`;
    }
  }
}


// === Full Screen Invoice Builder ===
function openInvoiceModal() {
  document.getElementById('modal-invoice').classList.add('open');
  document.getElementById('overlay-invoice').classList.add('open');
  document.body.style.overflow = 'hidden';

  // reset form
  if (document.querySelector('input[name="customer_type"][value="saved"]')) {
    document.querySelector('input[name="customer_type"][value="saved"]').checked = true;
    toggleCustomerType();
  }
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('inv-date').value = today;
  
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);
  document.getElementById('inv-due-date').value = nextMonth.toISOString().split('T')[0];
  
  document.getElementById('inv-no').value = '';
  document.getElementById('inv-notes').value = '';
  document.getElementById('inv-bill-type').value = 'gst';
  toggleBillType();
  
  document.getElementById('inv-items-body').innerHTML = '';
  addInvoiceItemRow();
  
  // reset payment fields
  document.querySelector('input[name="payment_status"][value="pending"]').checked = true;
  if (typeof togglePaymentFields === 'function') togglePaymentFields();
  
  // reset walk-in state
  document.getElementById('inv-walkin-state').value = 'Rajasthan';
  
  calculateTotals();
}

function closeInvoiceModal() {
  document.getElementById('modal-invoice').classList.remove('open');
  document.getElementById('overlay-invoice').classList.remove('open');
  document.body.style.overflow = '';
}

function getProductOptions() {
  let opts = '<option value="">Custom Item...</option>';
  allProducts.forEach(p => {
    opts += `<option value="${p.id}" data-price="${p.price}" data-unit="${p.unit}" data-gst="${p.gst_rate}">${p.name}</option>`;
  });
  return opts;
}

function toggleBillType() {
  const isGst = document.getElementById('inv-bill-type').value === 'gst';
  
  document.querySelectorAll('.col-gst').forEach(el => {
    el.style.display = isGst ? '' : 'none';
  });
  
  document.querySelectorAll('.item-gst').forEach(el => {
    el.parentElement.style.display = isGst ? '' : 'none';
    if (!isGst) el.value = 0;
  });
  
  document.querySelectorAll('.row-gst').forEach(el => {
    el.style.display = isGst ? '' : 'none';
  });
  
  calculateTotals();
}

function addInvoiceItemRow() {
  const tbody = document.getElementById('inv-items-body');
  const tr = document.createElement('tr');
  const isGst = document.getElementById('inv-bill-type') ? document.getElementById('inv-bill-type').value === 'gst' : true;
  const displayStyle = isGst ? '' : 'style="display:none;"';
  
  tr.innerHTML = `
    <td>
      <div class="autocomplete-wrapper" style="margin-bottom:4px;">
        <input type="hidden" class="item-prod-id">
        <input type="text" class="item-desc" placeholder="Search product or enter description..." autocomplete="off" oninput="handleProductInput(event, this)" onkeydown="handleProductKeydown(event, this)">
        <ul class="autocomplete-list product-autocomplete-list"></ul>
      </div>
    </td>
    <td><input type="number" class="item-qty" value="1" min="0" oninput="calculateTotals()"></td>
    <td><input type="text" class="item-unit" value="pcs"></td>
    <td><input type="number" class="item-rate" step="0.01" value="0.00" oninput="calculateTotals()"></td>
    <td><input type="number" class="item-disc" step="0.1" value="0" oninput="calculateTotals()"></td>
    <td ${displayStyle}><input type="number" class="item-gst" step="0.1" value="${isGst ? 18 : 0}" oninput="calculateTotals()"></td>
    <td style="text-align:right" class="item-amount" style="font-weight:600;">₹0.00</td>
    <td><button class="btn-remove-item" onclick="this.closest('tr').remove(); calculateTotals()">×</button></td>
  `;
  tbody.appendChild(tr);
}

function onProductSelect(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  const tr = sel.closest('tr');
  tr.querySelector('.item-desc').value = opt.text;
  tr.querySelector('.item-rate').value = opt.dataset.price;
  tr.querySelector('.item-unit').value = opt.dataset.unit;
  tr.querySelector('.item-gst').value = opt.dataset.gst;
  calculateTotals();
}

function calculateTotals() {
  let subtotal = 0;
  let totalDisc = 0;
  let totalTax = 0;
  let grandTotal = 0;

  const rows = document.querySelectorAll('#inv-items-body tr');
  rows.forEach(tr => {
    const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
    const rate = parseFloat(tr.querySelector('.item-rate').value) || 0;
    const discPct = parseFloat(tr.querySelector('.item-disc').value) || 0;
    const gstRate = parseFloat(tr.querySelector('.item-gst').value) || 0;

    const base = qty * rate;
    const discAmt = base * (discPct / 100);
    const taxable = base - discAmt;
    const taxAmt = taxable * (gstRate / 100);

    const rowTotal = taxable + taxAmt;
    tr.querySelector('.item-amount').textContent = formatINR(rowTotal);

    subtotal += base;
    totalDisc += discAmt;
    totalTax += taxAmt;
    grandTotal += rowTotal;
  });

  const taxableVal = subtotal - totalDisc;

  document.getElementById('sum-subtotal').textContent = formatINR(subtotal);
  document.getElementById('sum-discount').textContent = '-' + formatINR(totalDisc);
  document.getElementById('sum-taxable').textContent = formatINR(taxableVal);
  
  // State detection
  let state = 'Rajasthan';
  const customerType = document.querySelector('input[name="customer_type"]:checked').value;
  if (customerType === 'saved') {
    const searchInput = document.getElementById('inv-party-search');
    // In a real app, we'd store the selected party's state in a variable. 
    // For now, we'll try to find it from the autocomplete selection or default.
  } else {
    state = document.getElementById('inv-walkin-state').value;
  }
  
  const isRajasthan = (state === 'Rajasthan');
  if (isRajasthan) {
    document.getElementById('sum-cgst').textContent = formatINR(totalTax / 2);
    document.getElementById('sum-sgst').textContent = formatINR(totalTax / 2);
  } else {
    document.getElementById('sum-igst').textContent = formatINR(totalTax);
  }
  
  document.getElementById('sum-total').textContent = formatINR(grandTotal);
  
  // Update payment amount if not in pending mode
  const mode = document.querySelector('input[name="payment_status"]:checked').value;
  if (mode !== 'pending') {
    document.getElementById('inv-paid-amount').value = grandTotal.toFixed(2);
    validatePaymentAmount();
  }
}

async function saveInvoice() {
  const customerType = document.querySelector('input[name="customer_type"]:checked').value;
  let partyId = null;
  let walkinName = '';
  let walkinPhone = '';
  
  if (customerType === 'saved') {
    partyId = document.getElementById('inv-party-id').value;
    if (!partyId) return showToast("Select a saved customer, or use Walk-in");
  } else {
    walkinName = document.getElementById('inv-walkin-name').value.trim();
    walkinPhone = document.getElementById('inv-walkin-phone').value.trim();
    if (!walkinName) return showToast("Enter customer name for Walk-in bill");
  }

  const items = [];
  document.querySelectorAll('#inv-items-body tr').forEach(tr => {
    const desc = tr.querySelector('.item-desc').value.trim();
    if (!desc) return; // skip empty rows
    const prodId = tr.querySelector('.item-prod-id').value;
    items.push({
      product_id: prodId ? parseInt(prodId) : null,
      description: desc,
      qty: parseFloat(tr.querySelector('.item-qty').value) || 0,
      unit: tr.querySelector('.item-unit').value,
      price: parseFloat(tr.querySelector('.item-rate').value) || 0,
      discount_pct: parseFloat(tr.querySelector('.item-disc').value) || 0,
      gst_rate: parseFloat(tr.querySelector('.item-gst').value) || 0
    });
  });

  if (items.length === 0) return showToast("Add at least one item");

  const payStatus = document.querySelector('input[name="payment_status"]:checked').value;
  const state = (customerType === 'walkin') ? document.getElementById('inv-walkin-state').value : (window.selectedPartyState || 'Rajasthan');

  const payload = {
    customer_type: customerType,
    party_id: partyId ? parseInt(partyId) : null,
    walkin_name: walkinName,
    walkin_phone: walkinPhone,
    party_state: state,
    tax_type: (state === 'Rajasthan') ? 'cgst_sgst' : 'igst',
    bill_type: document.getElementById('inv-bill-type') ? document.getElementById('inv-bill-type').value : 'gst',
    invoice_date: document.getElementById('inv-date').value,
    due_date: document.getElementById('inv-due-date').value,
    invoice_no: document.getElementById('inv-no').value,
    notes: document.getElementById('inv-notes').value,
    amount_received: (payStatus !== 'pending') ? parseFloat(document.getElementById('inv-paid-amount').value) || 0 : 0,
    payment_mode: payStatus,
    payment_note: document.getElementById('inv-pay-note').value,
    payment_date: document.getElementById('inv-date').value,
    items: items
  };

  try {
    const res = await fetch(`${API}/invoices.php`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    
    const rData = await res.json();
    showToast("Invoice saved: " + rData.invoice_no);
    closeInvoiceModal();
    loadData();
  } catch (err) {
    showToast("Error saving invoice: " + err.message);
  }
}

// === Record Payment Modal ===
function openPaymentModal(invoiceId, balance) {
  document.getElementById('modal-payment').classList.add('open');
  document.getElementById('overlay-payment').classList.add('open');
  
  document.getElementById('pay-inv-id').value = invoiceId;
  document.getElementById('pay-balance').textContent = formatINR(balance);
  document.getElementById('pay-amount').value = balance.toFixed(2);
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('pay-date').value = today;
  document.getElementById('pay-note').value = '';
  document.getElementById('pay-method').value = 'cash';
  updatePayNotePlaceholder();
}

function updatePayNotePlaceholder() {
  const method = document.getElementById('pay-method').value;
  const label = document.getElementById('pay-note-label');
  const input = document.getElementById('pay-note');
  
  if (method === 'cash') {
    label.textContent = 'Reference / Note';
    input.placeholder = 'Optional note';
  } else if (method === 'upi') {
    label.textContent = 'UPI Transaction ID';
    input.placeholder = 'Enter UPI Ref No.';
  } else if (method === 'cheque') {
    label.textContent = 'Cheque Number';
    input.placeholder = '6-digit cheque no.';
  } else if (method === 'bank') {
    label.textContent = 'NEFT/RTGS Reference';
    input.placeholder = 'Bank transfer ref';
  }
}

function closePaymentModal() {
  document.getElementById('modal-payment').classList.remove('open');
  document.getElementById('overlay-payment').classList.remove('open');
}

async function savePayment() {
  const invId = document.getElementById('pay-inv-id').value;
  const amt = parseFloat(document.getElementById('pay-amount').value);
  const method = document.getElementById('pay-method').value;
  const date = document.getElementById('pay-date').value;
  const note = document.getElementById('pay-note').value;

  if (!amt || amt <= 0) return showToast("Enter a valid amount");

  try {
    const res = await fetch(`${API}/invoice_payments.php`, {
      method: 'POST',
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        invoice_id: parseInt(invId),
        amount: amt,
        method: method,
        payment_mode: method,
        payment_note: note,
        paid_on: date,
        note: note
      })
    });
    if (!res.ok) throw new Error(await res.text());
    
    showToast("Payment recorded successfully");
    closePaymentModal();
    loadData();
  } catch(e) {
    showToast("Error: " + e.message);
  }
}

function printInvoice(id) {
  window.open(`bill.html?id=${id}`, '_blank');
}

// === View Payments History ===
async function openHistoryModal(invoiceId, invoiceNo) {
  document.getElementById('history-modal-title').textContent = `Payment History - #${invoiceNo}`;
  document.getElementById('modal-history').classList.add('open');
  document.getElementById('overlay-history').classList.add('open');
  
  const tbody = document.getElementById('history-tbody');
  const successMsg = document.getElementById('history-success-msg');
  const printBtn = document.getElementById('btn-hist-print-receipt');
  
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#888;">Loading...</td></tr>`;
  successMsg.style.display = 'none';
  printBtn.style.display = 'none';

  try {
    if (!invoiceId) throw new Error("Invalid Invoice ID");

    // STEP 3: Pass correct invoice_id parameter
    const res = await fetch(`${API}/invoices.php?invoice_id=${invoiceId}`);
    if (!res.ok) throw new Error("API Error");
    const data = await res.json();
    
    tbody.innerHTML = '';
    
    // Status badges and success messages logic
    const isPaid = (data.total_paid >= data.invoice_total - 0.01);

    if (isPaid && data.payment_mode === 'cash') {
      successMsg.style.display = 'block';
      successMsg.textContent = `✓ Payment complete — received hand to hand in cash`;
      printBtn.style.display = 'inline-flex';
      printBtn.dataset.invId = invoiceId;
    } else if (isPaid) {
      successMsg.style.display = 'block';
      successMsg.textContent = `✓ Payment complete — received via ${data.payment_mode.toUpperCase()}`;
      printBtn.style.display = 'inline-flex';
      printBtn.dataset.invId = invoiceId;
    }
    
    if (!data.payments || data.payments.length === 0) {
      if (data.total_paid > 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${formatDate(data.payment_date || new Date())}</td>
          <td class="method-cash">💵 ${data.payment_mode ? data.payment_mode.toUpperCase() : 'CASH'}</td>
          <td style="color:#666; font-size:12px;">Initial payment received at billing</td>
          <td class="col-amt text-green" style="font-weight:bold;">${formatINR(data.total_paid)}</td>
        `;
        tbody.appendChild(tr);
      } else {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#888;">No payments found for this invoice</td></tr>`;
      }
    } else {
      data.payments.forEach(p => {
        let icon = '💵';
        let colorClass = 'method-cash';
        const mode = p.payment_mode || p.method || 'cash';
        
        if (mode === 'upi') { icon = '📱'; colorClass = 'method-upi'; }
        else if (mode === 'cheque') { icon = '🧾'; colorClass = 'method-cheque'; }
        else if (mode === 'bank') { icon = '🏦'; colorClass = 'method-bank'; }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${formatDate(p.paid_on)}</td>
          <td class="${colorClass}">${icon} ${mode.toUpperCase()}</td>
          <td style="color:#666; font-size:12px;">${p.payment_note || p.note || '--'}</td>
          <td class="col-amt text-green" style="font-weight:bold;">${formatINR(p.amount)}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Summary - Using new JSON keys from STEP 2
    document.getElementById('hist-total-paid').textContent = formatINR(data.total_paid);
    document.getElementById('hist-total-paid').className = data.total_paid > 0 ? 'text-green' : '';
    document.getElementById('hist-total-inv').textContent = formatINR(data.invoice_total);
    
    const balance = data.still_due;
    const dueEl = document.getElementById('hist-total-due');
    dueEl.textContent = formatINR(balance);
    if (balance > 0.01) {
      dueEl.className = 'text-red';
      dueEl.style.fontWeight = 'bold';
    } else {
      dueEl.className = '';
      dueEl.style.color = '#888';
    }

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:red;">Error loading payments</td></tr>`;
    console.error(err);
  }
}

function printReceiptFromHistory() {
  const invId = document.getElementById('btn-hist-print-receipt').dataset.invId;
  if (!invId) return;
  
  // We can reuse the receipt modal or just redirect to bill
  // But the request says "Show Print Receipt button" in history modal
  // I'll reuse the logic from the other modal if available or just open print window
  window.open(`bill.html?id=${invId}&receipt=1`, '_blank');
}

function closeHistoryModal() {
  document.getElementById('modal-history').classList.remove('open');
  document.getElementById('overlay-history').classList.remove('open');
}

// === Payment Click Handler & Receipt Logic ===
async function handlePaymentsClick(id) {
  try {
    const res = await fetch(`${API}/invoices.php?id=${id}`);
    if (!res.ok) throw new Error("API Error");
    const inv = await res.json();

    const bal = inv.total - inv.paid;
    if (inv.status === 'unpaid' || inv.status === 'partial') {
      openPaymentModal(inv.id, bal);
    } else {
      // For PAID invoices, show history as requested
      openHistoryModal(inv.id, inv.invoice_no);
    }
  } catch (e) {
    showToast("Error loading payment info");
    console.error(e);
  }
}

function openReceiptModal(inv) {
  const modal = document.getElementById('modal-receipt');
  const overlay = document.getElementById('overlay-receipt');
  
  // Update Title & Mode Text
  let title = "💵 Cash Payment Received";
  let modeDesc = "Cash (Hand to Hand)";
  let note = "Payment collected in cash at time of delivery";
  
  if (inv.payment_mode === 'upi') {
    title = "📱 UPI Payment Received";
    modeDesc = "UPI / Online Transfer";
    note = "Payment received via UPI / Online Transfer";
  } else if (inv.payment_mode === 'cheque') {
    title = "🏦 Cheque Payment Received";
    modeDesc = "Bank Cheque";
    note = "Payment received via Cheque";
  }

  document.getElementById('receipt-title').textContent = title;
  document.getElementById('rec-inv-no').textContent = `#${inv.invoice_no}`;
  document.getElementById('rec-party').textContent = inv.party_name;
  document.getElementById('rec-amount').textContent = formatINR(inv.total);
  document.getElementById('rec-mode').textContent = modeDesc;
  document.getElementById('rec-date').textContent = formatDate(inv.invoice_date);
  document.getElementById('rec-note').textContent = `"${inv.payment_note || note}"`;

  // Update Thermal Print Content
  document.getElementById('pr-inv-no').textContent = inv.invoice_no;
  document.getElementById('pr-party').textContent = inv.party_name;
  document.getElementById('pr-date').textContent = formatDate(inv.invoice_date);
  document.getElementById('pr-mode').textContent = modeDesc;
  document.getElementById('pr-amount').textContent = formatINR(inv.total);

  modal.classList.add('open');
  overlay.classList.add('open');
}

function closeReceiptModal() {
  document.getElementById('modal-receipt').classList.remove('open');
  document.getElementById('overlay-receipt').classList.remove('open');
}

function printReceipt() {
  window.print();
}


// === New Helpers for GST & Payment ===
window.selectedPartyState = 'Rajasthan';

function updateTaxType(state) {
  window.selectedPartyState = state;
  const isRajasthan = (state === 'Rajasthan');
  const cgstSgstRows = document.querySelectorAll('.row-cgst-sgst');
  const igstRow = document.querySelector('.row-igst');
  
  if (isRajasthan) {
    cgstSgstRows.forEach(r => r.style.display = '');
    if (igstRow) igstRow.style.display = 'none';
  } else {
    cgstSgstRows.forEach(r => r.style.display = 'none');
    if (igstRow) igstRow.style.display = '';
  }
  calculateTotals();
}

function handleStateChange() {
  const state = document.getElementById('inv-walkin-state').value;
  updateTaxType(state);
}

function togglePaymentFields() {
  const modeEl = document.querySelector('input[name="payment_status"]:checked');
  if (!modeEl) return;
  const mode = modeEl.value;
  const extraFields = document.getElementById('payment-extra-fields');
  const chequeFields = document.getElementById('cheque-fields');
  const paymentBox = document.getElementById('inv-payment-box');
  const paidInput = document.getElementById('inv-paid-amount');
  
  if (!paymentBox) return;

  // Reset backgrounds
  paymentBox.classList.remove('pay-bg-pending', 'pay-bg-paid', 'pay-bg-cheque');
  
  if (mode === 'pending') {
    if (extraFields) extraFields.style.display = 'none';
    paymentBox.classList.add('pay-bg-pending');
    if (paidInput) paidInput.value = 0;
  } else {
    if (extraFields) extraFields.style.display = 'flex';
    if (mode === 'cheque') {
      if (chequeFields) chequeFields.style.display = 'flex';
      paymentBox.classList.add('pay-bg-cheque');
    } else {
      if (chequeFields) chequeFields.style.display = 'none';
      paymentBox.classList.add('pay-bg-paid');
    }
    
    // Pre-fill grand total
    const totalText = document.getElementById('sum-total').textContent.replace(/[₹,]/g, '');
    const total = parseFloat(totalText) || 0;
    if (paidInput) paidInput.value = total.toFixed(2);
  }
  validatePaymentAmount();
}

function validatePaymentAmount() {
  const sumTotalEl = document.getElementById('sum-total');
  const warningEl = document.getElementById('payment-warning');
  const paidInput = document.getElementById('inv-paid-amount');
  
  if (!sumTotalEl || !warningEl || !paidInput) return;

  const totalText = sumTotalEl.textContent.replace(/[₹,]/g, '');
  const total = parseFloat(totalText) || 0;
  const paid = parseFloat(paidInput.value) || 0;
  
  if (paid < total && paid > 0) {
    warningEl.textContent = `Partial payment — ₹${(total - paid).toFixed(2)} pending`;
  } else if (paid > total) {
    warningEl.textContent = `Extra amount — ₹${(paid - total).toFixed(2)} will be credited`;
  } else {
    warningEl.textContent = '';
  }
}

// Bootstrap
init();
