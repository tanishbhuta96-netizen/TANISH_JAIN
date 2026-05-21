<?php
/**
 * invoice-list-badges.php
 * Logic for displaying colored badges in the Invoice List table.
 */

// JavaScript Version (for sales.js renderInvoiceTable)
/*
const badgeClass = (i.status === 'paid') ? 'status-paid' : (i.status === 'partial' ? 'status-partial' : 'status-unpaid');
const paymentBadge = i.payment_mode && i.payment_mode !== 'pending' 
    ? `<span class="badge-pay badge-pay--${i.payment_mode}">${i.payment_mode}</span>` 
    : '';

tr.innerHTML = `
    ...
    <td>
        <span class="inv-status ${badgeClass}">${i.status}</span>
        ${paymentBadge}
    </td>
    ...
`;
*/

// PHP Version (for server-side lists)
function getStatusBadge($status, $mode) {
    $class = 'status-unpaid';
    if ($status === 'paid') $class = 'status-paid';
    if ($status === 'partial') $class = 'status-partial';
    
    $badge = "<span class='inv-status $class'>$status</span>";
    
    if ($mode && $mode !== 'pending') {
        $badge .= " <span class='badge-pay badge-pay--$mode'>$mode</span>";
    }
    
    return $badge;
}
?>
