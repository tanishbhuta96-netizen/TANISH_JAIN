/* invoice-modal.js - Advanced Features Integration */

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
  calculateTotals(); // Re-trigger totals to update tax display
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
    
    // Pre-fill grand total from summary
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
