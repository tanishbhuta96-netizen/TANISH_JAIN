<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

/* ═══════════════════════════════════════════
   ALOK BAGS — Payments API
   Unified endpoint for managing Receipts and Payments
   ═══════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Fetch all payment transactions (type IN ('Receipt', 'Payment'))
        $sql = "SELECT t.*, p.name as party_name, p.type as party_type 
                FROM transactions t 
                JOIN parties p ON t.party_id = p.id 
                WHERE t.type IN ('Receipt', 'Payment') 
                ORDER BY t.txn_date DESC, t.id DESC";
        $stmt = $pdo->query($sql);
        $payments = $stmt->fetchAll();
        jsonResponse($payments);
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        
        $partyId = isset($data['party_id']) ? (int)$data['party_id'] : null;
        $type = $data['type'] ?? null; // 'Receipt' (In) or 'Payment' (Out)
        $amount = isset($data['amount']) ? (float)$data['amount'] : 0;
        $date = $data['txn_date'] ?? date('Y-m-d');
        $methodType = $data['payment_method'] ?? 'cash';
        $note = $data['note'] ?? '';
        $reference = $data['reference'] ?? '';
        
        $linkedDocId = isset($data['linked_id']) ? (int)$data['linked_id'] : null;

        if (!$partyId || $amount <= 0 || !$type) {
            jsonResponse(['error' => 'Invalid input data'], 400);
        }

        try {
            $pdo->beginTransaction();

            // Depending on the transaction table semantics:
            // A Receipt from a customer REDUCES their balance, so we CREDIT their account.
            // A Payment to a supplier REDUCES what we owe them, so we DEBIT their account.
            // But wait, the ledger expects:
            // For Customer: Opening Balance > 0. Sales Invoice -> Debit. Receipt -> Credit.
            // For Supplier: Opening Balance < 0. Purchase Invoice -> Credit. Payment -> Debit.
            // So a Receipt (In) means Credit = amount.
            // A Payment (Out) means Debit = amount.
            $debit = ($type === 'Payment') ? $amount : 0;
            $credit = ($type === 'Receipt') ? $amount : 0;

            $txnDesc = $type === 'Receipt' ? 'Payment Received' : 'Payment Given';
            if ($reference) $txnDesc .= " Ref: $reference";
            if ($note) $txnDesc .= " - $note";

            // 1. Insert into transactions with new columns
            $prefix = $type === 'Receipt' ? 'RCP' : 'PAY';
            $voucher = $prefix . "-" . strtoupper(substr(md5(uniqid()), 0, 6));
            
            $txnStmt = $pdo->prepare("
                INSERT INTO transactions (party_id, txn_date, voucher, type, description, debit, credit, payment_mode, payment_date, payment_note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $txnStmt->execute([
                $partyId, $date, $voucher, $type, $txnDesc, $debit, $credit, $methodType, $date, $note
            ]);
            $txnId = $pdo->lastInsertId();

            // 2. Link to invoice or purchase if provided
            if ($linkedDocId) {
                if ($type === 'Receipt') {
                    // It's against an invoice
                    $pdo->prepare("INSERT INTO invoice_payments (invoice_id, amount, method, paid_on, note) VALUES (?,?,?,?,?)")
                        ->execute([$linkedDocId, $amount, $methodType, $date, $note]);
                    
                    $pdo->prepare("UPDATE invoices SET paid = paid + ? WHERE id = ?")->execute([$amount, $linkedDocId]);
                    
                    // Update invoice status
                    $stmt = $pdo->prepare("SELECT total, paid FROM invoices WHERE id = ?");
                    $stmt->execute([$linkedDocId]);
                    $inv = $stmt->fetch();
                    $status = 'unpaid';
                    if ($inv['paid'] >= $inv['total'] - 0.01) $status = 'paid';
                    elseif ($inv['paid'] > 0.01) $status = 'partial';
                    $pdo->prepare("UPDATE invoices SET status = ? WHERE id = ?")->execute([$status, $linkedDocId]);

                } else if ($type === 'Payment') {
                    // It's against a purchase
                    $pdo->prepare("INSERT INTO purchase_payments (purchase_id, amount, method, paid_on, note) VALUES (?,?,?,?,?)")
                        ->execute([$linkedDocId, $amount, $methodType, $date, $note]);
                    
                    $pdo->prepare("UPDATE purchases SET paid = paid + ? WHERE id = ?")->execute([$amount, $linkedDocId]);
                    
                    // Update purchase status
                    $stmt = $pdo->prepare("SELECT total, paid FROM purchases WHERE id = ?");
                    $stmt->execute([$linkedDocId]);
                    $pur = $stmt->fetch();
                    $status = 'unpaid';
                    if ($pur['paid'] >= $pur['total'] - 0.01) $status = 'paid';
                    elseif ($pur['paid'] > 0.01) $status = 'partial';
                    $pdo->prepare("UPDATE purchases SET status = ? WHERE id = ?")->execute([$status, $linkedDocId]);
                }
            }

            $pdo->commit();
            jsonResponse(['message' => 'Payment recorded successfully', 'id' => $txnId]);

        } catch (Exception $e) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Failed to record payment: ' . $e->getMessage()], 500);
        }
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
?>
