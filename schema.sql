-- ═══════════════════════════════════════════════════════════════
-- Kisan Store — sql/schema.sql
-- Relational schema for the reward platform (SQLite-compatible).
-- The Python Flask backend applies the same structure in
-- backend/models.py; this file exists for anyone running the schema
-- directly (e.g. in Postgres/MySQL) or auditing the data model.
--
--   sqlite3 kisan.db < sql/schema.sql
-- ═══════════════════════════════════════════════════════════════

PRAGMA foreign_keys = ON;

-- ── Farmers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farmers (
    id          TEXT PRIMARY KEY,               -- e.g. 'kisan-001'
    name        TEXT NOT NULL DEFAULT 'Farmer',
    village     TEXT NOT NULL DEFAULT '',
    phone      TEXT NOT NULL DEFAULT '',
    crop        TEXT NOT NULL DEFAULT '',
    coins       INTEGER NOT NULL DEFAULT 1250,  -- reward currency
    created_at  INTEGER NOT NULL                -- epoch seconds
);

-- ── Coin ledger (append-only) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS coin_ledger (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id   TEXT NOT NULL REFERENCES farmers(id),
    amount      INTEGER NOT NULL,               -- +ve earned, −ve spent
    reason      TEXT NOT NULL,
    at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_farmer ON coin_ledger(farmer_id, at);

-- ── Daily check-ins: 3 photos + 1 video + description = +5 ─────
CREATE TABLE IF NOT EXISTS checkins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id     TEXT NOT NULL REFERENCES farmers(id),
    date_key      TEXT NOT NULL,                -- YYYY-MM-DD
    photos        INTEGER NOT NULL,             -- ≥ 3 required
    video_seconds INTEGER NOT NULL,             -- ≥ 5 required
    description   TEXT NOT NULL,                -- ≥ 10 chars required
    coins_earned  INTEGER NOT NULL DEFAULT 5,
    at            INTEGER NOT NULL,
    UNIQUE(farmer_id, date_key)                 -- once per day
);

CREATE INDEX IF NOT EXISTS idx_checkins_farmer ON checkins(farmer_id, date_key);

-- ── Media uploads from the camera panel ────────────────────────
CREATE TABLE IF NOT EXISTS uploads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id   TEXT NOT NULL REFERENCES farmers(id),
    kind        TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
    file_path   TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL
);

-- ── Redemption orders ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id           TEXT PRIMARY KEY,              -- e.g. 'KS-A1B2C3D4'
    farmer_id    TEXT NOT NULL REFERENCES farmers(id),
    product_id   INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    price        INTEGER NOT NULL,
    status_index INTEGER NOT NULL DEFAULT 0,    -- 0..4 → Placed..Delivered
    placed_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_farmer ON orders(farmer_id, placed_at);

