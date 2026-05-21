<?php
/* ═══════════════════════════════════════════
   ALOK BAGS — Parties API
   GET  /api/parties.php          → list all (with balances)
   GET  /api/parties.php?id=1     → single party + transactions
   POST /api/parties.php          → create party
   PUT  /api/parties.php?id=1     → update party
   DELETE /api/parties.php?id=1   → delete party
   ═══════════════════════════════════════════ */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;
$filter = isset($_GET['type']) ? $_GET['type'] : 'all';
$search = isset($_GET['search']) ? $_GET['search'] : '';

switch ($method) {

    /* ── LIST / GET ── */
    case 'GET':
        if ($id) {
            // Single party with transactions
            $stmt = $pdo->prepare('SELECT * FROM parties WHERE id = ?');
            $stmt->execute([$id]);
            $party = $stmt->fetch();
            if (!$party) jsonResponse(['error' => 'Party not found'], 404);

            // Get transactions
            $tStmt = $pdo->prepare(
                'SELECT id, txn_date, voucher, type, description, debit, credit
                 FROM transactions WHERE party_id = ? ORDER BY txn_date ASC, id ASC'
            );
            $tStmt->execute([$id]);
            $transactions = $tStmt->fetchAll();

            // Calculate totals
            $totalDebit  = 0;
            $totalCredit = 0;
            foreach ($transactions as &$t) {
                $t['debit']  = (float)$t['debit'];
                $t['credit'] = (float)$t['credit'];
                $totalDebit  += $t['debit'];
                $totalCredit += $t['credit'];
            }

            $opening = (float)$party['opening_balance'];
            $closing = $opening + $totalDebit - $totalCredit;

            $status = 'clear';
            if ($closing > 0) $status = 'to_get';
            if ($closing < 0) $status = 'to_give';

            $party['opening_balance'] = $opening;
            $party['transactions']    = $transactions;
            $party['total_debit']     = $totalDebit;
            $party['total_credit']    = $totalCredit;
            $party['closing_balance'] = $closing;
            $party['direction']       = $closing >= 0 ? 'Dr' : 'Cr';
            $party['payment_status']  = $status;

            jsonResponse($party);

        } else {
            // List all parties with computed balances
            $sql = 'SELECT p.*,
                    COALESCE(SUM(t.debit), 0)  AS total_debit,
                    COALESCE(SUM(t.credit), 0) AS total_credit
                    FROM parties p
                    LEFT JOIN transactions t ON t.party_id = p.id';

            $where  = [];
            $params = [];

            if ($filter !== 'all') {
                $where[]  = 'p.type = ?';
                $params[] = $filter;
            }
            if ($search) {
                $where[]  = 'p.name LIKE ?';
                $params[] = "%$search%";
            }

            if ($where) {
                $sql .= ' WHERE ' . implode(' AND ', $where);
            }

            $sql .= ' GROUP BY p.id ORDER BY p.name ASC';

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $parties = $stmt->fetchAll();

            // Compute balance + direction for each
            foreach ($parties as &$p) {
                $opening  = (float)$p['opening_balance'];
                $debit    = (float)$p['total_debit'];
                $credit   = (float)$p['total_credit'];
                $balance  = $opening + $debit - $credit;
                $p['balance']         = abs($balance);
                $p['direction']       = $balance >= 0 ? 'Dr' : 'Cr';
                $p['opening_balance'] = $opening;
                $status = 'clear';
                if ($balance > 0) $status = 'to_get';
                if ($balance < 0) $status = 'to_give';
                $p['payment_status']  = $status;
            }

            jsonResponse($parties);
        }
        break;

    /* ── CREATE ── */
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['name'])) {
            jsonResponse(['error' => 'Party name is required'], 400);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO parties (name, type, contact, mobile, whatsapp, email,
             billing, shipping, gstin, pan, terms, credit_limit, opening_balance, state, city, pincode)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['name'],
            $data['type']          ?? 'customer',
            $data['contact']       ?? '',
            $data['mobile']        ?? '',
            $data['whatsapp']      ?? '',
            $data['email']         ?? '',
            $data['billing']       ?? '',
            $data['shipping']      ?? '',
            $data['gstin']         ?? '',
            $data['pan']           ?? '',
            $data['terms']         ?? 'Net 30 days',
            $data['credit_limit']  ?? '',
            $data['opening_balance'] ?? 0,
            $data['state']         ?? 'Rajasthan',
            $data['city']          ?? '',
            $data['pincode']       ?? ''
        ]);

        $newId = $pdo->lastInsertId();
        jsonResponse(['id' => (int)$newId, 'message' => 'Party created'], 201);
        break;

    /* ── UPDATE ── */
    case 'PUT':
        if (!$id) jsonResponse(['error' => 'Party ID required'], 400);

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) jsonResponse(['error' => 'No data provided'], 400);

        $fields = [];
        $values = [];
        $allowed = ['name','type','contact','mobile','whatsapp','email',
                     'billing','shipping','gstin','pan','terms','credit_limit','opening_balance','is_verified','state','city','pincode'];

        foreach ($allowed as $f) {
            if (isset($data[$f])) {
                $fields[] = "$f = ?";
                $values[] = $data[$f];
            }
        }

        if (empty($fields)) jsonResponse(['error' => 'Nothing to update'], 400);

        $values[] = $id;
        $sql = 'UPDATE parties SET ' . implode(', ', $fields) . ' WHERE id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        jsonResponse(['message' => 'Party updated']);
        break;

    /* ── DELETE ── */
    case 'DELETE':
        if (!$id) jsonResponse(['error' => 'Party ID required'], 400);

        $stmt = $pdo->prepare('DELETE FROM parties WHERE id = ?');
        $stmt->execute([$id]);

        jsonResponse(['message' => 'Party deleted']);
        break;

    default:
        jsonResponse(['error' => 'Method not allowed'], 405);
}
