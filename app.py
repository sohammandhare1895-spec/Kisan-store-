"""═══════════════════════════════════════════════════════════════════
Kisan Store — backend/app.py  (Flask API + static host)
─────────────────────────────────────────────────────────────────────
The optional server backend for the Kisan Store website. When this is
running on the same origin as the site, the browser app automatically
switches from local mode to server mode:

    POST /api/checkin      ← multipart: photos[], video, description
                             Validates 3 photos + 1 video + description,
                             saves media to uploads/, awards +5 coins.
    POST /api/redeem       ← JSON: product_id, farmer_id → order + debit
    GET  /api/leaderboard  ← ranked farmers
    GET  /api/orders       ← a farmer's orders
    GET  /api/catalog      ← data/catalog.json passthrough
    GET  /api/health       ← liveness probe used by assets/js/store.js
    GET  /…                ← static files (index.html, assets, data…)

Run:
    pip install -r backend/requirements.txt
    python backend/app.py            # serves http://127.0.0.1:8000

Every endpoint degrades to HTTP 503 with a JSON message if the database
cannot be opened, so the front-end falls back to local-only mode.
═══════════════════════════════════════════════════════════════════"""

from __future__ import annotations

import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

try:
    from flask import Flask, jsonify, request, send_from_directory
except ImportError:  # pragma: no cover
    raise SystemExit(
        "Flask is not installed.\n"
        "  → pip install -r backend/requirements.txt\n"
        "  → python backend/app.py"
    )

from reward_engine import (
    DEFAULT_RULES,
    Product,
    days_to_afford,
    project_balance,
    redeem,
    validate_checkin,
)
from models import Database, credit_coins, debit_coins, get_farmer

REPO_ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = REPO_ROOT / "data" / "catalog.json"
UPLOAD_DIR = REPO_ROOT / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Keep a per-farmer "already checked in today" in-process cache in addition
# to the UNIQUE(farmer_id, date_key) constraint (belt & suspenders).
_daily_checkin_cache: dict[str, str] = {}

app = Flask(__name__, static_folder=None)
db = Database()


def _load_catalog() -> dict:
    with CATALOG_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _products() -> list[Product]:
    return [Product.from_json(p) for p in _load_catalog()["products"]]


def _rules() -> dict:
    return {**DEFAULT_RULES, **_load_catalog().get("rewards", {})}


def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _json_error(message: str, status: int):
    return jsonify({"ok": False, "error": message}), status


# ─────────────────────────── API ROUTES ───────────────────────────

@app.get("/api/health")
def api_health():
    """Liveness probe — the browser pings this to detect server mode."""
    try:
        db.init()
        healthy = True
    except Exception:
        healthy = False
    return jsonify({
        "status": "ok" if healthy else "degraded",
        "store": "Kisan Store",
        "version": _load_catalog()["meta"]["version"],
        "catalogProducts": len(_products()),
        "rules": _rules(),
        "now": _today_key(),
    })


@app.get("/api/catalog")
def api_catalog():
    """Return the full reward catalog (the same file the CLIs consume)."""
    return jsonify(_load_catalog())


@app.get("/api/farmer/<farmer_id>")
def api_farmer(farmer_id: str):
    try:
        with db.connect() as conn:
            row = get_farmer(conn, farmer_id)
        if not row:
            return _json_error("farmer not found", 404)
        return jsonify({
            "ok": True,
            "farmer": {
                "id": row["id"], "name": row["name"], "village": row["village"],
                "crop": row["crop"], "coins": row["coins"],
            },
        })
    except Exception as exc:  # pragma: no cover
        return _json_error(f"database error: {exc}", 503)


@app.get("/api/leaderboard")
def api_leaderboard():
    try:
        with db.connect() as conn:
            rows = conn.execute(
                "SELECT id, name, village, coins FROM farmers ORDER BY coins DESC"
            ).fetchall()
            checkin_counts = {
                r["farmer_id"]: r["n"]
                for r in conn.execute(
                    "SELECT farmer_id, COUNT(*) AS n FROM checkins GROUP BY farmer_id"
                ).fetchall()
            }
        return jsonify({
            "ok": True,
            "rows": [
                {
                    "farmer_id": r["id"],
                    "name": r["name"],
                    "village": r["village"],
                    "coins": r["coins"],
                    "checkins": checkin_counts.get(r["id"], 0),
                }
                for r in rows
            ],
        })
    except Exception as exc:  # pragma: no cover
        return _json_error(f"database error: {exc}", 503)


