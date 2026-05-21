/* ═══════════════════════════════════════════
   ALOK BAGS — Purchase Bills Script
   ═══════════════════════════════════════════ */

const API = 'api';
let allParties = [];
let allProducts = [];
let currentPurchases = [];
let ocrRawData = null;
let aiParsedData = null;

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
  loadPurchases();
}

async function loadParties() {
  try {
    const res = await fetch(`${API}/parties.php?type=supplier`);
    if (res.ok) {
      allParties = await res.json();
      const filterSel = document.getElementById('filter-vendor');
      const invSel = document.getElementById('inv-party');
      
      let opts = '<option value="">All Vendors</option>';
      let invOpts = '<option value="">-- Select Vendor --</option>';
      
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

// === Load Purchases ===
async function loadPurchases() {
  // We can filter on the client side since our backend GET /purchases.php currently returns all.
  // Wait, backend /purchases.php doesn't take status/party_id/from/to query params yet!
  // I will filter them in Javascript for now to keep it fast and simple.
  
  try {
    const res = await fetch(`${API}/purchases.php`);
    if (!res.ok) throw new Error("API Error");
    let data = await res.json();
    
    // Client-side filtering
    const status = document.getElementById('filter-status').value;
    const vendorId = document.getElementById('filter-vendor').value;
    const from = document.getElementById('filter-from').value;
    const to = document.getElementById('filter-to').value;

    if (status !== 'all') {
      data = data.filter(p => p.status === status);
    }
    if (vendorId) {
      data = data.filter(p => p.party_id == vendorId);
    }
    if (from) {
      data = data.filter(p => p.purchase_date >= from);
    }
    if (to) {
      data = data.filter(p => p.purchase_date <= to);
    }

    currentPurchases = data;
    renderPurchaseTable();
    updateStats();
  } catch (e) {
    showToast("Error loading purchases: " + e.message);
  }
}

function clearFilters() {
  document.getElementById('filter-status').value = 'all';
  document.getElementById('filter-vendor').value = '';
  document.getElementById('filter-from').value = '';
  document.getElementById('filter-to').value = '';
  loadPurchases();
}

function updateStats() {
  let outstanding = 0;
  let paidThisMonth = 0;
  let count = currentPurchases.length;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  currentPurchases.forEach(i => {
    outstanding += (i.total - i.paid);
    
    const invD = new Date(i.purchase_date);
    if (invD.getMonth() === currentMonth && invD.getFullYear() === currentYear) {
      paidThisMonth += i.paid;
    }
  });

  document.getElementById('stat-outstanding').textContent = formatINR(outstanding);
  document.getElementById('stat-paid').textContent = formatINR(paidThisMonth);
  document.getElementById('stat-count').textContent = count;
}

function renderPurchaseTable() {
  const tbody = document.getElementById('invoice-tbody');
  tbody.innerHTML = '';
  
  if (currentPurchases.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#888;">No purchases found</td></tr>`;
    return;
  }

  currentPurchases.forEach(i => {
    const bal = i.total - i.paid;
    let badgeClass = 'status-unpaid';
    if (i.status === 'paid') badgeClass = 'status-paid';
    if (i.status === 'partial') badgeClass = 'status-partial';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(i.purchase_date)}</td>
      <td style="font-weight:600;color:#1a73e8;">#${i.bill_no}</td>
      <td style="font-weight:500;">${i.party_name}</td>
      <td class="col-amt">${formatINR(i.total)}</td>
      <td class="col-amt text-green">${formatINR(i.paid)}</td>
      <td class="col-amt text-red" style="font-weight:bold">${formatINR(bal)}</td>
      <td><span class="inv-status ${badgeClass}">${i.status}</span></td>
      <td>
        ${i.bill_image ? `<a href="${i.bill_image}" target="_blank" class="btn-outline" style="margin-right:5px; text-decoration:none;">View Bill</a>` : ''}
        <button class="btn-outline" style="margin-left:5px;" onclick="openHistoryModal(${i.id}, '${i.bill_no}')">Payments</button>
        ${i.status !== 'paid' ? `<button class="btn-receive" style="margin-left:5px;" onclick="openPaymentModal(${i.id}, ${bal})">Record Pay</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// === Full Screen Purchase Builder ===
function openPurchaseModal() {
  document.getElementById('modal-invoice').classList.add('open');
  document.getElementById('overlay-invoice').classList.add('open');
  document.body.style.overflow = 'hidden';

  // reset form
  document.getElementById('inv-party').value = '';
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('inv-date').value = today;
  
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);
  document.getElementById('inv-due-date').value = nextMonth.toISOString().split('T')[0];
  
  document.getElementById('inv-no').value = '';
  document.getElementById('inv-bill-image').value = '';
  document.getElementById('preview-row').style.display = 'none';
  document.getElementById('bill-preview-img').src = '';
  document.getElementById('ai-raw-text').textContent = '';
  document.getElementById('scan-status').textContent = '';
  ocrRawData = null;
  aiParsedData = null;

  document.getElementById('inv-notes').value = '';
  document.getElementById('inv-initial-paid').value = '0';
  document.getElementById('sum-transport').value = '0';
  document.getElementById('sum-extra').value = '0';
  
  document.getElementById('inv-items-body').innerHTML = '';
  addPurchaseItemRow();
  calculateTotals();
}

function closePurchaseModal() {
  document.getElementById('modal-invoice').classList.remove('open');
  document.getElementById('overlay-invoice').classList.remove('open');
  document.body.style.overflow = '';
}

function getProductOptions() {
  let opts = '<option value="">Custom Item...</option>';
  allProducts.forEach(p => {
    // If it's a raw material or finished good, we can just list all for purchasing.
    opts += `<option value="${p.id}" data-price="${p.price}" data-unit="${p.unit}" data-gst="${p.gst_rate}">${p.name} (Stock: ${p.stock})</option>`;
  });
  return opts;
}

function addPurchaseItemRow() {
  const tbody = document.getElementById('inv-items-body');
  const tr = document.createElement('tr');
  
  tr.innerHTML = `
    <td>
      <select class="item-prod" onchange="onProductSelect(this)" style="display:none;width:100%">${getProductOptions()}</select>
      <input type="text" class="item-desc" placeholder="Item description" style="margin-top:4px;">
      <a href="#" onclick="(function(e,el){e.preventDefault();el.parentElement.querySelector('select').style.display='block';el.style.display='none'})(event,this)" style="font-size:10px;color:#E05A20;">+ Link to Inventory</a>
    </td>
    <td><input type="number" class="item-qty" value="1" min="0" oninput="calculateTotals()"></td>
    <td><input type="text" class="item-unit" value="pcs"></td>
    <td><input type="number" class="item-rate" step="0.01" value="0.00" oninput="calculateTotals()"></td>
    <td><input type="number" class="item-disc" step="0.1" value="0" oninput="calculateTotals()"></td>
    <td><input type="number" class="item-gst" step="0.1" value="18" oninput="calculateTotals()"></td>
    <td style="text-align:right" class="item-amount" style="font-weight:600;">₹0.00</td>
    <td><button class="btn-remove-item" onclick="this.closest('tr').remove(); calculateTotals()">×</button></td>
  `;
  tbody.appendChild(tr);
}

function onProductSelect(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  const tr = sel.closest('tr');
  // Removing the "(Stock: XX)" part
  const textName = opt.text.split(' (Stock:')[0];
  tr.querySelector('.item-desc').value = textName;
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

  const transport = parseFloat(document.getElementById('sum-transport').value) || 0;
  const extra = parseFloat(document.getElementById('sum-extra').value) || 0;

  grandTotal += transport + extra;

  document.getElementById('sum-subtotal').textContent = formatINR(subtotal - totalDisc);
  document.getElementById('sum-tax').textContent = formatINR(totalTax);
  document.getElementById('sum-total').textContent = formatINR(grandTotal);
}

// === AI Scanning Logic ===
function previewBillImage(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('preview-row').style.display = 'block';
      document.getElementById('bill-preview-img').src = e.target.result;
    }
    reader.readAsDataURL(input.files[0]);
  } else {
    document.getElementById('preview-row').style.display = 'none';
  }
}

async function scanBillAI() {
  const fileInput = document.getElementById('inv-bill-image');
  if (!fileInput.files || fileInput.files.length === 0) {
    return showToast("Please select a bill image first!");
  }

  const statusEl = document.getElementById('scan-status');
  statusEl.textContent = "Scanning with AI... (Running OCR engine)";
  
  try {
    const worker = await Tesseract.createWorker('eng');
    const ret = await worker.recognize(fileInput.files[0]);
    await worker.terminate();
    
    ocrRawData = ret.data.text;
    document.getElementById('ai-raw-text').textContent = ocrRawData;
    statusEl.textContent = "OCR complete! Sending to AI for structured extraction...";

    // Send to LLM API
    try {
      const apiRes = await fetch(`${API}/ai_parser.php`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text: ocrRawData})
      });
      const aiResponse = await apiRes.json();

      if (aiResponse.fallback_required || aiResponse.error) {
        console.warn("AI API unavailable or failed. Falling back to heuristic parser.", aiResponse.error);
        aiParsedData = mockAIParse(ocrRawData);
        applyAIParse(aiParsedData);
        statusEl.textContent = "Extracted using Fallback Heuristics. Please verify.";
      } else {
        // Success from LLM
        aiParsedData = aiResponse;
        
        // Map LLM output to our UI variables
        const mappedData = {
          vendor_id: null,
          vendor_name: aiParsedData.vendor_name || "Extracted Vendor",
          bill_number: aiParsedData.invoice_number || "AI-" + Math.floor(Math.random()*10000),
          bill_date: aiParsedData.date || new Date().toISOString().split('T')[0],
          items: aiParsedData.items || [],
          total_amount: aiParsedData.total_amount || 0
        };

        // Auto-detect vendor id by name
        let detectedPartyId = document.getElementById('inv-party').value; 
        if (!detectedPartyId && allParties && mappedData.vendor_name) {
           for (let p of allParties) {
             if (p.type === 'supplier' && mappedData.vendor_name.toLowerCase().includes(p.name.toLowerCase())) {
               detectedPartyId = p.id;
               break;
             }
           }
        }
        mappedData.vendor_id = detectedPartyId;

        applyAIParse(mappedData);
        statusEl.textContent = "✨ AI Extraction Complete! Form auto-filled. Please verify.";
      }
    } catch (apiErr) {
      console.error("API Call Error:", apiErr);
      aiParsedData = mockAIParse(ocrRawData);
      applyAIParse(aiParsedData);
      statusEl.textContent = "API Error. Extracted using Fallback Heuristics.";
    }

  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error scanning bill.";
    showToast("Error processing image.");
  }
}

function mockAIParse(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let billNo = "";
  let date = new Date().toISOString().split('T')[0];
  let items = [];
  let total = 0;
  
  // 1. Auto-detect Vendor (Party Name Wise)
  let detectedPartyId = document.getElementById('inv-party').value; 
  if (!detectedPartyId && allParties) {
     for (let p of allParties) {
       if (p.type === 'supplier') {
         // Check if name is in text (case insensitive)
         if (text.toLowerCase().includes(p.name.toLowerCase())) {
           detectedPartyId = p.id;
           break;
         }
       }
     }
  }

  // 2. Line by line table scanning
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Try finding Bill No
    if (!billNo) {
      let noMatch = line.match(/(?:Invoice|Bill)\s*(?:No|#)[.:-]?\s*([A-Za-z0-9\-\/]+)/i);
      if (noMatch) billNo = noMatch[1];
    }

    // Try finding Date (DD/MM/YYYY or YYYY-MM-DD)
    let dateMatch = line.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (dateMatch && !line.toLowerCase().includes('due')) {
       // Simplify date parsing if needed
    }

    // Identify Item Rows line by line
    // Typical row: "Item Description 10 15.00 150.00"
    let parts = line.split(/\s+/);
    if (parts.length >= 3) {
      let pLen = parts.length;
      let last = parseFloat(parts[pLen-1].replace(/,/g, ''));
      let secondLast = parseFloat(parts[pLen-2].replace(/,/g, ''));
      let thirdLast = parseFloat(parts[pLen-3].replace(/,/g, ''));

      if (!isNaN(last) && !isNaN(secondLast)) {
        let lLower = line.toLowerCase();
        
        // Exclude total/summary rows
        if (lLower.includes('total') || lLower.includes('amount') || lLower.includes('gst') || lLower.includes('discount')) {
           if (lLower.includes('total') || lLower.includes('grand') || lLower.includes('net')) {
              if (last > total) total = last;
           }
           continue; 
        }

        let qty = 1;
        let rate = secondLast;
        let amt = last;
        let descParts = [];

        // Determine if third from last is Qty
        if (!isNaN(thirdLast)) {
          qty = thirdLast;
          descParts = parts.slice(0, pLen-3);
        } else {
          // Maybe format is (Qty, Desc, Amount) or (Desc, Qty, Amount)
          let firstPart = parseFloat(parts[0]);
          if (!isNaN(firstPart)) {
            qty = firstPart;
            descParts = parts.slice(1, pLen-2);
          } else {
            qty = secondLast;
            rate = last / (qty || 1);
            descParts = parts.slice(0, pLen-2);
          }
        }

        let desc = descParts.join(' ').trim();
        desc = desc.replace(/^[^a-zA-Z0-9]+/, ''); // Clean leading symbols
        
        // Ensure it's a valid item description and not random numbers
        if (desc.length > 2 && !desc.match(/^[0-9\.\,]+$/)) {
          items.push({
            name: desc,
            qty: qty,
            rate: rate,
            gst_rate: 18 // Default
          });
        }
      }
    }
  }

  // 3. Fallback for the specific Alok Bags "ORDER & ESTIMATE" format
  // Example: "Total] 202Pic. | | 5,050.0"
  if (items.length === 0) {
    let customMatch = text.match(/([0-9]+)\s*(?:Pic|Pcs|Pieces).*?([0-9,]+\.[0-9]+)/i);
    if (customMatch) {
       let q = parseInt(customMatch[1]);
       let a = parseFloat(customMatch[2].replace(/,/g, ''));
       if (q > 0 && a > 0) {
         items.push({
           name: "Imported Goods (Scanned)",
           qty: q,
           rate: (a/q).toFixed(2),
           gst_rate: 0
         });
         if (a > total) total = a;
       }
    }
  }

  // 4. Default fallback if STILL nothing found
  if (items.length === 0) {
    items.push({
       name: "Manual Entry Required",
       qty: 1,
       rate: 0,
       gst_rate: 18
    });
  }

  if (!billNo) billNo = "AI-" + Math.floor(Math.random()*10000);

  return {
    vendor_id: detectedPartyId,
    vendor_name: "Extracted Vendor",
    bill_number: billNo,
    bill_date: date,
    items: items,
    total_amount: total
  };
}

function applyAIParse(data) {
  if (data.vendor_id) {
    document.getElementById('inv-party').value = data.vendor_id;
  }
  document.getElementById('inv-no').value = data.bill_number;
  document.getElementById('inv-date').value = data.bill_date;
  
  const tbody = document.getElementById('inv-items-body');
  tbody.innerHTML = ''; // clear existing
  
  data.items.forEach(item => {
    addPurchaseItemRow();
    const lastRow = tbody.lastElementChild;
    lastRow.querySelector('.item-desc').value = item.name;
    lastRow.querySelector('.item-qty').value = item.qty;
    lastRow.querySelector('.item-rate').value = item.rate;
    lastRow.querySelector('.item-gst').value = item.gst_rate;
  });
  
  calculateTotals();
  showToast("Line-by-line scanning complete!");
}

function getBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

async function savePurchase() {
  const partyId = document.getElementById('inv-party').value;
  if (!partyId) return showToast("Select a vendor");
  
  const billNo = document.getElementById('inv-no').value.trim();
  if (!billNo) return showToast("Enter vendor bill no.");

  let billImageBase64 = null;
  const fileInput = document.getElementById('inv-bill-image');
  if (fileInput.files.length > 0) {
    try {
      billImageBase64 = await getBase64(fileInput.files[0]);
    } catch (e) {
      console.error("File read error", e);
    }
  }

  const items = [];
  let subtotal = 0;
  let taxAmount = 0;
  let grandTotal = 0;

  document.querySelectorAll('#inv-items-body tr').forEach(tr => {
    const desc = tr.querySelector('.item-desc').value.trim();
    if (!desc) return; // skip empty rows
    const sel = tr.querySelector('.item-prod');
    
    const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
    const rate = parseFloat(tr.querySelector('.item-rate').value) || 0;
    const discPct = parseFloat(tr.querySelector('.item-disc').value) || 0;
    const gstRate = parseFloat(tr.querySelector('.item-gst').value) || 0;

    const base = qty * rate;
    const discAmt = base * (discPct / 100);
    const taxable = base - discAmt;
    const taxAmt = taxable * (gstRate / 100);
    const rowTotal = taxable + taxAmt;

    subtotal += taxable;
    taxAmount += taxAmt;
    grandTotal += rowTotal;

    items.push({
      product_id: sel.value ? parseInt(sel.value) : null,
      description: desc,
      qty: qty,
      unit: tr.querySelector('.item-unit').value,
      price: rate,
      discount_pct: discPct,
      gst_rate: gstRate,
      amount: taxable,
      tax_amount: taxAmt
    });
  });

  if (items.length === 0) return showToast("Add at least one item");

  const transport = parseFloat(document.getElementById('sum-transport').value) || 0;
  const extra = parseFloat(document.getElementById('sum-extra').value) || 0;
  grandTotal += transport + extra;

  const initialPaid = parseFloat(document.getElementById('inv-initial-paid').value) || 0;

  const payload = {
    party_id: parseInt(partyId),
    bill_no: billNo,
    purchase_date: document.getElementById('inv-date').value,
    due_date: document.getElementById('inv-due-date').value,
    notes: document.getElementById('inv-notes').value,
    subtotal: subtotal,
    tax_amount: taxAmount,
    transport_charges: transport,
    extra_charges: extra,
    total: grandTotal,
    paid: initialPaid,
    bill_image: billImageBase64,
    ocr_raw_text: ocrRawData,
    ai_structured_data: aiParsedData ? JSON.stringify(aiParsedData) : null,
    items: items
  };

  try {
    const res = await fetch(`${API}/purchases.php`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    
    showToast("Purchase bill saved!");
    closePurchaseModal();
    loadPurchases();
    loadProducts(); // refresh stock numbers
  } catch (err) {
    showToast("Error saving purchase: " + err.message);
  }
}

// === Record Payment Modal ===
function openPaymentModal(purchaseId, balance) {
  document.getElementById('modal-payment').classList.add('open');
  document.getElementById('overlay-payment').classList.add('open');
  
  document.getElementById('pay-inv-id').value = purchaseId;
  document.getElementById('pay-balance').textContent = formatINR(balance);
  document.getElementById('pay-amount').value = balance.toFixed(2);
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('pay-date').value = today;
  document.getElementById('pay-note').value = '';
}

function closePaymentModal() {
  document.getElementById('modal-payment').classList.remove('open');
  document.getElementById('overlay-payment').classList.remove('open');
}

async function savePayment() {
  const purId = document.getElementById('pay-inv-id').value;
  const amt = parseFloat(document.getElementById('pay-amount').value);
  const method = document.getElementById('pay-method').value;
  const date = document.getElementById('pay-date').value;
  const note = document.getElementById('pay-note').value;

  if (!amt || amt <= 0) return showToast("Enter a valid amount");

  try {
    const res = await fetch(`${API}/purchases.php?action=pay&id=${purId}`, {
      method: 'POST',
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        amount: amt,
        method: method,
        paid_on: date,
        note: note
      })
    });
    if (!res.ok) throw new Error(await res.text());
    
    showToast("Payment recorded successfully");
    closePaymentModal();
    loadPurchases();
  } catch(e) {
    showToast("Error: " + e.message);
  }
}

// === View Payments History ===
async function openHistoryModal(purchaseId, billNo) {
  document.getElementById('history-modal-title').textContent = `Payment History - Bill #${billNo}`;
  document.getElementById('modal-history').classList.add('open');
  document.getElementById('overlay-history').classList.add('open');
  
  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#888;">Loading...</td></tr>`;

  try {
    const res = await fetch(`${API}/purchases.php?id=${purchaseId}`);
    if (!res.ok) throw new Error("API Error");
    const data = await res.json();
    
    tbody.innerHTML = '';
    
    if (!data.payments || data.payments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#888;">No payments found for this bill</td></tr>`;
      return;
    }
    
    data.payments.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(p.paid_on)}</td>
        <td><span style="text-transform:uppercase; font-size:11px; font-weight:600; background:#fef3e0; padding:2px 6px; border-radius:4px;">${p.method}</span></td>
        <td style="color:#666; font-size:12px;">${p.note || '--'}</td>
        <td class="col-amt text-green" style="font-weight:bold;">${formatINR(p.amount)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:red;">Error loading payments</td></tr>`;
    console.error(err);
  }
}

function closeHistoryModal() {
  document.getElementById('modal-history').classList.remove('open');
  document.getElementById('overlay-history').classList.remove('open');
}

// Bootstrap
init();
