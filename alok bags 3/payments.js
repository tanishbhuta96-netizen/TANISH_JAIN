/* ═══════════════════════════════════════════
   ALOK BAGS — Payments Management Script
   ═══════════════════════════════════════════ */

const API = 'api';
let allPayments = [];
let allParties = [];
let allInvoices = [];
let allPurchases = [];

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

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// === Initial Loads ===
async function init() {
  await loadParties();
  await loadAllDocs();
  loadPayments();
}

async function loadParties() {
  try {
    const res = await fetch(`${API}/parties.php`);
    if (res.ok) {
      allParties = await res.json();
      const filterSel = document.getElementById('filter-party');
      const entrySel = document.getElementById('entry-party');
      
      let opts = '<option value="">All Parties</option>';
      let entryOpts = '<option value="">-- Select Party --</option>';
      
      let toGet = 0;
      let toGive = 0;

      allParties.forEach(p => {
        opts += `<option value="${p.id}">${p.name} (${p.type})</option>`;
        entryOpts += `<option value="${p.id}" data-type="${p.type}">${p.name} (${p.type})</option>`;
        
        if (p.payment_status === 'to_get') toGet += p.balance;
        if (p.payment_status === 'to_give') toGive += p.balance;
      });
      
      filterSel.innerHTML = opts;
      entrySel.innerHTML = entryOpts;

      document.getElementById('stat-toget').textContent = formatINR(toGet);
      document.getElementById('stat-togive').textContent = formatINR(toGive);
    }
  } catch (err) { console.error("Could not load parties"); }
}

async function loadAllDocs() {
  try {
    const res1 = await fetch(`${API}/invoices.php`);
    if (res1.ok) allInvoices = await res1.json();
    
    const res2 = await fetch(`${API}/purchases.php`);
    if (res2.ok) allPurchases = await res2.json();
  } catch(e) { console.error(e); }
}

// === Load Payments ===
async function loadPayments() {
  try {
    const res = await fetch(`${API}/payments.php`);
    if (!res.ok) throw new Error("API Error");
    let data = await res.json();
    
    // Client-side filtering
    const type = document.getElementById('filter-type').value;
    const partyId = document.getElementById('filter-party').value;
    const from = document.getElementById('filter-from').value;
    const to = document.getElementById('filter-to').value;

    if (type !== 'all') {
      data = data.filter(p => p.type === type);
    }
    if (partyId) {
      data = data.filter(p => p.party_id == partyId);
    }
    if (from) {
      data = data.filter(p => p.txn_date >= from);
    }
    if (to) {
      data = data.filter(p => p.txn_date <= to);
    }

    allPayments = data;
    renderPaymentTable();
    updateStats();
  } catch (e) {
    showToast("Error loading payments: " + e.message);
  }
}

function clearFilters() {
  document.getElementById('filter-type').value = 'all';
  document.getElementById('filter-party').value = '';
  document.getElementById('filter-from').value = '';
  document.getElementById('filter-to').value = '';
  loadPayments();
}

function updateStats() {
  let received = 0;
  let paid = 0;

  allPayments.forEach(p => {
    if (p.type === 'Receipt') received += parseFloat(p.credit);
    if (p.type === 'Payment') paid += parseFloat(p.debit);
  });

  document.getElementById('stat-received').textContent = formatINR(received);
  document.getElementById('stat-paid').textContent = formatINR(paid);
}

