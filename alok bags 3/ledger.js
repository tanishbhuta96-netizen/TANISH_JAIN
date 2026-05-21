/* ═══════════════════════════════════════════
   ALOK BAGS — Ledger Module Script (Upgraded)
   ═══════════════════════════════════════════ */

const API = 'api';
let selectedPartyId = null;
let partiesCache    = [];
let currentPartyData = null;
let paymentModalMode = 'receive'; // 'receive' | 'pay'

// ═══════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════

function formatINR(num) {
  if (num === 0 || num === null || num === undefined) return '₹0';
  const abs = Math.abs(num);
  const s   = Math.floor(abs).toString();
  let result = '';
  const len  = s.length;
  if (len <= 3) {
    result = s;
  } else {
    result = s.substring(len - 3);
    let rem = s.substring(0, len - 3);
    while (rem.length > 2) {
      result = rem.substring(rem.length - 2) + ',' + result;
      rem    = rem.substring(0, rem.length - 2);
    }
    if (rem.length > 0) result = rem + ',' + result;
  }
  // Include paise if non-zero
  const decimal = (abs - Math.floor(abs)).toFixed(2).substring(1);
  return '₹' + result + (decimal !== '.00' ? decimal : '');
}

function formatDash(num) { return num ? formatINR(num) : '—'; }

function capitalizeType(type) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getBadgeClass(type)  { return 'badge-' + type; }

function getTypeBadgeClass(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('sale') || t.includes('invoice')) return 'txn-type--sales';
  if (t.includes('receipt') || t === 'payment_received') return 'txn-type--receipt';
  if (t.includes('debit'))  return 'txn-type--debit';
  if (t.includes('credit')) return 'txn-type--credit';
  if (t.includes('payment') || t.includes('purchase') || t === 'payment_given') return 'txn-type--payment';
  return '';
}

function getRowClass(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('sale') || t.includes('invoice')) return 'txn-row--invoice';
  if (t.includes('debit'))  return 'txn-row--debit';
  if (t.includes('receipt') || t === 'payment_received') return 'txn-row--receipt';
  if (t.includes('payment') || t.includes('purchase') || t === 'payment_given') return 'txn-row--receipt';
  if (t.includes('credit')) return 'txn-row--credit';
  return '';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return String(d.getDate()).padStart(2, '0') + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

function getTypeLabel(type) {
  const map = {
    'payment_received': 'Payment In',
    'payment_given':    'Payment Out',
    'Sales Invoice':    'Sale',
    'Purchase':         'Purchase',
    'Receipt':          'Receipt',
    'Payment':          'Payment',
    'Debit Note':       'Debit Note',
    'Credit Note':      'Credit Note',
  };
  return map[type] || type;
}

function getMethodBadge(method) {
  if (!method) return '<span class="method-badge method-badge--none">—</span>';
  const cls  = 'method-badge method-badge--' + method;
  const icon = method === 'cash' ? '💵' : method === 'upi' ? '📱' : '🏦';
  const label = method === 'bank' ? 'Bank' : method.toUpperCase();
  return `<span class="${cls}">${icon} ${label}</span>`;
}

// ═══════════════════════════════════
// PAYMENT STATUS BADGE
// ═══════════════════════════════════

function getPaymentStatusHTML(status) {
  if (status === 'to_get')  return '<span class="payment-status-badge status-badge-get">● To Get</span>';
  if (status === 'to_give') return '<span class="payment-status-badge status-badge-give">● To Give</span>';
  return '<span class="payment-status-badge status-badge-clear">✓ Clear</span>';
}

// ═══════════════════════════════════
// API HELPERS
// ═══════════════════════════════════

