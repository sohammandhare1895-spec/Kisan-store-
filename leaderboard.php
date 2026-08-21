<?php
/**
 * ═══════════════════════════════════════════════════════════════
 * Kisan Store — php/api/leaderboard.php
 * PHP twin of the Flask /api/leaderboard endpoint. Merges the seed
 * village leaderboard with live coin state from coins.json.
 * ═══════════════════════════════════════════════════════════════
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

const COINS_FILE = __DIR__ . '/data/coins.json';
const STARTING_BALANCE = 1250;

$seed = [
    ['farmer_id' => 'kisan-001', 'name' => 'You',            'village' => 'Your Village', 'coins' => STARTING_BALANCE],
    ['farmer_id' => 'kisan-002', 'name' => 'Ramesh Patil',   'village' => 'Umred',        'coins' => 1840],
    ['farmer_id' => 'kisan-003', 'name' => 'Suresh Dhoble',  'village' => 'Katol',        'coins' => 1725],
    ['farmer_id' => 'kisan-004', 'name' => 'Anita Kumbhare', 'village' => 'Saoner',       'coins' => 1610],
    ['farmer_id' => 'kisan-005', 'name' => 'Vijay Meshram',  'village' => 'Ramtek',       'coins' => 1495],
    ['farmer_id' => 'kisan-006', 'name' => 'Kavita Uikey',   'village' => 'Mauda',        'coins' => 1380],
    ['farmer_id' => 'kisan-007', 'name' => 'Gopal Bawane',   'village' => 'Hingna',       'coins' => 1265],
    ['farmer_id' => 'kisan-008', 'name' => 'Sunita Wagh',    'village' => 'Kalmeshwar',   'coins' => 1150],
    ['farmer_id' => 'kisan-009', 'name' => 'Prakash Raut',   'village' => 'Narkhed',      'coins' => 1040],
    ['farmer_id' => 'kisan-010', 'name' => 'Meena Thakre',   'village' => 'Parseoni',     'coins' => 935],
    ['farmer_id' => 'kisan-011', 'name' => 'Dilip Charde',   'village' => 'Kuhi',         'coins' => 820],
    ['farmer_id' => 'kisan-012', 'name' => 'Rekha Gedam',    'village' => 'Bhiwapur',     'coins' => 705],
    ['farmer_id' => 'kisan-013', 'name' => 'Ashok Jibhkate', 'village' => 'Kamptee',      'coins' => 590],
];

$live = [];
if (is_file(COINS_FILE)) {
    $raw = file_get_contents(COINS_FILE);
    $live = json_decode($raw ?: '[]', true) ?: [];
}

$rows = [];
foreach ($seed as $farmer) {
    if (isset($live[$farmer['farmer_id']]['balance'])) {
        $farmer['coins'] = (int)$live[$farmer['farmer_id']]['balance'];
        $farmer['checkins'] = (int)($live[$farmer['farmer_id']]['checkins'] ?? 0);
    } else {
        $farmer['checkins'] = 0;
    }
    $rows[] = $farmer;
}

usort($rows, static fn(array $a, array $b): int => $b['coins'] <=> $a['coins']);

echo json_encode(['ok' => true, 'rows' => $rows], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
