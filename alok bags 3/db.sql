-- ═══════════════════════════════════════════
-- ALOK BAGS — Ledger Database Schema
-- ═══════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS alok_bags_ledger
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE alok_bags_ledger;

-- ── PARTIES TABLE ──
CREATE TABLE IF NOT EXISTS parties (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  type        ENUM('customer','supplier','bank','expense') NOT NULL DEFAULT 'customer',
  contact     VARCHAR(100) DEFAULT '',
  mobile      VARCHAR(20)  DEFAULT '',
  whatsapp    VARCHAR(20)  DEFAULT '',
  email       VARCHAR(100) DEFAULT '',
  billing     VARCHAR(300) DEFAULT '',
  shipping    VARCHAR(300) DEFAULT '',
  gstin       VARCHAR(20)  DEFAULT '',
  pan         VARCHAR(15)  DEFAULT '',
  terms       VARCHAR(50)  DEFAULT 'Net 30 days',
  credit_limit VARCHAR(20) DEFAULT '',
  opening_balance DECIMAL(14,2) DEFAULT 0.00,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── TRANSACTIONS TABLE ──
CREATE TABLE IF NOT EXISTS transactions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  party_id    INT NOT NULL,
  txn_date    DATE NOT NULL,
  voucher     VARCHAR(30) NOT NULL,
  type        VARCHAR(30) NOT NULL,
  description VARCHAR(200) DEFAULT '',
  debit       DECIMAL(14,2) DEFAULT 0.00,
  credit      DECIMAL(14,2) DEFAULT 0.00,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── SEED DATA: PARTIES ──
INSERT INTO parties (name, type, contact, mobile, whatsapp, email, billing, shipping, gstin, pan, terms, credit_limit, opening_balance) VALUES
('Ramesh Traders',     'customer', 'Mr. Ramesh Gupta',   '+91 98765 43210', '+91 98765 43210', 'ramesh@rameshtraders.com',    '45, Industrial Area, Phase 2, Jaipur, Rajasthan — 302013', 'Same as billing', '08AABCT1234A1Z5', 'AABCT1234A', 'Net 30 days',    '₹1,00,000',  0),
('Steel Hub Pvt Ltd',  'supplier', 'Mr. Arvind Mehta',   '+91 99887 76655', '+91 99887 76655', 'arvind@steelhub.co.in',       '12, MIDC Industrial Estate, Pune, Maharashtra — 411026',   'Same as billing', '27BBBCS5678B2Z9', 'BBBCS5678B', 'Net 45 days',    '₹2,50,000',  0),
('HDFC Bank',          'bank',     'Branch Manager',     '+91 22 6160 0000', '',               'support@hdfcbank.com',        'HDFC Bank, MG Road Branch, Jaipur — 302001',               'Same as billing', 'N/A',             'N/A',        'Current Account','N/A',       250000),
('Shyam Packaging',    'supplier', 'Mr. Shyam Agarwal',  '+91 94140 55667', '+91 94140 55667', 'shyam@shyampack.com',         '78, Sitapura Industrial Area, Jaipur, Rajasthan — 302022', 'Same as billing', '08CCCSP7890C1Z3', 'CCCSP7890C', 'Net 15 days',    '₹50,000',    0),
('Priya Industries',   'customer', 'Ms. Priya Sharma',   '+91 98290 11223', '+91 98290 11223', 'priya@priyaindustries.in',     '101, Mansarovar Industrial Area, Jaipur, Rajasthan — 302020','201, Warehouse Zone, Sanganer — 302029','08DDDPI4567D1Z7','DDDPI4567D','Net 30 days','₹2,00,000',0),
('Transport Expenses', 'expense',  'Accounts Dept.',     '',                '',                '',                             'Internal',                                                  'N/A',             'N/A',             'N/A',        'Immediate',      'N/A',       0);

-- ── SEED DATA: TRANSACTIONS ──
INSERT INTO transactions (party_id, txn_date, voucher, type, description, debit, credit) VALUES
-- Ramesh Traders
(1, '2026-04-01', 'INV-1041', 'Sales Invoice', 'Product supply',    25000, 0),
(1, '2026-04-05', 'RCP-201',  'Receipt',       'Payment received',  0,     10000),
(1, '2026-04-12', 'INV-1055', 'Sales Invoice', 'Product supply',    18000, 0),
(1, '2026-04-18', 'DN-012',   'Debit Note',    'Rate difference',   2500,  0),
(1, '2026-04-22', 'RCP-218',  'Receipt',       'Cheque received',   0,     35500),
(1, '2026-04-28', 'INV-1071', 'Sales Invoice', 'New order supply',  42500, 0),
-- Steel Hub Pvt Ltd
(2, '2026-04-03', 'PUR-401',  'Purchase',      'Steel sheets',      0,     45000),
(2, '2026-04-10', 'PMT-105',  'Payment',       'NEFT transfer',     30000, 0),
(2, '2026-04-20', 'PUR-419',  'Purchase',      'Steel rods',        0,     3200),
-- HDFC Bank
(3, '2026-04-01', 'DEP-01',   'Receipt',       'Opening deposit',   250000,0),
(3, '2026-04-10', 'RCP-201',  'Receipt',       'Customer payment',  10000, 0),
(3, '2026-04-15', 'PMT-105',  'Payment',       'Vendor payment',    0,     30000),
(3, '2026-04-22', 'RCP-218',  'Receipt',       'Cheque clearance',  35500, 0),
(3, '2026-04-25', 'PMT-112',  'Payment',       'Salary payout',     0,     18500),
(3, '2026-04-28', 'INT-04',   'Receipt',       'Interest credited', 37000, 0),
-- Shyam Packaging
(4, '2026-04-05', 'PUR-405',  'Purchase',      'Packaging material',0,     14400),
(4, '2026-04-18', 'PMT-108',  'Payment',       'Partial payment',   5000,  0),
-- Priya Industries
(5, '2026-04-02', 'INV-1042', 'Sales Invoice', 'Bulk bag supply',   35000, 0),
(5, '2026-04-14', 'INV-1058', 'Sales Invoice', 'Custom order',      42000, 0),
(5, '2026-04-20', 'RCP-210',  'Receipt',       'Online payment',    0,     10000),
-- Transport Expenses
(6, '2026-04-08', 'EXP-031',  'Payment',       'Freight charges',   5200,  0),
(6, '2026-04-16', 'EXP-037',  'Payment',       'Local transport',   3100,  0),
(6, '2026-04-27', 'EXP-044',  'Payment',       'Courier charges',   4000,  0);

-- ── PRODUCTS TABLE ──
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  hsn VARCHAR(20) DEFAULT '',
  unit VARCHAR(20) DEFAULT 'pcs',
  price DECIMAL(12,2) DEFAULT 0.00,
  gst_rate DECIMAL(5,2) DEFAULT 18.00,
  stock INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── INVOICES TABLE ──
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_no VARCHAR(30) UNIQUE NOT NULL,
  party_id INT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE DEFAULT NULL,
  subtotal DECIMAL(14,2) DEFAULT 0.00,
  discount DECIMAL(14,2) DEFAULT 0.00,
  tax_amount DECIMAL(14,2) DEFAULT 0.00,
  total DECIMAL(14,2) DEFAULT 0.00,
  paid DECIMAL(14,2) DEFAULT 0.00,
  status ENUM('paid','partial','unpaid','cancelled') DEFAULT 'unpaid',
  bill_type ENUM('gst','non_gst') DEFAULT 'gst',
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── INVOICE ITEMS TABLE ──
CREATE TABLE IF NOT EXISTS invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  product_id INT NULL,
  description VARCHAR(200) DEFAULT '',
  qty DECIMAL(10,3) DEFAULT 1.000,
  unit VARCHAR(20) DEFAULT 'pcs',
  price DECIMAL(12,2) DEFAULT 0.00,
  discount_pct DECIMAL(5,2) DEFAULT 0.00,
  gst_rate DECIMAL(5,2) DEFAULT 18.00,
  amount DECIMAL(14,2) DEFAULT 0.00,
  tax_amount DECIMAL(14,2) DEFAULT 0.00,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── INVOICE PAYMENTS TABLE ──
CREATE TABLE IF NOT EXISTS invoice_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  method ENUM('cash','upi','bank','cheque') DEFAULT 'cash',
  paid_on DATE NOT NULL,
  note TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── SEED DATA: PRODUCTS ──
INSERT INTO products (name, hsn, unit, price, gst_rate, stock) VALUES
('D-Cut Non Woven Bag (10x14)', '3923', 'kg', 120.00, 18.00, 500),
('W-Cut Non Woven Bag (12x16)', '3923', 'kg', 135.00, 18.00, 300),
('Loop Handle Bag (14x18)', '3923', 'kg', 150.00, 18.00, 200),
('BOPP Laminated Bag (16x20)', '3923', 'pcs', 18.50, 18.00, 1500),
('Box Bag with Zipper (12x12x6)', '4202', 'pcs', 45.00, 18.00, 400);
