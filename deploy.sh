#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Kisan Store — scripts/deploy.sh
# Publishes the site to GitHub Pages (repo root → gh-pages branch)
# and pushes the repository to GitHub.
#
#   bash scripts/deploy.sh "first commit message"
# ═══════════════════════════════════════════════════════════════

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MSG="${1:-🌱 Kisan Store — initial polyglot release}"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"

echo "🌱 Preparing deploy…"
python3 scripts/gen_tsv.py

if [ ! -d .git ]; then
  git init
  git add -A
  git commit -m "$MSG"
  echo ""
  echo "  Repo initialized locally. Now create an empty repo on GitHub"
  echo "  (github.com/new — name: kisan-store) and run:"
  echo ""
  echo "    git remote add origin https://github.com/YOUR_USER/kisan-store.git"
  echo "    git push -u origin $BRANCH"
  echo ""
  echo "  GitHub Actions (.github/workflows/pages.yml) will then publish"
  echo "  the site automatically to https://YOUR_USER.github.io/kisan-store/"
  exit 0
fi

git add -A
git commit -m "$MSG" || echo "  (nothing new to commit)"
git push -u origin "$BRANCH" 2>/dev/null || echo "  ⚠️  no remote configured — see instructions above"

echo "✅ Deploy pushed. GitHub Pages will build from the workflow."
