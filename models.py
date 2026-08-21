"""═══════════════════════════════════════════════════════════════════
Kisan Store — backend/models.py
SQLite persistence layer for the Flask API: farmers, coin ledger,
check-ins, orders and upload records. Used only by app.py.
═══════════════════════════════════════════════════════════════════"""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent / "data" / "kisan.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS farmers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT 'Farmer',
    village     TEXT NOT NULL DEFAULT '',
    phone       TEXT NOT NULL DEFAULT '',
    crop        TEXT NOT NULL DEFAULT '',
    coins       INTEGER NOT NULL DEFAULT 1250,
    created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS coin_ledger (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id   TEXT NOT NULL REFERENCES farmers(id),
    amount      INTEGER NOT NULL,           -- +ve earned, −ve spent
    reason      TEXT NOT NULL,
    at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id   TEXT NOT NULL REFERENCES farmers(id),
    date_key    TEXT NOT NULL,              -- YYYY-MM-DD (unique per farmer)
    photos      INTEGER NOT NULL,
    video_seconds INTEGER NOT NULL,
    description TEXT NOT NULL,
    coins_earned INTEGER NOT NULL,
    at          INTEGER NOT NULL,
    UNIQUE(farmer_id, date_key)
);

CREATE TABLE IF NOT EXISTS orders (
    id          TEXT PRIMARY KEY,
    farmer_id   TEXT NOT NULL REFERENCES farmers(id),
    product_id  INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    price       INTEGER NOT NULL,
    status_index INTEGER NOT NULL DEFAULT 0,
    placed_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS uploads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id   TEXT NOT NULL REFERENCES farmers(id),
    kind        TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
    file_path   TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_farmer ON coin_ledger(farmer_id, at);
CREATE INDEX IF NOT EXISTS idx_checkins_farmer ON checkins(farmer_id, date_key);
CREATE INDEX IF NOT EXISTS idx_orders_farmer ON orders(farmer_id, placed_at);
"""

SEED_FARMERS = [
    ("kisan-001", "You", "Your Village", "", "", 1250),
    ("kisan-002", "Ramesh Patil", "Umred", "", "", 1840),
    ("kisan-003", "Suresh Dhoble", "Katol", "", "", 1725),
    ("kisan-004", "Anita Kumbhare", "Saoner", "", "", 1610),
    ("kisan-005", "Vijay Meshram", "Ramtek", "", "", 1495),
    ("kisan-006", "Kavita Uikey", "Mauda", "", "", 1380),
    ("kisan-007", "Gopal Bawane", "Hingna", "", "", 1265),
    ("kisan-008", "Sunita Wagh", "Kalmeshwar", "", "", 1150),
    ("kisan-009", "Prakash Raut", "Narkhed", "", "", 1040),
    ("kisan-010", "Meena Thakre", "Parseoni", "", "", 935),
    ("kisan-011", "Dilip Charde", "Kuhi", "", "", 820),
    ("kisan-012", "Rekha Gedam", "Bhiwapur", "", "", 705),
    ("kisan-013", "Ashok Jibhkate", "Kamptee", "", "", 590),
]


class Database:
    """Tiny context-manager wrapper around sqlite3."""

    def __init__(self, path: Path = DB_PATH) -> None:
        self.path = path

    def connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def init(self) -> None:
        with self.connect() as conn:
            conn.executescript(SCHEMA)
            now = int(time.time())
            for fid, name, village, phone, crop, coins in SEED_FARMERS:
                conn.execute(
                    "INSERT OR IGNORE INTO farmers "
                    "(id, name, village, phone, crop, coins, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (fid, name, village, phone, crop, coins, now),
                )
            conn.commit()


def get_farmer(conn: sqlite3.Connection, farmer_id: str) -> Optional[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM farmers WHERE id = ?", (farmer_id,)
    ).fetchone()


def credit_coins(conn: sqlite3.Connection, farmer_id: str, amount: int, reason: str) -> int:
    """Add coins and write a ledger entry; returns the new balance."""
    conn.execute("UPDATE farmers SET coins = coins + ? WHERE id = ?", (amount, farmer_id))
    conn.execute(
        "INSERT INTO coin_ledger (farmer_id, amount, reason, at) VALUES (?, ?, ?, ?)",
        (farmer_id, amount, reason, int(time.time())),
    )
    row = get_farmer(conn, farmer_id)
    return row["coins"] if row else 0


def debit_coins(conn: sqlite3.Connection, farmer_id: str, amount: int, reason: str) -> Optional[int]:
    """Spend coins if affordable; returns new balance or None."""
    row = get_farmer(conn, farmer_id)
    if not row or row["coins"] < amount:
        return None
    return credit_coins(conn, farmer_id, -amount, reason)
