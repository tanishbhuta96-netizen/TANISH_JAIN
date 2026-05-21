ALTER TABLE parties ADD COLUMN state VARCHAR(100) DEFAULT 'Rajasthan';
ALTER TABLE parties ADD COLUMN city VARCHAR(100) NULL;
ALTER TABLE parties ADD COLUMN pincode VARCHAR(10) NULL;

ALTER TABLE invoices ADD COLUMN tax_type ENUM('cgst_sgst','igst') DEFAULT 'cgst_sgst';
ALTER TABLE invoices ADD COLUMN party_state VARCHAR(100) NULL;

ALTER TABLE invoices ADD COLUMN cgst_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN sgst_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN igst_amount DECIMAL(10,2) DEFAULT 0;

ALTER TABLE invoices ADD COLUMN payment_mode ENUM('pending','cash','upi','cheque','bank_transfer') DEFAULT 'pending';
ALTER TABLE invoices ADD COLUMN payment_note VARCHAR(255) NULL;
ALTER TABLE invoices ADD COLUMN payment_date DATE NULL;
