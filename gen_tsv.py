"""═══════════════════════════════════════════════════════════════════
Kisan Store — scripts/gen_tsv.py
Exports data/catalog.json → data/catalog.tsv so the Java, Kotlin,
C++ and R ports (which avoid JSON dependencies) read the exact same
catalog as the website.

  python3 scripts/gen_tsv.py
═══════════════════════════════════════════════════════════════════"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = REPO_ROOT / "data" / "catalog.json"
TSV_PATH = REPO_ROOT / "data" / "catalog.tsv"

HEADERS = ["id", "name", "category", "price", "oldPrice",
           "rating", "reviews", "redeemed", "trending"]


def clean(field: object) -> str:
    """Make any field TSV-safe (strip tabs/newlines)."""
    if field is None:
        return ""
    return str(field).replace("\t", " ").replace("\n", " ").replace("\r", " ").strip()


def main() -> int:
    if not CATALOG_PATH.exists():
        print(f"❌ {CATALOG_PATH} not found", file=sys.stderr)
        return 1

    doc = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    products = doc.get("products", [])
    if not products:
        print("❌ catalog has no products", file=sys.stderr)
        return 1

    lines = ["\t".join(HEADERS)]
    for p in products:
        rows = [
            p.get("id"),
            p.get("name"),
            p.get("category"),
            p.get("price"),
            p.get("oldPrice"),
            p.get("rating"),
            p.get("reviews"),
            p.get("redeemed"),
            "true" if p.get("trending") else "false",
        ]
        lines.append("\t".join(clean(f) for f in rows))

    TSV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"✅ Wrote {len(products)} products → {TSV_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
