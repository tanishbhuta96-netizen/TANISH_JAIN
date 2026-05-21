<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();
header('Content-Type: application/json');

/* ═══════════════════════════════════════════
   ALOK BAGS — Invoices API
   GET /api/invoices.php -> list all invoices
   GET /api/invoices.php?id=X -> get full invoice with items
   POST /api/invoices.php -> create invoice + items + ledger entry
   ═══════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];
    // Accept both ?id=X (from bill.html) and ?invoice_id=X
    $invoice_id = isset($_GET['id']) ? (int)$_GET['id'] : (isset($_GET['invoice_id']) ? (int)$_GET['invoice_id'] : null);

    switch ($method) {
        case 'GET':
            if ($invoice_id) {
                // Full invoice details for bill.html rendering
                $stmt = $pdo->prepare("
                    SELECT i.*,
                        COALESCE(IF(i.customer_type='walkin', i.walkin_name, p.name), 'Walk-in') AS party_name,
                        p.billing   AS party_billing,
                        p.gstin     AS party_gstin,
                        p.state     AS party_state_name
                    FROM invoices i
                    LEFT JOIN parties p ON i.party_id = p.id
                    WHERE i.id = ?
                ");
                $stmt->execute([$invoice_id]);
                $row = $stmt->fetch();

                if (!$row) {
                    jsonResponse(['error' => 'Invoice not found'], 404);
                }

                // Fetch line items with HSN from products table
                $itemStmt = $pdo->prepare("
                    SELECT ii.*,
                        COALESCE(p.hsn, '') AS hsn
                    FROM invoice_items ii
                    LEFT JOIN products p ON ii.product_id = p.id
                    WHERE ii.invoice_id = ?
                    ORDER BY ii.id ASC
                ");
                $itemStmt->execute([$invoice_id]);
                $items = $itemStmt->fetchAll();

                // Cast numeric fields
                foreach ($items as &$item) {
                    $item['qty']        = (float)$item['qty'];
                    $item['price']      = (float)$item['price'];
                    $item['amount']     = (float)$item['amount'];
                    $item['tax_amount'] = (float)$item['tax_amount'];
                    $item['gst_rate']   = (float)$item['gst_rate'];
                }

                // Fetch payment history
                $payStmt = $pdo->prepare("SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY paid_on ASC");
                $payStmt->execute([$invoice_id]);

                jsonResponse(array_merge($row, [
                    'total'      => (float)$row['total'],
                    'paid'       => (float)$row['paid'],
                    'tax_amount' => (float)$row['tax_amount'],
                    'subtotal'   => (float)$row['subtotal'],
                    'discount'   => (float)$row['discount'],
                    'items'      => $items,
                    'payments'   => $payStmt->fetchAll()
                ]));
            } else {
                // List from 'invoices' table
                $stmt = "SELECT i.*, IF(i.customer_type = 'walkin', i.walkin_name, p.name) as party_name 
                         FROM invoices i 
                         LEFT JOIN parties p ON i.party_id = p.id 
                         WHERE 1=1";
                $params = [];

                if (!empty($_GET['status']) && $_GET['status'] !== 'all') {
                    $stmt .= " AND i.status = ?";
                    $params[] = $_GET['status'];
                }
                if (!empty($_GET['party_id'])) {
                    $stmt .= " AND i.party_id = ?";
                    $params[] = (int)$_GET['party_id'];
                }
                if (!empty($_GET['from'])) {
                    $stmt .= " AND i.invoice_date >= ?";
                    $params[] = $_GET['from'];
                }
                if (!empty($_GET['to'])) {
                    $stmt .= " AND i.invoice_date <= ?";
                    $params[] = $_GET['to'];
                }

                $stmt .= " ORDER BY i.invoice_date DESC, i.id DESC";

                $sql = $pdo->prepare($stmt);
                $sql->execute($params);
                
                $rows = $sql->fetchAll();
                foreach ($rows as &$r) {
                    $r['subtotal']   = (float)$r['subtotal'];
                    $r['total']      = (float)$r['total'];
                    $r['paid']       = (float)$r['paid'];
                }
                jsonResponse($rows);
            }
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);

            $customerType = $data['customer_type'] ?? 'saved';
            $partyId = !empty($data['party_id']) ? (int)$data['party_id'] : null;

            if ($customerType === 'saved' && empty($partyId)) {
                jsonResponse(['error' => 'Valid party_id is required for saved customer'], 400);
            }
            if (empty($data['items']) || !is_array($data['items'])) {
                jsonResponse(['error' => 'Valid items are required'], 400);
            }

            $inputDate = $data['invoice_date'] ?? date('Y-m-d');
            // Generate Invoice Number if not provided
            $invoiceNo = $data['invoice_no'] ?? '';
            if (!$invoiceNo) {
                $year = date('Y', strtotime($inputDate));
                $stmt = $pdo->prepare("SELECT MAX(id) FROM invoices WHERE YEAR(invoice_date) = ?");
                $stmt->execute([$year]);
                $maxId = (int)$stmt->fetchColumn();
                $invoiceNo = "INV-{$year}-" . str_pad($maxId + 1, 3, "0", STR_PAD_LEFT);
            }

            $pdo->beginTransaction();

            $subtotal = 0;
            $discount = 0;
            $taxAmount = 0;
            $total = 0;
            
            $cgst = 0;
            $sgst = 0;
            $igst = 0;

            $billType = $data['bill_type'] ?? 'gst';
            $taxType  = $data['tax_type'] ?? 'cgst_sgst';

            // Recalculate everything on server side from items
            foreach ($data['items'] as $item) {
                $qty = (float)($item['qty'] ?? 1);
                $price = (float)($item['price'] ?? 0);
                $discPct = (float)($item['discount_pct'] ?? 0);
                $gstRate = (float)($item['gst_rate'] ?? 18);
                
                if ($billType === 'non_gst') {
                    $gstRate = 0;
                }

                $itemBase = $qty * $price;
                $itemDisc = $itemBase * ($discPct / 100);
                $itemTaxable = $itemBase - $itemDisc;
                $itemTax = $itemTaxable * ($gstRate / 100);

                $subtotal += $itemBase;
                $discount += $itemDisc;
                $taxAmount += $itemTax;
                $total += ($itemTaxable + $itemTax);
                
                if ($billType === 'gst') {
                    if ($taxType === 'igst') {
                        $igst += $itemTax;
                    } else {
                        $cgst += ($itemTax / 2);
                        $sgst += ($itemTax / 2);
                    }
                }
            }

            $paid = (float)($data['amount_received'] ?? 0);
            $status = 'unpaid';
            if ($paid >= $total) {
                $status = 'paid';
            } elseif ($paid > 0) {
                $status = 'partial';
            }

            // Insert invoice into invoices
            $stmt = $pdo->prepare("
                INSERT INTO invoices (
                    invoice_no, party_id, customer_type, walkin_name, walkin_phone, 
                    invoice_date, due_date, subtotal, discount, tax_amount, 
                    total, paid, status, bill_type, notes,
                    tax_type, party_state, cgst_amount, sgst_amount, igst_amount,
                    payment_mode, payment_note, payment_date
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $invoiceNo,
                $partyId,
                $customerType,
                $data['walkin_name'] ?? null,
                $data['walkin_phone'] ?? null,
                $inputDate,
                $data['due_date'] ?? null,
                $subtotal,
                $discount,
                $taxAmount,
                $total,
                $paid,
                $status,
                $billType,
                $data['notes'] ?? null,
                $taxType,
                $data['party_state'] ?? null,
                $cgst,
                $sgst,
                $igst,
                $data['payment_mode'] ?? 'pending',
                $data['payment_note'] ?? null,
                $data['payment_date'] ?? null
            ]);
            $invoiceId = $pdo->lastInsertId();

            // Insert ledger entry for Sales (Debit)
            $stmtTxn = $pdo->prepare("
                INSERT INTO transactions (party_id, txn_date, voucher, type, description, debit, credit, payment_method, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmtTxn->execute([
                $partyId,
                $inputDate,
                $invoiceNo,
                'Sales Invoice',
                'Invoice generated',
                $total,
                0,
                $data['payment_mode'] ?? 'pending',
                $data['payment_note'] ?? null
            ]);

            // Insert ledger entry for Payment if any (Credit)
            if ($paid > 0) {
                $stmtTxn->execute([
                    $partyId,
                    $data['payment_date'] ?? $inputDate,
                    $invoiceNo,
                    'Receipt',
                    'Payment received at billing (' . ($data['payment_mode'] ?? 'cash') . ')',
                    0,
                    $paid,
                    $data['payment_mode'] ?? 'cash',
                    $data['payment_note'] ?? null
                ]);
            }

            // Insert items
            $itemStmt = $pdo->prepare("
                INSERT INTO invoice_items (invoice_id, product_id, description, qty, unit, price, discount_pct, gst_rate, amount, tax_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            foreach ($data['items'] as $item) {
                $qty = (float)($item['qty'] ?? 1);
                $price = (float)($item['price'] ?? 0);
                $discPct = (float)($item['discount_pct'] ?? 0);
                $gstRate = (float)($item['gst_rate'] ?? 18);

                if ($billType === 'non_gst') {
                    $gstRate = 0;
                }

                $itemBase = $qty * $price;
                $itemDisc = $itemBase * ($discPct / 100);
                $itemTaxable = $itemBase - $itemDisc;
                $itemTax = $itemTaxable * ($gstRate / 100);

                $itemStmt->execute([
                    $invoiceId,
                    !empty($item['product_id']) ? (int)$item['product_id'] : null,
                    $item['description'] ?? '',
                    $qty,
                    $item['unit'] ?? 'pcs',
                    $price,
                    $discPct,
                    $gstRate,
                    $itemTaxable,
                    $itemTax
                ]);
            }

            // Transaction commit
            $pdo->commit();

            jsonResponse(['id' => $invoiceId, 'invoice_no' => $invoiceNo, 'message' => 'Invoice created']);
            break;

        default:
            jsonResponse(['error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonResponse([
        'error' => true, 
        'message' => $e->getMessage()
    ], 500);
}
