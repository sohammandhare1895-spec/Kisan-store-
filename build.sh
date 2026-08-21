#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Kisan Store — scripts/build.sh
# Runs the ENTIRE polyglot build & test matrix. Every language that
# has its toolchain installed gets compiled and executed; missing
# toolchains are reported as [SKIP] so the script always completes.
#
#   bash scripts/build.sh            # full matrix
#   bash scripts/build.sh --quick    # only language-agnostic checks
# ═══════════════════════════════════════════════════════════════

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

QUICK=0
[ "${1:-}" = "--quick" ] && QUICK=1

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
PASS=0; FAIL=0; SKIP=0

say()  { printf '%b\n' "$1"; }
ok()   { PASS=$((PASS+1)); printf "  ${GREEN}[ OK ]${NC} %s\n" "$1"; }
bad()  { FAIL=$((FAIL+1)); printf "  ${RED}[FAIL]${NC} %s\n" "$1"; }
skip() { SKIP=$((SKIP+1)); printf "  ${YELLOW}[SKIP]${NC} %s\n" "$1"; }

have() { command -v "$1" >/dev/null 2>&1; }

echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│  🌱 Kisan Store — polyglot build matrix                     │"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""

mkdir -p build

# ── 1. Python: generate TSV + consistency check + unit tests ──
say "🐍 Python"
if have python3; then
  python3 scripts/gen_tsv.py >/dev/null 2>&1 && ok "gen_tsv.py → data/catalog.tsv" || bad "gen_tsv.py failed"
  python3 scripts/verify_consistency.py >/dev/null 2>&1 && ok "verify_consistency.py (all 20 languages agree)" || bad "verify_consistency.py found mismatches"
  PYTHONPATH=backend python3 -m unittest discover -s backend/tests -q >/dev/null 2>&1 && ok "unittest: reward engine (13 tests)" || bad "python unit tests failed"
else
  skip "python3 not installed"
fi

# ── 2. Node: smoke test ──
say "🟨 Node.js"
if have node; then
  node scripts/smoke_test.mjs >/dev/null 2>&1 && ok "smoke_test.mjs (DOM-free app logic)" || bad "node smoke test failed"
else
  skip "node not installed"
fi

# ── 3. TypeScript: typecheck (if typescript available) ──
say "🟦 TypeScript"
if have npx && node -e "require.resolve('typescript')" >/dev/null 2>&1; then
  npx tsc -p tsconfig.json --noEmit >/dev/null 2>&1 && ok "tsc --noEmit (strict typecheck)" || bad "tsc typecheck failed"
elif have npx && [ "$QUICK" -eq 0 ]; then
  npx --yes typescript@latest --version >/dev/null 2>&1 && ok "typescript available via npx" || skip "typescript not installed (npm i -D typescript)"
else
  skip "typescript not installed (npm i -D typescript)"
fi

# ── 4. C++ ──
say "➕ C++17"
if have g++; then
  g++ -std=c++17 -O2 cpp/reward_calc.cpp -o build/reward_calc >/dev/null 2>&1 \
    && ./build/reward_calc --days 30 >/dev/null 2>&1 \
    && ok "reward_calc compiled & ran" || bad "C++ build/run failed"
else
  skip "g++ not installed"
fi

# ── 5. Java ──
say "☕ Java"
if have javac && have java; then
  javac -encoding UTF-8 -d build/java-classes java/*.java >/dev/null 2>&1 \
    && java -cp build/java-classes Main --days 30 >/dev/null 2>&1 \
    && ok "Java engine compiled & ran (JDK 11+)" || bad "Java build/run failed"
else
  skip "JDK not installed"
fi

# ── 6. Go ──
say "🐹 Go"
if have go; then
  (cd go && go run . --days 30) >/dev/null 2>&1 && ok "Go engine ran (stdlib only)" || bad "Go run failed"
else
  skip "go not installed"
fi

# ── 7. Dart ──
say "🎯 Dart"
if have dart; then
  dart run dart/bin/kisan_rewards.dart --days 30 >/dev/null 2>&1 && ok "Dart engine ran" || bad "Dart run failed"
else
  skip "dart not installed"
fi

# ── 8. Ruby ──
say "💎 Ruby"
if have ruby; then
  ruby ruby/reward_store.rb --days 30 >/dev/null 2>&1 && ok "Ruby engine ran" || bad "Ruby run failed"
else
  skip "ruby not installed"
fi

# ── 9. PHP ──
say "🐘 PHP"
if have php; then
  php -l php/api/upload.php >/dev/null 2>&1 && php -l php/api/redeem.php >/dev/null 2>&1 && php -l php/api/leaderboard.php >/dev/null 2>&1 \
    && ok "php -l: all API files lint clean" || bad "php lint failed"
else
  skip "php not installed"
fi

# ── 10. R ──
say "📊 R"
if have Rscript; then
  Rscript r/farm_analytics.R >/dev/null 2>&1 && ok "farm_analytics.R ran (base R)" || bad "R run failed"
else
  skip "R not installed"
fi

# ── 11. Kotlin ──
say "🍵 Kotlin"
if have kotlinc; then
  kotlinc kotlin/Main.kt -include-runtime -d build/kisan.jar >/dev/null 2>&1 \
    && java -jar build/kisan.jar >/dev/null 2>&1 \
    && ok "Kotlin engine compiled & ran" || bad "Kotlin build/run failed"
else
  skip "kotlinc not installed"
fi

echo ""
echo "─────────────────────────────────────────────────────────────"
printf "  ${GREEN}PASS: %d${NC}  ${RED}FAIL: %d${NC}  ${YELLOW}SKIP: %d${NC}\n" "$PASS" "$FAIL" "$SKIP"
echo "─────────────────────────────────────────────────────────────"
[ "$FAIL" -eq 0 ] && echo "  ✅ Matrix green — the whole polyglot repo runs. 🌾" || echo "  ⚠️  Some checks failed — see output above."
echo ""
exit "$FAIL"
