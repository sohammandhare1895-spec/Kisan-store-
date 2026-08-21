<?php
/**
 * ═══════════════════════════════════════════════════════════════
 * Kisan Store — php/api/upload.php
 * PHP twin of the Flask /api/checkin endpoint. Drop this folder onto
 * any PHP 7.4+ host (with uploads/ writable) to power the Kisan
 * Store camera check-in:
 *
 *   POST multipart: photos[] (≥3 files), video (1 file),
 *                   description (≥10 chars), farmer_id
 *   Response JSON : {ok, coinsEarned, balance, mediaSaved}
 *
 * Coin state is persisted in php/api/coins.json — no database needed.
 * ═══════════════════════════════════════════════════════════════
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

/* ── Reward rules (mirror of data/catalog.json → rewards) ── */
const DAILY_CHECKIN_COINS   = 5;
const MIN_PHOTOS            = 3;
const MIN_VIDEO_SECONDS     = 5;
const MIN_DESCRIPTION_CHARS = 10;
const STARTING_BALANCE      = 1250;

const DATA_DIR   = __DIR__ . '/data';
const COINS_FILE = DATA_DIR . '/coins.json';
const UPLOAD_DIR = __DIR__ . '/uploads';

function respond(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

function loadCoins(): array {
    if (!is_file(COINS_FILE)) { return []; }
    $raw = file_get_contents(COINS_FILE);
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}

function saveCoins(array $coins): void {
    if (!is_dir(DATA_DIR)) { mkdir(DATA_DIR, 0775, true); }
    file_put_contents(COINS_FILE, json_encode($coins, JSON_PRETTY_PRINT));
}

function todayKey(): string {
    return date('Y-m-d');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['ok' => false, 'error' => 'POST only'], 405);
}

$farmerId    = trim((string)($_POST['farmer_id'] ?? 'kisan-001'));
$description = trim((string)($_POST['description'] ?? ''));
$photos      = $_FILES['photos'] ?? null;
$video       = $_FILES['video'] ?? null;

/* ── Validate: ≥3 photos, 1 video, description ≥10 chars ── */
$photoFiles = [];
if (is_array($photos) && isset($photos['name'])) {
    // PHP normalises photos[] into an array-of-arrays
    foreach ((array)$photos['name'] as $i => $name) {
        if ($name !== '' && ($photos['error'][$i] ?? 1) === UPLOAD_ERR_OK) {
            $photoFiles[] = [
                'name'     => $name,
                'tmp_name' => $photos['tmp_name'][$i],
                'size'     => $photos['size'][$i],
            ];
        }
    }
}

$videoOk = is_array($video)
    && !empty($video['name'])
    && ($video['error'] ?? 1) === UPLOAD_ERR_OK;

$validation = [
    'ok'               => false,
    'missingPhotos'    => max(0, MIN_PHOTOS - count($photoFiles)),
    'needVideo'        => !$videoOk,
    'needDescription'  => strlen($description) < MIN_DESCRIPTION_CHARS,
];
if (count($photoFiles) < MIN_PHOTOS || !$videoOk || strlen($description) < MIN_DESCRIPTION_CHARS) {
    respond(['ok' => false, 'validation' => $validation], 422);
}

/* ── Daily limit: one check-in per farmer per day ── */
$coins = loadCoins();
$today = todayKey();
if (($coins[$farmerId]['lastCheckin'] ?? '') === $today) {
    respond(['ok' => false, 'error' => 'already checked in today'], 409);
}

/* ── Persist media files ── */
$dayDir = UPLOAD_DIR . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '', $farmerId) . '/' . $today;
if (!is_dir($dayDir) && !mkdir($dayDir, 0775, true)) {
    respond(['ok' => false, 'error' => 'cannot create upload folder'], 500);
}

$saved = 0;
foreach ($photoFiles as $i => $photo) {
    $ext = strtolower(pathinfo($photo['name'], PATHINFO_EXTENSION)) ?: 'jpg';
    $dest = sprintf('%s/photo-%02d-%s.%s', $dayDir, $i + 1, bin2hex(random_bytes(4)), $ext);
    if (move_uploaded_file($photo['tmp_name'], $dest)) { $saved++; }
}

$videoSeconds = MIN_VIDEO_SECONDS;
if ($videoOk) {
    $ext = strtolower(pathinfo($video['name'], PATHINFO_EXTENSION)) ?: 'webm';
    $dest = sprintf('%s/video-%s.%s', $dayDir, bin2hex(random_bytes(4)), $ext);
    if (move_uploaded_file($video['tmp_name'], $dest)) { $saved++; }
}

/* ── Credit +5 coins & persist ── */
$balance = (int)($coins[$farmerId]['balance'] ?? STARTING_BALANCE) + DAILY_CHECKIN_COINS;
$coins[$farmerId] = [
    'balance'     => $balance,
    'lastCheckin' => $today,
    'checkins'    => (int)($coins[$farmerId]['checkins'] ?? 0) + 1,
];
saveCoins($coins);

respond([
    'ok'           => true,
    'coinsEarned'  => DAILY_CHECKIN_COINS,
    'balance'      => $balance,
    'mediaSaved'   => $saved,
    'deliveryNote' => "Check-in accepted on {$today} — keep farming! 🌱",
]);
