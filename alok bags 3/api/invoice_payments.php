<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

/* ═══════════════════════════════════════════
   ALOK BAGS — Invoice Payments API
   POST /api/invoice_payments.php -> Record payment against an invoice
   ═══════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$data = json_decode(file_get_contents('php://input'), true);

if (empty($data['invoice_id']) || empty($data['amount'])) {
    jsonResponse(['error' => 'invoice_id and amount are required'], 400);
}

$invoiceId = (int)$data['invoice_id'];
$amount = (float)$data['amount'];
$methodType = $data['method'] ?? 'cash';
$date = $data['paid_on'] ?? date('Y-m-d');
$note = $data['note'] ?? '';

try {
    $pdo->beginTransaction();

    // 1. Get invoice details
    $stmt = $pdo->prepare("SELECT party_id, invoice_no, total, paid FROM invoices WHERE id = ?");
    $stmt->execute([$invoiceId]);
    $invoice = $stmt->fetch();

    if (!$invoice) {
        throw new Exception("Invoice not found");
    }

    // 2. Insert into invoice_payments table
    $payStmt = $pdo->prepare("
        INSERT INTO invoice_payments (invoice_id, amount, method, paid_on, note)
        VALUES (?, ?, ?, ?, ?)
    ");
    $payStmt->execute([
        $invoiceId,
        $amount,
        $methodType,
        $date,
        $note
    ]);

    // 3. Update invoice paid amount and status
    $newPaid = (float)$invoice['paid'] + $amount;
    $total = (float)$invoice['total'];
    $status = 'partial';
    
    if ($newPaid >= $total - 0.01) {
        $status = 'paid';
    } else if ($newPaid <= 0.01) {
        $status = 'unpaid';
    }

    $updateStmt = $pdo->prepare("UPDATE invoices SET paid = ?, status = ? WHERE id = ?");
    $updateStmt->execute([$newPaid, $status, $invoiceId]);

    // 4. Create Ledger transaction (Receipt)
    $txnDesc = "Payment received for invoice {$invoice['invoice_no']}";
    if ($note) {
        $txnDesc .= " - " . $note;
    }
    
    $voucher = "RCP-" . strtoupper(substr(md5(uniqid()), 0, 6));

    $txnStmt = $pdo->prepare("
        INSERT INTO transactions (party_id, txn_date, voucher, type, description, debit, credit, payment_mode, payment_date, payment_note)
        VALUES (?, ?, ?, 'Receipt', ?, 0, ?, ?, ?, ?)
    ");
    $txnStmt->execute([
        (int)$invoice['party_id'],
        $date,
        $voucher,
        $txnDesc,
        $amount,
        $data['payment_mode'] ?? $methodType,
        $date,
        $data['payment_note'] ?? $note
    ]);

    $pdo->commit();
    jsonResponse(['message' => 'Payment recorded successfully', 'status' => $status]);

} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Failed to record payment: ' . $e->getMessage()], 500);
}
