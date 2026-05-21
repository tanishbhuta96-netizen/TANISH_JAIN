<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {
    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare('SELECT p.*, pa.name as party_name FROM purchases p JOIN parties pa ON p.party_id = pa.id WHERE p.id = ?');
            $stmt->execute([$id]);
            $purchase = $stmt->fetch();
            if (!$purchase) jsonResponse(['error'=>'Not found'],404);

            $iStmt = $pdo->prepare('SELECT * FROM purchase_items WHERE purchase_id = ?');
            $iStmt->execute([$id]);
            $purchase['items'] = $iStmt->fetchAll();

            $pStmt = $pdo->prepare('SELECT * FROM purchase_payments WHERE purchase_id = ? ORDER BY paid_on DESC');
            $pStmt->execute([$id]);
            $purchase['payments'] = $pStmt->fetchAll();

            jsonResponse($purchase);
        } else {
            $sql = 'SELECT p.*, pa.name as party_name FROM purchases p JOIN parties pa ON p.party_id = pa.id ORDER BY p.purchase_date DESC, p.id DESC';
            $stmt = $pdo->query($sql);
            $purchases = $stmt->fetchAll();
            jsonResponse($purchases);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);

        if ($action === 'pay') {
            if (!$id) jsonResponse(['error'=>'id required'],400);
            $amount = (float)($data['amount'] ?? 0);
            if ($amount <= 0) jsonResponse(['error'=>'invalid amount'],400);

            try {
                $pdo->beginTransaction();

                $stmt = $pdo->prepare('INSERT INTO purchase_payments (purchase_id, amount, method, paid_on, note) VALUES (?,?,?,?,?)');
                $stmt->execute([$id, $amount, $data['method'] ?? 'cash', $data['paid_on'] ?? date('Y-m-d'), $data['note'] ?? '']);

                // update purchase
                $uStmt = $pdo->prepare('UPDATE purchases SET paid = paid + ? WHERE id = ?');
                $uStmt->execute([$amount, $id]);

                // get total and paid to update status
                $sStmt = $pdo->prepare('SELECT total, paid, party_id FROM purchases WHERE id = ?');
                $sStmt->execute([$id]);
                $p = $sStmt->fetch();

                $status = 'unpaid';
                if ($p['paid'] >= $p['total']) $status = 'paid';
                elseif ($p['paid'] > 0) $status = 'partial';

                $pdo->prepare('UPDATE purchases SET status = ? WHERE id = ?')->execute([$status, $id]);

                // Record in ledger (Payment Given to Supplier -> Debit)
                $pdo->prepare('INSERT INTO transactions (party_id, txn_date, voucher, type, description, debit, credit) VALUES (?,?,?,?,?,?,?)')
                    ->execute([
                        $p['party_id'],
                        $data['paid_on'] ?? date('Y-m-d'),
                        'PAY-' . date('ymdHis'),
                        'Payment',
                        'Payment against purchase #' . $id,
                        $amount,
                        0
                    ]);

                $pdo->commit();
                jsonResponse(['message'=>'Payment added']);
            } catch (Exception $e) {
                $pdo->rollBack();
                jsonResponse(['error'=>$e->getMessage()], 500);
            }
            break;
        }

        // Create new purchase
        try {
            $pdo->beginTransaction();

            $partyId = $data['party_id'];
            $billNo = $data['bill_no'];
            $date = $data['purchase_date'] ?? date('Y-m-d');
            
            $stmt = $pdo->prepare('INSERT INTO purchases (bill_no, party_id, purchase_date, subtotal, tax_amount, transport_charges, extra_charges, total, paid, status) VALUES (?,?,?,?,?,?,?,?,?,?)');
            $subtotal = (float)$data['subtotal'];
            $tax = (float)$data['tax_amount'];
            $transport = (float)($data['transport_charges'] ?? 0);
            $extra = (float)($data['extra_charges'] ?? 0);
            $total = (float)$data['total'];
            $paid = (float)($data['paid'] ?? 0);
            
            $status = 'unpaid';
            if ($paid >= $total) $status = 'paid';
            elseif ($paid > 0) $status = 'partial';

            $billImagePath = null;
            if (!empty($data['bill_image'])) {
                $base64 = $data['bill_image'];
                if (preg_match('/^data:(image\/\w+|application\/pdf);base64,/', $base64, $type)) {
                    $base64 = substr($base64, strpos($base64, ',') + 1);
                    $type = strtolower($type[1]);
                    
                    $ext = 'jpg';
                    if (strpos($type, 'png') !== false) $ext = 'png';
                    elseif (strpos($type, 'pdf') !== false) $ext = 'pdf';
                    
                    $base64 = str_replace(' ', '+', $base64);
                    $fileData = base64_decode($base64);
                    
                    $uploadDir = __DIR__ . '/../uploads/';
                    if (!is_dir($uploadDir)) {
                        mkdir($uploadDir, 0777, true);
                    }
                    
                    $filename = 'bill_' . time() . '_' . rand(100, 999) . '.' . $ext;
                    file_put_contents($uploadDir . $filename, $fileData);
                    $billImagePath = 'uploads/' . $filename;
                }
            }

            $ocrRaw = $data['ocr_raw_text'] ?? null;
            $aiData = $data['ai_structured_data'] ?? null;

            $stmt = $pdo->prepare('INSERT INTO purchases (bill_no, party_id, purchase_date, subtotal, tax_amount, transport_charges, extra_charges, total, paid, status, bill_image, ocr_raw_text, ai_structured_data) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([
                $billNo, $partyId, $date,
                $subtotal, $tax, $transport, $extra, $total, $paid, $status, $billImagePath, $ocrRaw, $aiData
            ]);
            $purchaseId = $pdo->lastInsertId();

            // Insert items
            if (!empty($data['items'])) {
                $iStmt = $pdo->prepare('INSERT INTO purchase_items (purchase_id, product_id, description, qty, unit, price, gst_rate, amount, tax_amount) VALUES (?,?,?,?,?,?,?,?,?)');
                $stockStmt = $pdo->prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
                
                foreach ($data['items'] as $item) {
                    $iStmt->execute([
                        $purchaseId,
                        $item['product_id'] ?? null,
                        $item['description'] ?? '',
                        $item['qty'],
                        $item['unit'] ?? 'pcs',
                        $item['price'],
                        $item['gst_rate'] ?? 0,
                        $item['amount'],
                        $item['tax_amount'] ?? 0
                    ]);

                    if (!empty($item['product_id'])) {
                        $stockStmt->execute([$item['qty'], $item['product_id']]);
                    }
                }
            }

            // Ledger entry for Purchase (Credit Supplier)
            $pdo->prepare('INSERT INTO transactions (party_id, txn_date, voucher, type, description, debit, credit) VALUES (?,?,?,?,?,?,?)')
                ->execute([
                    $partyId,
                    $date,
                    $billNo,
                    'Purchase',
                    'Purchase Bill ' . $billNo,
                    0,
                    $total
                ]);

            // If initial payment was made
            if ($paid > 0) {
                $pdo->prepare('INSERT INTO purchase_payments (purchase_id, amount, paid_on, note) VALUES (?,?,?,?)')
                    ->execute([$purchaseId, $paid, $date, 'Initial payment']);
                    
                $pdo->prepare('INSERT INTO transactions (party_id, txn_date, voucher, type, description, debit, credit) VALUES (?,?,?,?,?,?,?)')
                    ->execute([
                        $partyId,
                        $date,
                        'PAY-' . date('ymdHis'),
                        'Payment',
                        'Payment for Purchase Bill ' . $billNo,
                        $paid,
                        0
                    ]);
            }

            $pdo->commit();
            jsonResponse(['id'=>$purchaseId, 'message'=>'Purchase created']);
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonResponse(['error'=>$e->getMessage()], 500);
        }
        break;

    default:
        jsonResponse(['error'=>'Method not allowed'], 405);
}
?>
