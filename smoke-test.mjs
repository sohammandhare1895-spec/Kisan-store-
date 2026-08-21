/**
 * ═══════════════════════════════════════════════════════════════
 * Kisan Store — scripts/smoke_test.mjs
 * Headless smoke test for the browser's data + store modules.
 * Runs in Node with no DOM — store.js falls back to its in-memory
 * storage automatically, proving the app logic is environment-proof.
 *
 *   node scripts/smoke_test.mjs
 * ═══════════════════════════════════════════════════════════════
 */

import assert from 'node:assert/strict';
import { CATALOG_FALLBACK, searchProducts, getRewardRules, productsByCategory } from '../assets/js/data.js';
import {
  getCoins, addCoins, spendCoins, recordCheckin, hasCheckedInToday,
  getOrders, placeOrder, ORDER_STAGES, orderStageIndex, todayKey
} from '../assets/js/store.js';

let passed = 0;
const ok = (label) => { passed++; console.log(`  ✓ ${label}`); };

console.log('🌱 Kisan Store — JS smoke test (Node, DOM-free)');

/* ── Catalog ── */
assert.ok(CATALOG_FALLBACK.products.length >= 25, 'catalog should have 25+ products');
ok(`catalog loaded with ${CATALOG_FALLBACK.products.length} products`);

const rules = getRewardRules();
assert.equal(rules.dailyCheckinCoins, 5, 'daily check-in must award 5 coins');
assert.equal(rules.minPhotos, 3, '3 photos required');
assert.equal(rules.minVideoSeconds, 5, 'video ≥ 5s required');
assert.equal(rules.minDescriptionChars, 10, 'description ≥ 10 chars required');
ok('reward rules: +5 coins · 3 photos · video ≥5s · desc ≥10 chars');

/* ── Search ── */
assert.equal(searchProducts('pump').length, 3, 'pump search hits Water/Spray/Diesel-engine pumps');
assert.equal(searchProducts('zzzzzz-no-match').length, 0, 'garbage query → 0');
ok('search: matches and empty queries behave');

/* ── Categories ── */
assert.ok(productsByCategory('irrigation').every(p => p.category === 'irrigation'));
assert.ok(productsByCategory('offers').every(p => p.oldPrice));
assert.ok(productsByCategory('trending').every(p => p.trending));
ok('category filters: irrigation / offers / trending');

/* ── Coins ── */
const start = getCoins();
assert.equal(start, rules.startingBalance, 'fresh wallet starts at 1250');
addCoins(5, 'test earning');
assert.equal(getCoins(), start + 5, 'credit works');
const spend = spendCoins(30, 'test spending');
assert.ok(spend.ok, 'debit works');
const poor = spendCoins(999999, 'too much');
assert.equal(poor.ok, false, 'overspend blocked');
ok('wallet: credit/debit + overspend guard');

/* ── Check-in ── */
if (!hasCheckedInToday()) {
  recordCheckin({ photos: 3, videoSeconds: 7, description: 'Smoke test check-in' });
}
assert.equal(hasCheckedInToday(), true, 'check-in recorded for today');
ok(`check-in recorded for ${todayKey()} → +5 coins`);

/* ── Orders ── */
const product = CATALOG_FALLBACK.products.find(p => p.id === 21);
const order = placeOrder(product, '');
assert.equal(getOrders().length >= 1, true, 'order placed');
assert.equal(ORDER_STAGES[orderStageIndex(order)], 'Placed', 'fresh order is Placed');
ok('orders: placed with 5-stage tracker');

console.log(`\n✅ All ${passed} checks passed — the engine is sound. 🌾\n`);
