<?php
/* ═══════════════════════════════════════════
   ALOK BAGS — Transactions API (Upgraded)

   GET    /api/transactions.php?party_id=1
          &from=2026-01-01&to=2026-12-31
          &type=payment_received
          &ref=INV-001
          → list with running balance, newest first

   POST   /api/transactions.php
          → create transaction (payment_received /
            payment_given / sale / purchase / etc.)

   DELETE /api/transactions.php?id=1
          → delete transaction
   ═══════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$method  = $_SERVER['REQUEST_METHOD'];
$id      = isset($_GET['id'])       ? (int)$_GET['id']   : null;
$partyId = isset($_GET['party_id']) ? (int)$_GET['party_id'] : null;
$from    = isset($_GET['from'])     ? $_GET['from'] : null;
$to      = isset($_GET['to'])       ? $_GET['to']   : null;
$type    = isset($_GET['type'])     ? trim($_GET['type']) : null;
$ref     = isset($_GET['ref'])      ? trim($_GET['ref'])  : null;

switch ($method) {

    /* ══════════════════════════════
       GET — List transactions for a party
       with running balance (newest first)
       ══════════════════════════════ */
    case 'GET':
        if (!$partyId) jsonResponse(['error' => 'party_id is required'], 400);

        // Fetch opening balance
        $pStmt = $pdo->prepare('SELECT opening_balance FROM parties WHERE id = ?');
        $pStmt->execute([$partyId]);
        $party = $pStmt->fetch();
        if (!$party) jsonResponse(['error' => 'Party not found'], 404);

        $opening = (float)$party['opening_balance'];

        // Build query — ASC for running balance calculation
        $sql    = 'SELECT id, txn_date, voucher, type, description,
                          debit, credit, payment_mode, payment_date, payment_note, created_at
                   FROM transactions WHERE party_id = ?';
        $params = [$partyId];

        if ($from) { $sql .= ' AND txn_date >= ?'; $params[] = $from; }
        if ($to)   { $sql .= ' AND txn_date <= ?'; $params[] = $to;   }
        if ($type && $type !== 'all') { $sql .= ' AND type = ?'; $params[] = $type; }
        if ($ref)  { $sql .= ' AND voucher LIKE ?'; $params[] = "%$ref%"; }

        $sql .= ' ORDER BY txn_date ASC, id ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        // Calculate running balance for each row
        $running = $opening;
        foreach ($rows as &$r) {
            $r['debit']          = (float)$r['debit'];
            $r['credit']         = (float)$r['credit'];
            $running            += $r['debit'] - $r['credit'];
            $r['running_balance'] = $running;
            $r['balance_dir']    = $running >= 0 ? 'Dr' : 'Cr';
        }
        unset($r);

        // Reverse for newest-first display
        $rows = array_reverse($rows);

        // Totals
        $totalDebit  = array_sum(array_column($rows, 'debit'));
        $totalCredit = array_sum(array_column($rows, 'credit'));
        $closing     = $running;

        // Payment status
        $status = 'clear';
        if ($closing > 0)  $status = 'to_get';
        if ($closing < 0)  $status = 'to_give';

        jsonResponse([
            'opening_balance' => $opening,
            'total_debit'     => $totalDebit,
            'total_credit'    => $totalCredit,
            'closing_balance' => $closing,
            'closing_dir'     => $closing >= 0 ? 'Dr' : 'Cr',
            'payment_status'  => $status,
            'transactions'    => $rows,
        ]);
        break;

    /* ══════════════════════════════
       POST — Create a transaction
       ══════════════════════════════ */
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data || empty($data['party_id'])) {
            jsonResponse(['error' => 'party_id is required'], 400);
        }
        if (empty($data['voucher'])) {
            // Auto-generate voucher for payment entries
            $data['voucher'] = strtoupper(substr($data['type'] ?? 'TXN', 0, 3))
                             . '-' . date('ymdHis');
        }

        $debit  = (float)($data['debit']  ?? 0);
        $credit = (float)($data['credit'] ?? 0);

        if ($debit === 0.0 && $credit === 0.0) {
            jsonResponse(['error' => 'Debit or credit amount is required'], 400);
        }

        // Validate payment_method
        $validMethods = ['cash', 'upi', 'bank', null, ''];
        $payMethod    = isset($data['payment_method']) ? strtolower($data['payment_method']) : null;
        if (!in_array($payMethod, $validMethods, true)) {
            jsonResponse(['error' => 'Invalid payment_method'], 400);
        }
        if ($payMethod === '') $payMethod = null;

        $stmt = $pdo->prepare(
            'INSERT INTO transactions
               (party_id, txn_date, voucher, type, description, debit, credit, payment_mode, payment_date, payment_note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            (int)$data['party_id'],
            $data['txn_date']       ?? date('Y-m-d'),
            $data['voucher'],
            $data['type']           ?? 'payment_received',
            $data['description']    ?? '',
            $debit,
            $credit,
            $data['payment_mode']   ?? null,
            $data['payment_date']   ?? ($data['txn_date'] ?? date('Y-m-d')),
            $data['payment_note']   ?? null,
        ]);

        $newId = $pdo->lastInsertId();
        jsonResponse(['id' => (int)$newId, 'message' => 'Transaction created'], 201);
        break;

    /* ══════════════════════════════
       DELETE — Remove a transaction
       ══════════════════════════════ */
    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'Transaction id required'], 400);

        $stmt = $pdo->prepare('DELETE FROM transactions WHERE id = ?');
        $stmt->execute([$id]);

        jsonResponse(['message' => 'Transaction deleted']);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