async function apiGet(endpoint) {
  try {
    const res = await fetch(`${API}/${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('API GET error:', err);
    showToast('Failed to load data. Make sure PHP server is running.');
    return null;
  }
}

async function apiPost(endpoint, data) {
  try {
    const res = await fetch(`${API}/${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('API POST error:', err);
    showToast('Error: ' + err.message);
    return null;
  }
}

// ═══════════════════════════════════
// PARTY LIST
// ═══════════════════════════════════

async function loadParties(filter = 'all', search = '') {
  let url = `parties.php?type=${filter}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  const parties = await apiGet(url);
  if (!parties) return;
  partiesCache = parties;
  renderPartyList(parties);

  if (parties.length > 0) {
    if (!selectedPartyId || !parties.find(p => p.id == selectedPartyId)) {
      selectParty(parties[0].id);
    }
  }
}

function renderPartyList(parties) {
  const list = document.getElementById('party-list');
  list.innerHTML = '';

  if (parties.length === 0) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:#999;font-size:12px;">No parties found</div>';
    return;
  }

  parties.forEach(p => {
    const item = document.createElement('div');
    item.className = 'party-item' + (p.id == selectedPartyId ? ' active' : '');
    item.id        = 'party-' + p.id;
    item.onclick   = () => selectParty(p.id);

    const balClass   = p.direction === 'Dr' ? 'balance-dr' : 'balance-cr';
    const statusDot  = p.payment_status === 'to_get'  ? 'status-dot-get'
                     : p.payment_status === 'to_give' ? 'status-dot-give'
                     : 'status-dot-clear';

    item.innerHTML = `
      <div class="party-item__left">
        <span class="party-item__name">${p.name}</span>
        ${p.is_verified == 1 
          ? '<span class="party-badge" style="background:#e8f5e9;color:#2e7d32;">✓ Verified</span>' 
          : `<button class="btn-verify" onclick="verifyParty(${p.id}, event)" style="padding:2px 6px;font-size:10px;background:#fff3e0;color:#e65100;border:1px solid #ffe0b2;border-radius:4px;cursor:pointer;">⚠ Verify</button>`}
        <span class="party-badge ${getBadgeClass(p.type)}">${capitalizeType(p.type)}</span>
      </div>
      <div class="party-item__right">
        <span class="party-item__balance ${balClass}">${formatINR(p.balance)} ${p.direction}</span>
        <span class="party-status-dot ${statusDot}"></span>
      </div>
    `;
    list.appendChild(item);
  });
}

// ═══════════════════════════════════
// SELECT PARTY — Load full data
// ═══════════════════════════════════

async function selectParty(id) {
  selectedPartyId = id;

  document.querySelectorAll('.party-item').forEach(el => el.classList.remove('active'));
  const activeItem = document.getElementById('party-' + id);
  if (activeItem) activeItem.classList.add('active');

  const party = await apiGet(`parties.php?id=${id}`);
  if (!party) return;
  currentPartyData = party;

  // Header card
  document.getElementById('phc-name').textContent = party.name;
  const badge = document.getElementById('phc-badge');
  badge.textContent = capitalizeType(party.type);
  badge.className   = 'party-badge ' + getBadgeClass(party.type);

  // Payment status badge
  document.getElementById('phc-status-badge').outerHTML = getPaymentStatusHTML(party.payment_status);

  document.getElementById('phc-opening').textContent     = party.opening_balance ? formatINR(party.opening_balance) : '₹0';
  document.getElementById('phc-total-debit').textContent = formatINR(party.total_debit);
  document.getElementById('phc-total-credit').textContent= formatINR(party.total_credit);

  const closingAmt = party.closing_balance;
  const closingDir = party.direction;
  document.getElementById('phc-closing').textContent   = formatINR(Math.abs(closingAmt)) + ' ' + closingDir;
  document.getElementById('tfoot-closing').textContent = formatINR(Math.abs(closingAmt)) + ' ' + closingDir;

  // Mailing details
  document.getElementById('mail-contact').textContent   = party.contact  || '—';
  document.getElementById('mail-mobile').textContent    = party.mobile   || '—';
  document.getElementById('mail-mobile').href           = party.mobile   ? 'tel:' + party.mobile.replace(/\s/g, '')   : '#';
  document.getElementById('mail-whatsapp').textContent  = party.whatsapp || '—';
  document.getElementById('mail-whatsapp').href         = party.whatsapp ? 'https://wa.me/' + party.whatsapp.replace(/[\s+]/g, '') : '#';
  document.getElementById('mail-email').textContent     = party.email    || '—';
  document.getElementById('mail-email').href            = party.email    ? 'mailto:' + party.email : '#';
  document.getElementById('mail-billing').textContent   = party.billing  || '—';
  document.getElementById('mail-shipping').textContent  = party.shipping || 'Same as billing';
  document.getElementById('mail-gstin').textContent     = party.gstin    || '—';
  document.getElementById('mail-pan').textContent       = party.pan      || '—';
  document.getElementById('mail-terms').textContent     = party.terms    || '—';
  document.getElementById('mail-credit').textContent    = party.credit_limit || '—';

  // Load transactions with current filters
  await loadPartyTransactions(id);

  // Ageing (simplified)
  const absClosing = Math.abs(closingAmt);
  const ageLabels  = ['ageing-0-30','ageing-31-60','ageing-61-90','ageing-90plus'];
  const ageValues  = [absClosing, 0, 0, 0];
  ageLabels.forEach((aid, i) => {
    const box = document.getElementById(aid);
    if (!box) return;
    box.querySelector('.ageing-box__value').textContent = ageValues[i] > 0 ? formatINR(ageValues[i]) : '₹0';
    box.className = 'ageing-box ' + (ageValues[i] > 0 ? 'ageing-box--green' : 'ageing-box--gray');
  });

  // Email defaults
  document.getElementById('email-to').value      = party.email || '';
  document.getElementById('email-subject').value = `Account Statement — ${party.name} — Apr 2026`;
  document.getElementById('email-body').value    =
    `Dear ${party.contact || party.name},\n\nPlease find attached your account statement for the period 01 Apr 2026 to 30 Apr 2026.\n\nClosing Balance: ${formatINR(Math.abs(closingAmt))} ${closingDir}\n\nKindly arrange payment at the earliest.\n\nRegards,\nALOK BAGS`;
  document.getElementById('email-attach-name').textContent =
    `Account_Statement_${party.name.replace(/\s/g, '_')}_Apr2026.pdf`;

  // Re-animate
  ['party-header-card','mailing-card','txn-table-wrap','ageing-panel'].forEach(elId => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = '';
  });
}

// ═══════════════════════════════════
// TRANSACTION TABLE — from dedicated API
// ═══════════════════════════════════

async function loadPartyTransactions(partyId, extraFilters = {}) {
  if (!partyId) return;

  // Build URL with filters
  let url = `transactions.php?party_id=${partyId}`;
  const from = extraFilters.from || document.getElementById('txn-filter-from')?.value || '';
  const to   = extraFilters.to   || document.getElementById('txn-filter-to')?.value   || '';
  const type = extraFilters.type || document.getElementById('txn-filter-type')?.value  || 'all';
  const ref  = extraFilters.ref  || document.getElementById('txn-filter-ref')?.value   || '';

  if (from) url += `&from=${from}`;
  if (to)   url += `&to=${to}`;
  if (type && type !== 'all') url += `&type=${encodeURIComponent(type)}`;
  if (ref)  url += `&ref=${encodeURIComponent(ref)}`;

  const data = await apiGet(url);
  if (!data) return;

  renderTransactionTable(data);

  // Update footer totals
  document.getElementById('tfoot-debit').textContent  = formatINR(data.total_debit);
  document.getElementById('tfoot-credit').textContent = formatINR(data.total_credit);
  const cl = data.closing_balance;
  const clDir = data.closing_dir;
  document.getElementById('tfoot-closing').textContent = formatINR(Math.abs(cl)) + ' ' + clDir;
}

function renderTransactionTable(data) {
  const tbody = document.getElementById('txn-tbody');
  tbody.innerHTML = '';
  const rows = data.transactions || [];

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#999;">No transactions found for this period</td></tr>';
    return;
  }

  rows.forEach(t => {
    const balance = t.running_balance;
    const dir     = t.balance_dir;
    const tr      = document.createElement('tr');
    tr.className  = getRowClass(t.type);

    const noteText = t.payment_note ? `<div class="txn-note">${t.payment_note}</div>` : '';

    tr.innerHTML = `
      <td class="txn-date-cell">${formatDate(t.txn_date)}</td>
      <td><span class="voucher-no">${t.voucher || '—'}</span></td>
      <td><span class="txn-type-badge ${getTypeBadgeClass(t.type)}">${getTypeLabel(t.type)}</span></td>
      <td><span class="txn-desc">${t.description || ''}</span>${noteText}</td>
      <td>${getMethodBadge(t.payment_mode)}</td>
      <td class="col-amt txn-debit-cell">${t.debit  > 0 ? formatINR(t.debit)  : '—'}</td>
      <td class="col-amt txn-credit-cell">${t.credit > 0 ? formatINR(t.credit) : '—'}</td>
      <td class="col-amt txn-bal-cell">${formatINR(Math.abs(balance))} <span class="bal-dir">${dir}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ═══════════════════════════════════
// TXN FILTER BAR
// ═══════════════════════════════════

function applyTxnFilter() {
  if (!selectedPartyId) { showToast('Select a party first'); return; }
  loadPartyTransactions(selectedPartyId);
  showToast('Filter applied');
}

function clearTxnFilter() {
  document.getElementById('txn-filter-from').value = '';
  document.getElementById('txn-filter-to').value   = '';
  document.getElementById('txn-filter-type').value = 'all';
  document.getElementById('txn-filter-ref').value  = '';
  if (selectedPartyId) loadPartyTransactions(selectedPartyId);
}

// ═══════════════════════════════════
// PARTY LIST FILTERS
// ═══════════════════════════════════

function applyFilter() {
  const type   = document.getElementById('filter-party-type').value;
  const search = document.getElementById('filter-search').value;
  loadParties(type, search);
  showToast('Filters applied');
}

document.getElementById('filter-search').addEventListener('input', () => {
  const type   = document.getElementById('filter-party-type').value;
  const search = document.getElementById('filter-search').value;
  loadParties(type, search);
});

document.getElementById('filter-party-type').addEventListener('change', () => {
  const type   = document.getElementById('filter-party-type').value;
  const search = document.getElementById('filter-search').value;
  loadParties(type, search);
});

// ═══════════════════════════════════
// NEW PARTY MODAL
// ═══════════════════════════════════

function openNewPartyModal() {
  document.getElementById('modal-overlay-party').classList.add('open');
  document.getElementById('modal-new-party').classList.add('open');
  document.body.style.overflow = 'hidden';
  ['np-name','np-contact','np-mobile','np-whatsapp','np-email',
   'np-billing','np-shipping','np-gstin','np-pan','np-credit'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('np-type').value    = 'customer';
  document.getElementById('np-terms').value   = 'Net 30 days';
  document.getElementById('np-opening').value = '0';
}

function closeNewPartyModal() {
  document.getElementById('modal-overlay-party').classList.remove('open');
  document.getElementById('modal-new-party').classList.remove('open');
  document.body.style.overflow = '';
}

async function saveNewParty() {
  const name = document.getElementById('np-name').value.trim();
  if (!name) { showToast('Party name is required'); return; }

  const data = {
    name,
    type:            document.getElementById('np-type').value,
    contact:         document.getElementById('np-contact').value.trim(),
    mobile:          document.getElementById('np-mobile').value.trim(),
    whatsapp:        document.getElementById('np-whatsapp').value.trim(),
    email:           document.getElementById('np-email').value.trim(),
    billing:         document.getElementById('np-billing').value.trim(),
    shipping:        document.getElementById('np-shipping').value.trim(),
    gstin:           document.getElementById('np-gstin').value.trim(),
    pan:             document.getElementById('np-pan').value.trim(),
    terms:           document.getElementById('np-terms').value.trim(),
    credit_limit:    document.getElementById('np-credit').value.trim(),
    opening_balance: parseFloat(document.getElementById('np-opening').value) || 0,
  };

  const result = await apiPost('parties.php', data);
  if (result && result.id) {
    showToast(`Party "${name}" created successfully!`);
    closeNewPartyModal();
    selectedPartyId = result.id;
    await loadParties();
    selectParty(result.id);
  }
}

async function verifyParty(id, event) {
  event.stopPropagation();
  try {
    const res = await fetch(`${API}/parties.php?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_verified: 1 })
    });
    if (!res.ok) throw new Error('Failed to verify');
    showToast('Party verified successfully!');
    
    // Refresh the list
    const type = document.getElementById('filter-party-type').value;
    const search = document.getElementById('filter-search').value;
    loadParties(type, search);
  } catch(e) {
    showToast(e.message);
  }
}

// ═══════════════════════════════════
// NEW GENERIC ENTRY MODAL
// ═══════════════════════════════════

function openNewEntryModal() {
  document.getElementById('modal-overlay-entry').classList.add('open');
  document.getElementById('modal-new-entry').classList.add('open');
  document.body.style.overflow = 'hidden';

  const select = document.getElementById('ne-party');
  select.innerHTML = '';
  partiesCache.forEach(p => {
    const opt = document.createElement('option');
    opt.value       = p.id;
    opt.textContent = p.name;
    if (p.id == selectedPartyId) opt.selected = true;
    select.appendChild(opt);
  });

  document.getElementById('ne-date').value   = new Date().toISOString().split('T')[0];
  document.getElementById('ne-voucher').value = '';
  document.getElementById('ne-desc').value   = '';
  document.getElementById('ne-debit').value  = '0';
  document.getElementById('ne-credit').value = '0';
}

function closeNewEntryModal() {
  document.getElementById('modal-overlay-entry').classList.remove('open');
  document.getElementById('modal-new-entry').classList.remove('open');
  document.body.style.overflow = '';
}

async function saveNewEntry() {
  const partyId = document.getElementById('ne-party').value;
  const voucher = document.getElementById('ne-voucher').value.trim();
  const txnDate = document.getElementById('ne-date').value;

  if (!voucher)  { showToast('Voucher number is required'); return; }
  if (!txnDate)  { showToast('Date is required'); return; }

  const debit  = parseFloat(document.getElementById('ne-debit').value)  || 0;
  const credit = parseFloat(document.getElementById('ne-credit').value) || 0;

  if (debit === 0 && credit === 0) { showToast('Enter a debit or credit amount'); return; }

  const data = {
    party_id:    parseInt(partyId),
    txn_date:    txnDate,
    voucher,
    type:        document.getElementById('ne-type').value,
    description: document.getElementById('ne-desc').value.trim(),
    debit,
    credit,
  };

  const result = await apiPost('transactions.php', data);
  if (result && result.id) {
    showToast('Entry saved successfully!');
    closeNewEntryModal();
    await loadParties();
    selectParty(parseInt(partyId));
  }
}

// ═══════════════════════════════════
// RECEIVE / PAY PAYMENT MODALS
// ═══════════════════════════════════

function openPaymentModal(mode) {
  paymentModalMode = mode;
  const isReceive = mode === 'receive';

  document.getElementById('modal-payment-title').textContent = isReceive ? 'Receive Payment' : 'Pay Amount';
  document.getElementById('modal-payment-icon').textContent  = isReceive ? '↙' : '↗';
  document.getElementById('btn-save-payment').className      = isReceive ? 'btn-receive' : 'btn-pay';
  document.getElementById('btn-save-payment').textContent    = isReceive ? 'Save — Received' : 'Save — Paid';

  // Populate party dropdown
  const select = document.getElementById('pm-party');
  select.innerHTML = '';
  partiesCache.forEach(p => {
    const opt = document.createElement('option');
    opt.value       = p.id;
    opt.textContent = p.name;
    if (p.id == selectedPartyId) opt.selected = true;
    select.appendChild(opt);
  });

  // Reset form
  document.getElementById('pm-date').value   = new Date().toISOString().split('T')[0];
  document.getElementById('pm-amount').value = '';
  document.getElementById('pm-ref').value    = '';
  document.getElementById('pm-note').value   = '';

  // Reset chip selection to Cash
  document.querySelectorAll('.pay-chip').forEach(c => c.classList.remove('pay-chip--active'));
  document.getElementById('chip-cash').classList.add('pay-chip--active');

  document.getElementById('modal-overlay-payment').classList.add('open');
  document.getElementById('modal-payment').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePaymentModal() {
  document.getElementById('modal-overlay-payment').classList.remove('open');
  document.getElementById('modal-payment').classList.remove('open');
  document.body.style.overflow = '';
}

function selectPayChip(btn) {
  document.querySelectorAll('.pay-chip').forEach(c => c.classList.remove('pay-chip--active'));
  btn.classList.add('pay-chip--active');
}

async function savePayment() {
  const partyId = document.getElementById('pm-party').value;
  const amount  = parseFloat(document.getElementById('pm-amount').value);
  const date    = document.getElementById('pm-date').value;
  const ref     = document.getElementById('pm-ref').value.trim();
  const note    = document.getElementById('pm-note').value.trim();
  const method  = document.querySelector('.pay-chip--active')?.dataset.method || 'cash';

  if (!partyId) { showToast('Select a party'); return; }
  if (!amount || amount <= 0) { showToast('Enter a valid amount'); return; }
  if (!date)   { showToast('Select a date'); return; }

  const isReceive = paymentModalMode === 'receive';
  const type  = isReceive ? 'payment_received' : 'payment_given';
  const debit  = isReceive ? amount : 0;
  const credit = isReceive ? 0 : amount;

  const data = {
    party_id:       parseInt(partyId),
    txn_date:       date,
    voucher:        ref || null,       // will be auto-generated in API if empty
    type,
    description:    isReceive ? 'Payment received' : 'Payment made',
    debit,
    credit,
    payment_method: method,
    note:           note || null,
  };

  const result = await apiPost('transactions.php', data);
  if (result && result.id) {
    showToast(isReceive ? '✅ Payment received & saved!' : '✅ Payment made & saved!');
    closePaymentModal();
    await loadParties();
    selectParty(parseInt(partyId));
  }
}

// ═══════════════════════════════════
// MAILING & EMAIL PANEL
// ═══════════════════════════════════

function toggleMailing() {
  document.getElementById('mailing-body').classList.toggle('collapsed');
  document.getElementById('mailing-toggle').classList.toggle('collapsed');
}

function openEmailPanel() {
  document.getElementById('email-panel').classList.add('open');
  document.getElementById('email-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeEmailPanel() {
  document.getElementById('email-panel').classList.remove('open');
  document.getElementById('email-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function sendEmail() {
  const to = document.getElementById('email-to').value;
  if (!to) { showToast('Please enter an email address'); return; }
  showToast(`Email sent to ${to}`);
  closeEmailPanel();
}

function previewEmail() { showToast('Email preview generated'); }

function removeAttachment() {
  const el = document.querySelector('.email-attachment');
  el.style.cssText = 'opacity:0;height:0;padding:0;margin:0;border-width:0;overflow:hidden;transition:all 0.25s;';
  document.getElementById('email-opt-pdf').checked = false;
}

function sendWhatsApp() {
  if (!currentPartyData || !currentPartyData.whatsapp) {
    showToast('No WhatsApp number available');
    return;
  }
  const p   = currentPartyData;
  const num = p.whatsapp.replace(/[\s+]/g, '');
  const msg = encodeURIComponent(
    `Dear ${p.contact || p.name},\n\nYour account statement for Apr 2026:\nClosing Balance: ${formatINR(Math.abs(p.closing_balance))} ${p.direction}\n\nPlease arrange payment at the earliest.\n\nRegards,\nALOK BAGS`
  );
  window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
}

function copyPartyDetails() {
  if (!currentPartyData) return;
  const p = currentPartyData;
  const text = [
    `Name: ${p.name}`,
    `Type: ${capitalizeType(p.type)}`,
    `Contact: ${p.contact}`,
    `Mobile: ${p.mobile}`,
    `WhatsApp: ${p.whatsapp}`,
    `Email: ${p.email}`,
    `Billing: ${p.billing}`,
    `Shipping: ${p.shipping || 'Same as billing'}`,
    `GSTIN: ${p.gstin}`,
    `PAN: ${p.pan}`,
    `Terms: ${p.terms}`,
    `Credit Limit: ${p.credit_limit}`,
    `Balance: ${formatINR(Math.abs(p.closing_balance))} ${p.direction}`,
  ].join('\n');

  navigator.clipboard.writeText(text)
    .then(() => showToast('Details copied to clipboard'))
    .catch(() => showToast('Failed to copy'));
}

function printStatement() { window.print(); }

function exportExcel() {
  if (!currentPartyData) return;
  const p = currentPartyData;
  let csv = 'Date,Reference,Type,Description,Note,Method,Debit,Credit,Balance\n';
  let running = p.opening_balance || 0;
  (p.transactions || []).forEach(t => {
    running += t.debit - t.credit;
    const dir = running >= 0 ? 'Dr' : 'Cr';
    csv += `"${formatDate(t.txn_date)}","${t.voucher}","${t.type}","${t.description}","${t.note || ''}","${t.payment_method || ''}",${t.debit || ''},${t.credit || ''},"${Math.abs(running)} ${dir}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `Ledger_${p.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported to CSV');
}

// ── TOAST ──
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── NAV TOGGLE ──
function setupNavToggle(sel) {
  const container = document.querySelector(sel);
  if (!container) return;
  container.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (href && href !== '#') return;
      e.preventDefault();
      container.querySelectorAll('a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}
setupNavToggle('.top-nav__links');
setupNavToggle('.sub-nav ul');

// ═══════════════════════════════════
// INIT
// ═══════════════════════════════════
loadParties();
