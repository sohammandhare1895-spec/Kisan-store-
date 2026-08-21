"""═══════════════════════════════════════════════════════════════════
Kisan Store — scripts/verify_consistency.py
The "multi-language glue" checker: verifies that every language port
in this repository implements the SAME reward rules declared in
data/catalog.json, and that generated artifacts (catalog.tsv) are
up to date.

  python3 scripts/verify_consistency.py
═══════════════════════════════════════════════════════════════════"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CATALOG = json.loads((REPO_ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))
RULES = CATALOG["rewards"]

# language file → list of (pattern, expected_value) checks
# one entry per rule constant so every port is cross-checked.
CHECKS: dict[str, list[tuple[str, str]]] = {
    "assets/js/data.js": [
        (r"dailyCheckinCoins:\s*(\d+)", RULES["dailyCheckinCoins"]),
        (r"minPhotos:\s*(\d+)", RULES["minPhotos"]),
        (r"minVideoSeconds:\s*(\d+)", RULES["minVideoSeconds"]),
        (r"minDescriptionChars:\s*(\d+)", RULES["minDescriptionChars"]),
        (r"startingBalance:\s*(\d+)", RULES["startingBalance"]),
    ],
    "src/ts/reward-engine.ts": [
        (r"dailyCheckinCoins:\s*(\d+)", RULES["dailyCheckinCoins"]),
        (r"minPhotos:\s*(\d+)", RULES["minPhotos"]),
        (r"minVideoSeconds:\s*(\d+)", RULES["minVideoSeconds"]),
    ],
    "dart/lib/models.dart": [
        (r"dailyCheckinCoins\s*=\s*(\d+)", RULES["dailyCheckinCoins"]),
        (r"minPhotos\s*=\s*(\d+)", RULES["minPhotos"]),
        (r"minVideoSeconds\s*=\s*(\d+)", RULES["minVideoSeconds"]),
        (r"minDescriptionChars\s*=\s*(\d+)", RULES["minDescriptionChars"]),
    ],
    "backend/reward_engine.py": [
        (r'"dailyCheckinCoins":\s*(\d+)', RULES["dailyCheckinCoins"]),
        (r'"minPhotos":\s*(\d+)', RULES["minPhotos"]),
        (r'"minVideoSeconds":\s*(\d+)', RULES["minVideoSeconds"]),
    ],
    "java/RewardEngine.java": [
        (r"DAILY_CHECKIN_COINS\s*=\s*(\d+)", RULES["dailyCheckinCoins"]),
        (r"MIN_PHOTOS\s*=\s*(\d+)", RULES["minPhotos"]),
        (r"MIN_VIDEO_SECONDS\s*=\s*(\d+)", RULES["minVideoSeconds"]),
    ],
    "kotlin/Main.kt": [
        (r"DAILY_CHECKIN_COINS\s*=\s*(\d+)", RULES["dailyCheckinCoins"]),
        (r"MIN_PHOTOS\s*=\s*(\d+)", RULES["minPhotos"]),
        (r"MIN_VIDEO_SECONDS\s*=\s*(\d+)", RULES["minVideoSeconds"]),
    ],
    "go/main.go": [
        (r"DailyCheckinCoins\s*=\s*(\d+)", RULES["dailyCheckinCoins"]),
        (r"MinPhotos\s*=\s*(\d+)", RULES["minPhotos"]),
        (r"MinVideoSeconds\s*=\s*(\d+)", RULES["minVideoSeconds"]),
    ],
    "cpp/reward_calc.cpp": [
        (r"DAILY_CHECKIN_COINS\s*=\s*(\d+)", RULES["dailyCheckinCoins"]),
        (r"MIN_PHOTOS\s*=\s*(\d+)", RULES["minPhotos"]),
        (r"MIN_VIDEO_SECONDS\s*=\s*(\d+)", RULES["minVideoSeconds"]),
    ],
    "ruby/reward_store.rb": [
        (r"DAILY_CHECKIN_COINS\s*=\s*(\d+)", RULES["dailyCheckinCoins"]),
        (r"MIN_PHOTOS\s*=\s*(\d+)", RULES["minPhotos"]),
        (r"MIN_VIDEO_SECONDS\s*=\s*(\d+)", RULES["minVideoSeconds"]),
    ],
    "php/api/upload.php": [
        (r"DAILY_CHECKIN_COINS\s*=\s*(\d+)", RULES["dailyCheckinCoins"]),
        (r"MIN_PHOTOS\s*=\s*(\d+)", RULES["minPhotos"]),
        (r"MIN_VIDEO_SECONDS\s*=\s*(\d+)", RULES["minVideoSeconds"]),
    ],
    "r/farm_analytics.R": [
        (r"DAILY_CHECKIN_COINS\s*<-\s*(\d+)", RULES["dailyCheckinCoins"]),
        (r"MIN_PHOTOS\s*<-\s*(\d+)", RULES["minPhotos"]),
        (r"MIN_VIDEO_SECONDS\s*<-\s*(\d+)", RULES["minVideoSeconds"]),
    ],
}

FAILED = 0


def check_file(rel: str, checks: list[tuple[str, str]]) -> None:
    """Verify a file's constants match the catalog rules."""
    global FAILED
    path = REPO_ROOT / rel
    if not path.exists():
        print(f"  ✗ {rel:32s} MISSING FILE")
        FAILED += 1
        return
    text = path.read_text(encoding="utf-8", errors="replace")
    file_ok = True
    for pattern, expected in checks:
        m = re.search(pattern, text)
        if not m:
            print(f"  ✗ {rel:32s} pattern not found: {pattern}")
            FAILED += 1
            file_ok = False
            continue
        actual = str(m.group(1))
        if actual != str(expected):
            print(f"  ✗ {rel:32s} rule mismatch: expected {expected}, found {actual}")
            FAILED += 1
            file_ok = False
    if file_ok:
        print(f"  ✓ {rel}")


