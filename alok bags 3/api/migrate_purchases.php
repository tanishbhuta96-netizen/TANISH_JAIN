<?php
require_once 'config.php';

try {
    // Add type column to products if not exists
    $pdo->exec("
        SET @dbname = DATABASE();
        SET @tablename = 'products';
        SET @columnname = 'type';
        SET @preparedStatement = (SELECT IF(
          (
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
            WHERE
              (table_name = @tablename)
              AND (table_schema = @dbname)
              AND (column_name = @columnname)
          ) > 0,
          'SELECT 1',
          CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' ENUM(\\'finished\\',\\'raw\\') DEFAULT \\'finished\\';')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
    ");

    $pdo->exec("
    CREATE TABLE IF NOT EXISTS purchases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bill_no VARCHAR(50) NOT NULL,
      party_id INT NOT NULL,
      purchase_date DATE NOT NULL,
      due_date DATE DEFAULT NULL,
      subtotal DECIMAL(14,2) DEFAULT 0.00,
      discount DECIMAL(14,2) DEFAULT 0.00,
      tax_amount DECIMAL(14,2) DEFAULT 0.00,
      transport_charges DECIMAL(14,2) DEFAULT 0.00,
      extra_charges DECIMAL(14,2) DEFAULT 0.00,
      total DECIMAL(14,2) DEFAULT 0.00,
      paid DECIMAL(14,2) DEFAULT 0.00,
      status ENUM('paid','partial','unpaid','cancelled') DEFAULT 'unpaid',
      bill_image VARCHAR(255) DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
    ");

    $pdo->exec("
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      purchase_id INT NOT NULL,
      product_id INT NULL,
      description VARCHAR(200) DEFAULT '',
      qty DECIMAL(10,3) DEFAULT 1.000,
      unit VARCHAR(20) DEFAULT 'pcs',
      price DECIMAL(12,2) DEFAULT 0.00,
      discount_pct DECIMAL(5,2) DEFAULT 0.00,
      gst_rate DECIMAL(5,2) DEFAULT 18.00,
      amount DECIMAL(14,2) DEFAULT 0.00,
      tax_amount DECIMAL(14,2) DEFAULT 0.00,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
    ");

    $pdo->exec("
    CREATE TABLE IF NOT EXISTS purchase_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      purchase_id INT NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      method ENUM('cash','upi','bank') DEFAULT 'cash',
      paid_on DATE NOT NULL,
      note TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
    ");

    echo "Purchases tables migrated successfully.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
