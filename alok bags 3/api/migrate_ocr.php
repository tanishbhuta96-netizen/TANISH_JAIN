<?php
require_once 'config.php';

try {
    $pdo->exec("
        ALTER TABLE purchases 
        ADD COLUMN ocr_raw_text TEXT DEFAULT NULL,
        ADD COLUMN ai_structured_data TEXT DEFAULT NULL;
    ");
    echo "Purchases table updated with OCR columns successfully.";
} catch (Exception $e) {
    // Ignore if already exists
    echo "Note: " . $e->getMessage();
}
?>