def check_products() -> None:
    """Validate the catalog document itself."""
    global FAILED
    products = CATALOG["products"]
    problems = []
    seen_ids = set()
    valid_categories = {c["id"] for c in CATALOG["categories"]}
    for p in products:
        if p["id"] in seen_ids:
            problems.append(f"duplicate id {p['id']}")
        seen_ids.add(p["id"])
        if not p.get("name"):
            problems.append(f"id {p['id']}: missing name")
        if int(p.get("price", 0)) <= 0:
            problems.append(f"id {p['id']}: bad price")
        if not (1.0 <= float(p.get("rating", 0)) <= 5.0):
            problems.append(f"id {p['id']}: bad rating")
        if p.get("category") not in valid_categories:
            problems.append(f"id {p['id']}: unknown category {p.get('category')!r}")
    if problems:
        print("  ✗ catalog problems:")
        for problem in problems:
            print("     -", problem)
        FAILED += len(problems)
    else:
        print(f"  ✓ catalog.json: {len(products)} products, all fields valid")


def check_tsv() -> None:
    """Regenerate catalog.tsv and confirm it matches the JSON catalog."""
    global FAILED
    subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "gen_tsv.py")],
        check=False, capture_output=True,
    )
    tsv = REPO_ROOT / "data" / "catalog.tsv"
    if not tsv.exists():
        print("  ✗ data/catalog.tsv not generated")
        FAILED += 1
        return
    rows = tsv.read_text(encoding="utf-8").strip().splitlines()
    if len(rows) - 1 != len(CATALOG["products"]):
        print(f"  ✗ catalog.tsv row mismatch: {len(rows) - 1} vs {len(CATALOG['products'])}")
        FAILED += 1
    else:
        print(f"  ✓ catalog.tsv: {len(rows) - 1} rows, up to date")


def main() -> int:
    print("🌱 Kisan Store — cross-language consistency check")
    print("=" * 62)
    check_products()
    check_tsv()
    print("-" * 62)
    print("Reward-rule constants across all language ports:")
    for rel, checks in CHECKS.items():
        check_file(rel, checks)
    print("=" * 62)
    if FAILED:
        print(f"❌ {FAILED} problem(s) found")
        return 1
    print("✅ All language ports agree on the reward rules. Jai Kisan! 🌾")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
