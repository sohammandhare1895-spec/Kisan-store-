# ═══════════════════════════════════════════════════════════════
# Kisan Store — Makefile
# One-command access to the entire polyglot toolchain.
#
#   make            → full build & test matrix
#   make web        → static site on :8000 (GitHub Pages mode)
#   make backend    → Flask API + site on :8000
#   make check      → cross-language consistency verification
# ═══════════════════════════════════════════════════════════════

PY      := python3
NODE    := node
GXX     := g++
JAVAC   := javac
JAVA    := java

.PHONY: all tsv check build-ts smoke test-py run-cpp run-java run-go run-dart \
        run-ruby run-r web backend php docker clean

all: tsv check smoke test-py build-ts
	@bash scripts/build.sh

## ── Generated artifacts ───────────────────────────────────────
tsv:
	$(PY) scripts/gen_tsv.py

## ── Verification ──────────────────────────────────────────────
check: tsv
	$(PY) scripts/verify_consistency.py

smoke:
	$(NODE) scripts/smoke_test.mjs

test-py:
	PYTHONPATH=backend $(PY) -m unittest discover -s backend/tests -q

## ── TypeScript ────────────────────────────────────────────────
build-ts:
	npx tsc -p tsconfig.json

typecheck:
	npx tsc -p tsconfig.json --noEmit

## ── Run each language port ────────────────────────────────────
run-cpp: tsv
	$(GXX) -std=c++17 -O2 cpp/reward_calc.cpp -o build/reward_calc
	./build/reward_calc --days 30

run-java: tsv
	mkdir -p build/java-classes
	$(JAVAC) -encoding UTF-8 -d build/java-classes java/*.java
	$(JAVA) -cp build/java-classes Main --days 30

run-kotlin: tsv
	kotlinc kotlin/Main.kt -include-runtime -d build/kisan.jar
	$(JAVA) -jar build/kisan.jar

run-go:
	cd go && go run . --days 30

run-dart:
	cd dart && dart run bin/kisan_rewards.dart --days 30

run-ruby: tsv
	ruby ruby/reward_store.rb --days 30

run-r: tsv
	Rscript r/farm_analytics.R

## ── Servers ───────────────────────────────────────────────────
web:
	$(PY) -m http.server 8000

backend:
	PYTHONPATH=backend $(PY) backend/app.py

php:
	php -S 0.0.0.0:8080 -t php

docker:
	docker compose up --build

## ── Housekeeping ──────────────────────────────────────────────
clean:
	rm -rf build dist node_modules backend/__pycache__ backend/tests/__pycache__ \
	       backend/data uploads data/catalog.tsv
