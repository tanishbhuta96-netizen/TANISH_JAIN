<?php
/**
 * invoice-save.php - Core Logic
 * Integrated into api/invoices.php POST method
 */

// 1. Calculate Split GST based on Tax Type
$subtotal = 0; $taxAmount = 0; $total = 0;
$cgst = 0; $sgst = 0; $igst = 0;
$taxType = $data['tax_type'] ?? 'cgst_sgst';

foreach ($data['items'] as $item) {
    $qty = (float)$item['qty'];
    $price = (float)$item['price'];
    $disc = (float)$item['discount_pct'];
    $gst = (float)$item['gst_rate'];
    
    $rowTaxable = ($qty * $price) * (1 - ($disc / 100));
    $rowTax = $rowTaxable * ($gst / 100);
    
    $taxAmount += $rowTax;
    $total += ($rowTaxable + $rowTax);
    
    if ($taxType === 'igst') {
        $igst += $rowTax;
    } else {
        $cgst += ($rowTax / 2);
        $sgst += ($rowTax / 2);
    }
}

// 2. Handle Payment Status
$paid = (float)($data['amount_received'] ?? 0);
$status = 'unpaid';
if ($paid >= $total) $status = 'paid';
elseif ($paid > 0) $status = 'partial';

// 3. Database Insertion (PDO)
$sql = "INSERT INTO invoices (
    invoice_no, party_id, customer_type, walkin_name, walkin_phone, 
    invoice_date, due_date, total, paid, status, 
    tax_type, party_state, cgst_amount, sgst_amount, igst_amount,
    payment_mode, payment_note, payment_date
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

$stmt = $pdo->prepare($sql);
$stmt->execute([
    $invoiceNo, $partyId, $customerType, $walkinName, $walkinPhone,
    $invoiceDate, $dueDate, $total, $paid, $status,
    $taxType, $partyState, $cgst, $sgst, $igst,
    $paymentMode, $paymentNote, $paymentDate
]);

// 4. Ledger (Transactions) Entry
// Debit Sales
$stmtTxn = $pdo->prepare("INSERT INTO transactions (party_id, txn_date, voucher, type, debit, credit) VALUES (?, ?, ?, ?, ?, ?)");
$stmtTxn->execute([$partyId, $invoiceDate, $invoiceNo, 'Sales Invoice', $total, 0]);

// Credit Payment (if any)
if ($paid > 0) {
    $stmtTxn->execute([$partyId, $paymentDate, $invoiceNo, 'Receipt', 0, $paid]);
}