-- ── Product catalog snapshot (mirrors data/catalog.json) ───────
CREATE TABLE IF NOT EXISTS products (
    id        INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    desc      TEXT NOT NULL DEFAULT '',
    category  TEXT NOT NULL,
    price     INTEGER NOT NULL,
    old_price INTEGER,                          -- NULL ⇒ not on offer
    rating    REAL NOT NULL DEFAULT 4.5,
    reviews   INTEGER NOT NULL DEFAULT 0,
    redeemed  INTEGER NOT NULL DEFAULT 0,
    trending  INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO products (id, name, desc, category, price, old_price, rating, reviews, redeemed, trending) VALUES
(1,  'Diesel Engine',        '5 HP, water-cooled pump engine', 'equipment',  1500, NULL, 4.9, 65,  480, 0),
(2,  'Power Tiller',         '8 HP rotavator for small farms', 'equipment',  2000, NULL, 4.8, 42,  210, 1),
(3,  'Mini Harvester',       'Compact cutter for small farms', 'equipment',  3500, NULL, 4.7, 38,  150, 0),
(4,  'Tool Kit',             '18-piece farm tool set',         'equipment',   450, NULL, 4.6, 88,  720, 1),
(5,  'Spray Pump',           '16L manual spray pump',          'equipment',   600, NULL, 4.7, 75,  530, 0),
(6,  'Smart CCTV Kit',       '4 cams + recorder, app view',    'smart',       800, NULL, 4.7, 56,  420, 0),
(7,  'Soil Moisture Sensor', 'Wireless, 500m range',           'smart',       950, NULL, 4.8, 34,  180, 1),
(8,  'Weather Station',      'Solar powered, 7 sensors',       'smart',      1100, NULL, 4.5, 29,  120, 0),
(9,  'Farm Management App',  '1 year premium access',          'smart',       500, NULL, 4.9, 210, 1500, 1),
(10, 'CCTV Camera Kit',      '1080p with night vision',        'smart',       850, NULL, 4.8, 120, 640, 1),
(11, 'Water Pump',           '1 HP, 100 ft head',              'irrigation', 1000, NULL, 4.9, 98,  560, 1),
(12, 'Pipe Set 50m',         'HDPE with connectors',           'irrigation', 1200, NULL, 4.8, 110, 610, 0),
(13, 'Drip Irrigation Kit',  '1 acre, full set',               'irrigation', 1300, NULL, 4.6, 72,  390, 1),
(14, 'HDPE Pipe Set 100m',   '100m with joints',               'irrigation', 1200, 1450, 4.8, 95,  470, 0),
(15, 'Borewell Motor',       '2 HP, submersible',              'irrigation', 2000, NULL, 4.7, 48,  260, 0),
(16, 'Water Tank',           '1000L, UV resistant',            'irrigation',  900, NULL, 4.5, 63,  340, 0),
(17, 'Complete Farmer Kit',  'Tools + seeds + sprayer',        'kits',       1800, NULL, 4.8, 54,  300, 0),
(18, 'Seed Starter Kit',     'Trays, coco-peat, 50 pots',      'kits',        700, NULL, 4.6, 90,  510, 0),
(19, 'Crop Protection Kit',  'Net, traps, neem spray',         'kits',       1100, NULL, 4.7, 61,  270, 0),
(20, 'Harvest Toolkit',      'Sickle, crates, scale',          'kits',        950, 1200, 4.5, 77,  330, 0),
(21, 'Solar Lantern',        'Bright, 12h backup',             'utility',     400, NULL, 4.7, 130, 980, 1),
(22, 'Rechargeable Torch',   'Heavy duty, USB-C',              'utility',     250, NULL, 4.5, 140, 820, 0),
(23, 'Water Purifier Jug',   '5L safe drinking water',         'utility',     350, NULL, 4.6, 85,  430, 0),
(24, 'Storage Drum',         '200L food-grade drum',           'utility',     500, NULL, 4.5, 60,  290, 0),
(25, 'Weighing Scale',       '50kg digital scale',             'utility',     450,  600, 4.6, 44,  210, 0),
(26, 'Hybrid Seeds Pack',    '5 high-yield varieties',         'seeds',       300, NULL, 4.6, 150, 940, 0),
(27, 'NPK Fertilizer 10kg',  'Balanced 10:26:26 mix',          'seeds',       550, NULL, 4.5, 96,  470, 0),
(28, 'Organic Compost 25kg', '100% organic, ready to use',     'seeds',       400,  500, 4.7, 102, 510, 0),
(29, 'Bio Pesticide 1L',     'Eco-safe, broad spectrum',       'seeds',       480, NULL, 4.6, 58,  260, 0);

-- ── Seed farmers (mirrors the browser leaderboard) ─────────────
INSERT OR IGNORE INTO farmers (id, name, village, coins, created_at) VALUES
('kisan-001', 'You',            'Your Village', 1250, strftime('%s','now')),
('kisan-002', 'Ramesh Patil',   'Umred',        1840, strftime('%s','now')),
('kisan-003', 'Suresh Dhoble',  'Katol',        1725, strftime('%s','now')),
('kisan-004', 'Anita Kumbhare', 'Saoner',       1610, strftime('%s','now')),
('kisan-005', 'Vijay Meshram',  'Ramtek',       1495, strftime('%s','now')),
('kisan-006', 'Kavita Uikey',   'Mauda',        1380, strftime('%s','now')),
('kisan-007', 'Gopal Bawane',   'Hingna',       1265, strftime('%s','now')),
('kisan-008', 'Sunita Wagh',    'Kalmeshwar',   1150, strftime('%s','now')),
('kisan-009', 'Prakash Raut',   'Narkhed',      1040, strftime('%s','now')),
('kisan-010', 'Meena Thakre',   'Parseoni',      935, strftime('%s','now')),
('kisan-011', 'Dilip Charde',   'Kuhi',          820, strftime('%s','now')),
('kisan-012', 'Rekha Gedam',    'Bhiwapur',      705, strftime('%s','now')),
('kisan-013', 'Ashok Jibhkate', 'Kamptee',       590, strftime('%s','now'));

-- ── Leaderboard view ───────────────────────────────────────────
CREATE VIEW IF NOT EXISTS v_leaderboard AS
SELECT f.id,
       f.name,
       f.village,
       f.coins,
       COUNT(DISTINCT c.date_key) AS checkins,
       COUNT(DISTINCT o.id)       AS redemptions
FROM farmers f
LEFT JOIN checkins c ON c.farmer_id = f.id
LEFT JOIN orders o   ON o.farmer_id = f.id
GROUP BY f.id
ORDER BY f.coins DESC;
