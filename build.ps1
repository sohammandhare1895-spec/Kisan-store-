# ═══════════════════════════════════════════════════════════════
# Kisan Store — scripts/build.ps1
# Windows twin of build.sh: runs the polyglot build matrix in
# PowerShell. Missing toolchains are reported as [SKIP].
#
#   powershell -ExecutionPolicy Bypass -File scripts/build.ps1
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$Pass = 0; $Fail = 0; $Skip = 0
New-Item -ItemType Directory -Force -Path build | Out-Null

function Ok($label)   { $script:Pass++; Write-Host "  [ OK ] $label" -ForegroundColor Green }
function Bad($label)  { $script:Fail++; Write-Host "  [FAIL] $label" -ForegroundColor Red }
function Skip($label) { $script:Skip++; Write-Host "  [SKIP] $label" -ForegroundColor Yellow }

function Have($cmd) {
  return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

Write-Host ""
Write-Host "┌─────────────────────────────────────────────────────────────┐"
Write-Host "│  🌱 Kisan Store — polyglot build matrix (PowerShell)        │"
Write-Host "└─────────────────────────────────────────────────────────────┘"
Write-Host ""

Write-Host "🐍 Python"
if (Have python) {
  python scripts/gen_tsv.py *> $null
  if ($LASTEXITCODE -eq 0) { Ok "gen_tsv.py → data/catalog.tsv" } else { Bad "gen_tsv.py failed" }
  python scripts/verify_consistency.py *> $null
  if ($LASTEXITCODE -eq 0) { Ok "verify_consistency.py (all 20 languages agree)" } else { Bad "verify_consistency.py found mismatches" }
  $env:PYTHONPATH = "backend"
  python -m unittest discover -s backend/tests -q *> $null
  if ($LASTEXITCODE -eq 0) { Ok "unittest: reward engine" } else { Bad "python unit tests failed" }
} else { Skip "python not installed" }

Write-Host "🟨 Node.js"
if (Have node) {
  node scripts/smoke_test.mjs *> $null
  if ($LASTEXITCODE -eq 0) { Ok "smoke_test.mjs (DOM-free app logic)" } else { Bad "node smoke test failed" }
} else { Skip "node not installed" }

Write-Host "🟦 TypeScript"
if (Have npx) {
  npx --yes tsc -p tsconfig.json --noEmit *> $null
  if ($LASTEXITCODE -eq 0) { Ok "tsc --noEmit (strict typecheck)" } else { Bad "tsc typecheck failed" }
} else { Skip "npx not installed" }

Write-Host "➕ C++17"
if (Have g++) {
  g++ -std=c++17 -O2 cpp/reward_calc.cpp -o build/reward_calc.exe *> $null
  if ($LASTEXITCODE -eq 0) { .\build\reward_calc.exe --days 30 *> $null; if ($LASTEXITCODE -eq 0) { Ok "reward_calc compiled & ran" } else { Bad "C++ run failed" } }
  else { Bad "C++ build failed" }
} else { Skip "g++ not installed" }

Write-Host "☕ Java"
if ((Have javac) -and (Have java)) {
  javac -encoding UTF-8 -d build/java-classes java/*.java *> $null
  if ($LASTEXITCODE -eq 0) { java -cp build/java-classes Main --days 30 *> $null; if ($LASTEXITCODE -eq 0) { Ok "Java engine compiled & ran" } else { Bad "Java run failed" } }
  else { Bad "Java compile failed" }
} else { Skip "JDK not installed" }

Write-Host "🐹 Go"
if (Have go) {
  Push-Location go; go run . --days 30 *> $null; $code = $LASTEXITCODE; Pop-Location
  if ($code -eq 0) { Ok "Go engine ran (stdlib only)" } else { Bad "Go run failed" }
} else { Skip "go not installed" }

Write-Host "🎯 Dart"
if (Have dart) {
  dart run dart/bin/kisan_rewards.dart --days 30 *> $null
  if ($LASTEXITCODE -eq 0) { Ok "Dart engine ran" } else { Bad "Dart run failed" }
} else { Skip "dart not installed" }

Write-Host "💎 Ruby"
if (Have ruby) {
  ruby ruby/reward_store.rb --days 30 *> $null
  if ($LASTEXITCODE -eq 0) { Ok "Ruby engine ran" } else { Bad "Ruby run failed" }
} else { Skip "ruby not installed" }

Write-Host "🐘 PHP"
if (Have php) {
  php -l php/api/upload.php *> $null
  $ok1 = $LASTEXITCODE
  php -l php/api/redeem.php *> $null
  $ok2 = $LASTEXITCODE
  php -l php/api/leaderboard.php *> $null
  $ok3 = $LASTEXITCODE
  if (($ok1 -eq 0) -and ($ok2 -eq 0) -and ($ok3 -eq 0)) { Ok "php -l: all API files lint clean" } else { Bad "php lint failed" }
} else { Skip "php not installed" }

Write-Host "📊 R"
if (Have Rscript) {
  Rscript r/farm_analytics.R *> $null
  if ($LASTEXITCODE -eq 0) { Ok "farm_analytics.R ran (base R)" } else { Bad "R run failed" }
} else { Skip "R not installed" }

Write-Host "🍵 Kotlin"
if (Have kotlinc) {
  kotlinc kotlin/Main.kt -include-runtime -d build/kisan.jar *> $null
  if ($LASTEXITCODE -eq 0) { java -jar build/kisan.jar *> $null; if ($LASTEXITCODE -eq 0) { Ok "Kotlin engine compiled & ran" } else { Bad "Kotlin run failed" } }
  else { Bad "Kotlin compile failed" }
} else { Skip "kotlinc not installed" }

Write-Host ""
Write-Host "─────────────────────────────────────────────────────────────"
Write-Host "  PASS: $Pass   FAIL: $Fail   SKIP: $Skip"
Write-Host "─────────────────────────────────────────────────────────────"
if ($Fail -eq 0) { Write-Host "  ✅ Matrix green — the whole polyglot repo runs. 🌾" -ForegroundColor Green }
else { Write-Host "  ⚠️  Some checks failed — see output above." -ForegroundColor Yellow }
Write-Host ""
exit $Fail