@app.post("/api/checkin")
def api_checkin():
    """Accept a daily farm check-in (multipart form-data).

    fields: photos (file, repeated ≥3), video (file, 1),
            description (text ≥10 chars), farmer_id (text)
    awards: +5 coins once per calendar day per farmer.
    """
    rules = _rules()
    farmer_id = request.form.get("farmer_id", "kisan-001")
    description = request.form.get("description", "").strip()

    photos = request.files.getlist("photos")
    video = request.files.get("video")

    validation = validate_checkin(
        photo_count=len(photos),
        video_seconds=(rules["minVideoSeconds"] if video and video.filename else 0),
        description=description,
        rules=rules,
    )
    if not validation.ok:
        return jsonify({"ok": False, "validation": validation.to_dict()}), 422

    today = _today_key()
    if _daily_checkin_cache.get(farmer_id) == today:
        return _json_error("already checked in today", 409)

    try:
        with db.connect() as conn:
            farmer = get_farmer(conn, farmer_id)
            if not farmer:
                return _json_error("farmer not found", 404)

            # Save media files under uploads/<farmer_id>/<date>/
            day_dir = UPLOAD_DIR / farmer_id / today
            day_dir.mkdir(parents=True, exist_ok=True)
            saved: list[dict] = []
            for i, photo in enumerate(photos):
                if not photo or not photo.filename:
                    continue
                ext = Path(photo.filename).suffix.lower() or ".jpg"
                fname = f"photo-{i + 1:02d}-{uuid.uuid4().hex[:8]}{ext}"
                photo.save(day_dir / fname)
                saved.append({"kind": "photo", "file": fname})

            video_seconds = rules["minVideoSeconds"]
            video_fname = ""
            if video and video.filename:
                ext = Path(video.filename).suffix.lower() or ".webm"
                video_fname = f"video-{uuid.uuid4().hex[:8]}{ext}"
                video.save(day_dir / video_fname)
                saved.append({"kind": "video", "file": video_fname})
                video_seconds = int(request.form.get("video_seconds", rules["minVideoSeconds"]))

            now = int(time.time())
            conn.execute(
                "INSERT INTO checkins (farmer_id, date_key, photos, video_seconds,"
                " description, coins_earned, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (farmer_id, today, len(saved[:rules["minPhotos"]]), video_seconds,
                 description, rules["dailyCheckinCoins"], now),
            )
            for item in saved:
                conn.execute(
                    "INSERT INTO uploads (farmer_id, kind, file_path, description, created_at)"
                    " VALUES (?, ?, ?, ?, ?)",
                    (farmer_id, item["kind"], str(day_dir / item["file"]),
                     description, now),
                )
            new_balance = credit_coins(
                conn, farmer_id, rules["dailyCheckinCoins"],
                f"📷 Daily farm check-in (+{rules['dailyCheckinCoins']} coins)",
            )
            conn.commit()
    except Exception as exc:  # pragma: no cover
        return _json_error(f"database error: {exc}", 503)

    _daily_checkin_cache[farmer_id] = today
    return jsonify({
        "ok": True,
        "coinsEarned": rules["dailyCheckinCoins"],
        "balance": new_balance,
        "mediaSaved": len(saved),
        "deliveryNote": f"Check-in accepted on {today} — keep farming! 🌱",
    })


@app.post("/api/redeem")
def api_redeem():
    """Redeem a product with coins. Body: {"product_id": 11, "farmer_id": "kisan-001"}."""
    data = request.get_json(silent=True) or {}
    product_id = int(data.get("product_id", 0))
    farmer_id = data.get("farmer_id", "kisan-001")

    try:
        with db.connect() as conn:
            farmer = get_farmer(conn, farmer_id)
            if not farmer:
                return _json_error("farmer not found", 404)

            result = redeem(_products(), product_id, farmer["coins"])
            if not result.ok:
                return jsonify({
                    "ok": False,
                    "reason": result.reason,
                    "balance": result.balance,
                    "needed": max(0, result.product.price - result.balance) if result.product else 0,
                }), 422

            new_balance = debit_coins(
                conn, farmer_id, result.product.price,
                f"🎁 Redeemed \"{result.product.name}\"",
            )
            order_id = "KS-" + uuid.uuid4().hex[:8].upper()
            conn.execute(
                "INSERT INTO orders (id, farmer_id, product_id, product_name, price,"
                " status_index, placed_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
                (order_id, farmer_id, result.product.id, result.product.name,
                 result.product.price, int(time.time())),
            )
            conn.commit()
    except Exception as exc:  # pragma: no cover
        return _json_error(f"database error: {exc}", 503)

    return jsonify({
        "ok": True,
        "orderId": order_id,
        "balance": new_balance,
        "product": result.product.name,
        "price": result.product.price,
        "deliveryDays": _rules()["deliveryDays"],
    })


@app.get("/api/orders")
def api_orders():
    farmer_id = request.args.get("farmer_id", "kisan-001")
    try:
        with db.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM orders WHERE farmer_id = ? ORDER BY placed_at DESC",
                (farmer_id,),
            ).fetchall()
        return jsonify({
            "ok": True,
            "orders": [
                {
                    "id": r["id"], "productId": r["product_id"],
                    "productName": r["product_name"], "price": r["price"],
                    "statusIndex": r["status_index"], "placedAt": r["placed_at"],
                }
                for r in rows
            ],
        })
    except Exception as exc:  # pragma: no cover
        return _json_error(f"database error: {exc}", 503)


# ─────────────────────── STATIC FILE HOSTING ───────────────────────

_BLOCKED_PREFIXES = (".", "backend/", "__pycache__")
_BLOCKED_SUFFIXES = (".db", ".py", ".pyc", ".sqlite")


def _is_safe(path: str) -> bool:
    rel = path.lstrip("/")
    if not rel:
        return True
    if ".." in Path(rel).parts:
        return False
    if rel.startswith(_BLOCKED_PREFIXES):
        return False
    if any(rel.endswith(s) for s in _BLOCKED_SUFFIXES):
        return False
    target = REPO_ROOT / rel
    return target.exists() and target.is_file()


@app.get("/")
def serve_root():
    return send_from_directory(REPO_ROOT, "index.html")


@app.get("/<path:path>")
def serve_static(path: str):
    if _is_safe(path):
        return send_from_directory(REPO_ROOT, path)
    # SPA-style fallback for unknown routes (hash routing keeps this rare)
    return send_from_directory(REPO_ROOT, "index.html")


if __name__ == "__main__":
    db.init()
    port = int(os.environ.get("PORT", "8000"))
    print(f"🌱 Kisan Store backend running → http://127.0.0.1:{port}")
    print(f"   Catalog: {len(_products())} products · uploads → {UPLOAD_DIR}")
    app.run(host="0.0.0.0", port=port, debug=False)
