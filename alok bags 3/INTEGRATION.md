# Alok Bags - Invoice Upgrade Integration Guide

This document outlines the changes made to support State-based GST (CGST/SGST vs IGST) and Integrated Payments at invoice creation.

## 1. Database Changes
Run the following SQL to update your schema:
```sql
ALTER TABLE parties ADD COLUMN state VARCHAR(100) DEFAULT 'Rajasthan';
ALTER TABLE parties ADD COLUMN city VARCHAR(100) NULL;
ALTER TABLE parties ADD COLUMN pincode VARCHAR(10) NULL;

ALTER TABLE invoices ADD COLUMN tax_type ENUM('cgst_sgst','igst') DEFAULT 'cgst_sgst';
ALTER TABLE invoices ADD COLUMN party_state VARCHAR(100) NULL;
ALTER TABLE invoices ADD COLUMN cgst_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN sgst_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN igst_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN payment_mode ENUM('pending','cash','upi','cheque') DEFAULT 'pending';
ALTER TABLE invoices ADD COLUMN payment_note VARCHAR(255) NULL;
ALTER TABLE invoices ADD COLUMN payment_date DATE NULL;
```

## 2. Key Files Updated
- **api/invoices.php**: POST logic now handles `tax_type`, splits GST amounts, updates invoice `paid` status, and automatically inserts `transactions` ledger entries.
- **sales.js**: 
  - Added `updateTaxType(state)` to switch summary view between CGST+SGST and IGST.
  - Added `togglePaymentFields()` to handle the interactive payment box.
  - Updated `saveInvoice()` to send the new payment and state metadata.
- **sales.html**:
  - Added State dropdown for Walk-in bills.
  - Added IGST row in the summary section.
  - Added the "Payment Details" box above the Save button.
- **invoice-autocomplete.js**: Updated to capture and pass `state` from party selection to the invoice modal.

## 3. How it Works
1. **GST Auto-Switch**: When a party is selected, the system checks their `state`. If it's anything other than "Rajasthan", it switches to **IGST** mode.
2. **Payment Integration**: You can now mark an invoice as "Cash Received" or "UPI" directly while creating it. This will:
   - Mark the invoice as `paid` or `partial`.
   - Create a corresponding 'Receipt' entry in the party's ledger automatically.
3. **Walk-in Support**: For walk-in bills, you can select the State manually to ensure correct GST calculation even for non-saved parties.
