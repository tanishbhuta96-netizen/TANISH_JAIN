-- Make party_id nullable for Walk-in bills
ALTER TABLE invoices MODIFY party_id INT NULL;

-- Add Walk-in specific columns to invoices
ALTER TABLE invoices ADD COLUMN customer_type ENUM('saved','walkin') DEFAULT 'saved';
ALTER TABLE invoices ADD COLUMN walkin_name VARCHAR(255) NULL;
ALTER TABLE invoices ADD COLUMN walkin_phone VARCHAR(20) NULL;

-- Make party_id nullable in transactions for walk-in bills
ALTER TABLE transactions MODIFY party_id INT NULL;

-- Add product columns for autocomplete
ALTER TABLE products ADD COLUMN aliases VARCHAR(255) DEFAULT '';
ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Add verification to parties
ALTER TABLE parties ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
