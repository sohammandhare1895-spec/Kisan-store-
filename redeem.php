<?php
/**
 * ═══════════════════════════════════════════════════════════════
 * Kisan Store — php/api/redeem.php
 * PHP twin of the Flask /api/redeem endpoint.
 *
 *   POST JSON: {"product_id": 11, "farmer_id": "kisan-001"}
 *   Response : {ok, orderId, balance, product, price, deliveryDays}
 *
 * Orders are appended to php/api/orders.json; coin state lives in
 * php/api/coins.json (shared with upload.php).
 * ═══════════════════════════════════════════════════════════════
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

const DATA_DIR   = __DIR__ . '/data';
const COINS_FILE = DATA_DIR . '/coins.json';
const ORDERS_FILE = DATA_DIR . '/orders.json';
const STARTING_BALANCE = 1250;
const DELIVERY_DAYS = '3-5';

function respond(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

function loadJson(string $path): array {
    if (!is_file($path)) { return []; }
    $raw = file_get_contents($path);
    $data = json_decode($raw ?: '[]', true);
    return is_array($data) ? $data : [];
}

function saveJson(string $path, array $data): void {
    if (!is_dir(DATA_DIR)) { mkdir(DATA_DIR, 0775, true); }
    file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function loadCatalog(): array {
    // walk upward to repo root /data/catalog.json (works in-repo or when
    // only the php/ folder is deployed — then the catalog falls back to a
    // small embedded list of well-known reward ids).
    $candidates = [
        __DIR__ . '/../../data/catalog.json',
        __DIR__ . '/../../../data/catalog.json',
    ];
    foreach ($candidates as $c) {
        if (is_file($c)) {
            $doc = json_decode((string)file_get_contents($c), true);
            if (is_array($doc) && isset($doc['products'])) { return $doc; }
        }
    }
    return ['products' => [
        ['id' => 11, 'name' => 'Water Pump', 'price' => 1000],
        ['id' => 21, 'name' => 'Solar Lantern', 'price' => 400],
    ]];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['ok' => false, 'error' => 'POST only'], 405);
}

$body = json_decode((string)file_get_contents('php://input'), true) ?? [];
$productId = (int)($body['product_id'] ?? 0);
$farmerId  = trim((string)($body['farmer_id'] ?? 'kisan-001'));

$catalog = loadCatalog();
$product = null;
foreach ($catalog['products'] as $p) {
    if ((int)$p['id'] === $productId) { $product = $p; break; }
}
if ($product === null) {
    respond(['ok' => false, 'error' => 'unknown product'], 404);
}

$coins  = loadJson(COINS_FILE);
$balance = (int)($coins[$farmerId]['balance'] ?? STARTING_BALANCE);
$price   = (int)$product['price'];

if ($balance < $price) {
    respond([
        'ok'      => false,
        'reason'  => 'insufficient',
        'balance' => $balance,
        'needed'  => $price - $balance,
    ], 422);
}

$balance -= $price;
$coins[$farmerId]['balance'] = $balance;
saveJson(COINS_FILE, $coins);

$orders = loadJson(ORDERS_FILE);
$orderId = 'KS-' . strtoupper(bin2hex(random_bytes(4)));
array_unshift($orders, [
    'id'          => $orderId,
    'farmerId'    => $farmerId,
    'productId'   => $productId,
    'productName' => $product['name'],
    'price'       => $price,
    'placedAt'    => time(),
    'statusIndex' => 0,
]);
saveJson(ORDERS_FILE, array_slice($orders, 0, 100));

respond([
    'ok'           => true,
    'orderId'      => $orderId,
    'balance'      => $balance,
    'product'      => $product['name'],
    'price'        => $price,
    'deliveryDays' => DELIVERY_DAYS,
]);