function renderPaymentTable() {
  const tbody = document.getElementById('payment-tbody');
  tbody.innerHTML = '';
  
  if (allPayments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#888;">No payment records found</td></tr>`;
    return;
  }

  allPayments.forEach(i => {
    const isReceipt = i.type === 'Receipt';
    const amount = isReceipt ? i.credit : i.debit;
    const badgeClass = isReceipt ? 'status-paid' : 'status-partial';
    const typeLabel = isReceipt ? 'IN' : 'OUT';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(i.txn_date)}<br><small style="color:#888">${i.voucher}</small></td>
      <td><span class="inv-status ${badgeClass}" style="padding:2px 6px; font-size:10px;">${typeLabel}</span></td>
      <td style="font-weight:500;">${i.party_name}</td>
      <td style="text-transform:capitalize;">${i.payment_method || 'Cash'}</td>
      <td style="font-size:12px; color:#555;">${i.description || '--'}</td>
      <td class="col-amt ${isReceipt ? 'text-green' : 'text-red'}" style="font-weight:bold">${formatINR(amount)}</td>
      <td>
        <button class="btn-outline" onclick="viewReceipt(${i.id})">Receipt</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// === Modal Logic ===
function openPaymentEntryModal() {
  document.getElementById('modal-payment').classList.add('open');
  document.getElementById('overlay-payment').classList.add('open');
  
  // reset form
  document.getElementById('entry-type').value = 'Receipt';
  document.getElementById('entry-party').value = '';
  document.getElementById('entry-amount').value = '';
  document.getElementById('entry-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('entry-method').value = 'cash';
  document.getElementById('entry-reference').value = '';
  document.getElementById('entry-note').value = '';
  document.getElementById('link-doc-container').style.display = 'none';
}

function closePaymentEntryModal() {
  document.getElementById('modal-payment').classList.remove('open');
  document.getElementById('overlay-payment').classList.remove('open');
}

function onPaymentTypeChange() {
  onPartySelect();
}

function onPartySelect() {
  const type = document.getElementById('entry-type').value;
  const partySel = document.getElementById('entry-party');
  const partyId = partySel.value;
  
  const linkContainer = document.getElementById('link-doc-container');
  const linkDocSel = document.getElementById('entry-linked-doc');
  const linkLabel = document.getElementById('link-doc-label');
  
  linkDocSel.innerHTML = '<option value="">No Link (Advance / On Account)</option>';
  
  if (!partyId) {
    linkContainer.style.display = 'none';
    return;
  }

  // Find party type
  const opt = partySel.options[partySel.selectedIndex];
  const pType = opt.getAttribute('data-type');

  let count = 0;
  
  if (type === 'Receipt' && pType === 'customer') {
    // Show unpaid sales invoices
    linkLabel.textContent = 'Link to Sales Invoice (Optional)';
    const unpaid = allInvoices.filter(i => i.party_id == partyId && i.status !== 'paid');
    unpaid.forEach(inv => {
      const bal = inv.total - inv.paid;
      linkDocSel.innerHTML += `<option value="${inv.id}" data-bal="${bal}">#${inv.invoice_no} (Due: ${formatINR(bal)})</option>`;
      count++;
    });
  } else if (type === 'Payment' && pType === 'supplier') {
    // Show unpaid purchase bills
    linkLabel.textContent = 'Link to Purchase Bill (Optional)';
    const unpaid = allPurchases.filter(i => i.party_id == partyId && i.status !== 'paid');
    unpaid.forEach(pur => {
      const bal = pur.total - pur.paid;
      linkDocSel.innerHTML += `<option value="${pur.id}" data-bal="${bal}">#${pur.bill_no} (Due: ${formatINR(bal)})</option>`;
      count++;
    });
  }

  if (count > 0) {
    linkContainer.style.display = 'block';
    // attach event to auto-fill amount
    linkDocSel.onchange = () => {
      if (linkDocSel.value) {
        const selectedOpt = linkDocSel.options[linkDocSel.selectedIndex];
        document.getElementById('entry-amount').value = parseFloat(selectedOpt.getAttribute('data-bal')).toFixed(2);
      } else {
        document.getElementById('entry-amount').value = '';
      }
    };
  } else {
    linkContainer.style.display = 'none';
  }
}

async function savePaymentEntry() {
  const partyId = document.getElementById('entry-party').value;
  const type = document.getElementById('entry-type').value;
  const amount = parseFloat(document.getElementById('entry-amount').value);
  const date = document.getElementById('entry-date').value;
  const method = document.getElementById('entry-method').value;
  const ref = document.getElementById('entry-reference').value;
  const note = document.getElementById('entry-note').value;
  const linkedId = document.getElementById('entry-linked-doc').value;

  if (!partyId) return showToast("Select a party");
  if (!amount || amount <= 0) return showToast("Enter a valid amount");

  const payload = {
    party_id: parseInt(partyId),
    type: type,
    amount: amount,
    txn_date: date,
    payment_method: method,
    reference: ref,
    note: note,
    linked_id: linkedId ? parseInt(linkedId) : null
  };

  try {
    const res = await fetch(`${API}/payments.php`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    
    showToast("Payment recorded successfully!");
    closePaymentEntryModal();
    
    // Refresh all data to update stats
    await loadParties();
    await loadAllDocs();
    loadPayments();
  } catch (err) {
    showToast("Error recording payment: " + err.message);
  }
}

// === View / Print Receipt ===
function viewReceipt(txnId) {
  const p = allPayments.find(x => x.id == txnId);
  if (!p) return;

  document.getElementById('modal-receipt').classList.add('open');
  document.getElementById('overlay-receipt').classList.add('open');
  
  const isReceipt = p.type === 'Receipt';
  const amt = isReceipt ? p.credit : p.debit;
  const title = isReceipt ? 'PAYMENT RECEIPT' : 'PAYMENT VOUCHER';
  const subTitle = isReceipt ? 'Received With Thanks From:' : 'Paid To:';

  const html = `
    <div id="print-area" style="font-family: Arial, sans-serif; padding:10px;">
      <div style="text-align:center; border-bottom: 2px solid #333; padding-bottom:10px; margin-bottom:15px;">
        <h2 style="margin:0; font-size:24px; color:#1a73e8;">ALOK BAGS</h2>
        <p style="margin:5px 0 0 0; font-size:12px; color:#666;">Jaipur, Rajasthan</p>
        <h3 style="margin:15px 0 0 0; font-size:16px; background:#f0f0f0; display:inline-block; padding:5px 15px; border-radius:4px;">${title}</h3>
      </div>
      
      <table style="width:100%; margin-bottom:20px; font-size:14px;">
        <tr>
          <td style="padding:4px 0;"><strong>Receipt No:</strong> ${p.voucher}</td>
          <td style="padding:4px 0; text-align:right;"><strong>Date:</strong> ${formatDate(p.txn_date)}</td>
        </tr>
      </table>

      <div style="background:#f9f9f9; padding:15px; border:1px solid #eee; border-radius:6px; margin-bottom:20px;">
        <p style="margin:0 0 10px 0; font-size:12px; color:#888;">${subTitle}</p>
        <p style="margin:0; font-size:18px; font-weight:bold;">${p.party_name}</p>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <tr>
          <td style="padding:10px; border:1px solid #ddd; width:40%;"><strong>Amount:</strong></td>
          <td style="padding:10px; border:1px solid #ddd; font-size:20px; font-weight:bold; color:#1a73e8;">${formatINR(amt)}</td>
        </tr>
        <tr>
          <td style="padding:10px; border:1px solid #ddd;"><strong>Payment Mode:</strong></td>
          <td style="padding:10px; border:1px solid #ddd; text-transform:capitalize;">${p.payment_method || 'Cash'}</td>
        </tr>
        <tr>
          <td style="padding:10px; border:1px solid #ddd;"><strong>Details:</strong></td>
          <td style="padding:10px; border:1px solid #ddd;">${p.description || '--'}</td>
        </tr>
      </table>

      <div style="margin-top:40px; display:flex; justify-content:space-between; align-items:flex-end;">
        <div>
          <p style="margin:0; font-size:11px; color:#888;">This is a computer-generated receipt.</p>
        </div>
        <div style="text-align:center;">
          <div style="border-bottom:1px solid #333; width:150px; margin-bottom:5px;"></div>
          <span style="font-size:12px;">Authorized Signatory</span>
        </div>
      </div>
    </div>
  `;
  document.getElementById('receipt-body').innerHTML = html;
}

function closeReceiptModal() {
  document.getElementById('modal-receipt').classList.remove('open');
  document.getElementById('overlay-receipt').classList.remove('open');
}

function printReceipt() {
  const content = document.getElementById('print-area').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Receipt</title></head>
    <body onload="window.print();window.close()">${content}</body>
    </html>
  `);
  win.document.close();
}

// Bootstrap
init();
