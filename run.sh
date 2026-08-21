#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Kisan Store — scripts/run.sh
# Quick launchers for every way of running the project.
#
#   bash scripts/run.sh web        → static site on :8000
#   bash scripts/run.sh backend    → Flask API + site on :8000
#   bash scripts/run.sh docker     → docker compose up
#   bash scripts/run.sh php        → PHP API on :8080
#   bash scripts/run.sh cli <lang> → any CLI (js|ts|py|dart|go|java|kotlin|cpp|ruby|r)
# ═══════════════════════════════════════════════════════════════

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
MODE="${1:-web}"

case "$MODE" in
  web)
    echo "🌱 Kisan Store → http://localhost:8000"
    python3 -m http.server 8000
    ;;
  backend)
    echo "🌱 Kisan Store (Flask backend + static site) → http://localhost:8000"
    PYTHONPATH=backend python3 backend/app.py
    ;;
  docker)
    docker compose up --build
    ;;
  php)
    echo "🐘 PHP API → http://localhost:8080 (site stays on :8000)"
    php -S 0.0.0.0:8080 -t php
    ;;
  cli)
    python3 scripts/gen_tsv.py >/dev/null 2>&1 || true
    case "${2:-}" in
      js)  node --experimental-strip-types src/ts/index.ts 2>/dev/null || npx --yes tsx src/ts/index.ts ;;
      ts)  npx --yes tsx src/ts/index.ts ;;
      py)  PYTHONPATH=backend python3 -c "import app; exec(open('backend/app.py').read().split('if __name__')[0])" 2>/dev/null || python3 scripts/gen_tsv.py && echo "use: bash scripts/run.sh web / backend for Python" ;;
      dart) (cd dart && dart run bin/kisan_rewards.dart) ;;
      go)   (cd go && go run .) ;;
      java) javac -encoding UTF-8 -d build/java-classes java/*.java && java -cp build/java-classes Main ;;
      kotlin) kotlinc kotlin/Main.kt -include-runtime -d build/kisan.jar && java -jar build/kisan.jar ;;
      cpp)  g++ -std=c++17 -O2 cpp/reward_calc.cpp -o build/reward_calc && ./build/reward_calc ;;
      ruby) ruby ruby/reward_store.rb ;;
      r)    Rscript r/farm_analytics.R ;;
      *)    echo "unknown CLI language: ${2:-} (js|ts|dart|go|java|kotlin|cpp|ruby|r)" ;;
    esac
    ;;
  *)
    echo "usage: bash scripts/run.sh [web|backend|docker|php|cli <lang>]"
    ;;
esac
