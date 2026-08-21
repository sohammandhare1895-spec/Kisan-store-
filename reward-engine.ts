/* ═══════════════════════════════════════════════════════════════
   Kisan Store — src/ts/reward-engine.ts
   The pure reward logic (no DOM): check-in validation, coin math,
   goal computation and redemption. Used by the browser bundle,
   the Node CLI (index.ts) and unit-testable in isolation.
   The exact same rules are implemented in Python, Dart, Go, Java,
   Kotlin, C++, PHP and Ruby — see the repo README's rule table.
   ═══════════════════════════════════════════════════════════════ */

import type {
  Catalog, CheckinSubmission, CheckinValidation, Product
} from './models.js';

/** Reward-rule shape — the browser reads these from data/catalog.json. */
export interface Rules {
  dailyCheckinCoins: number;
  minPhotos: number;
  minVideoSeconds: number;
  minDescriptionChars: number;
  referralCoins: number;
  quizCoins: number;
  startingBalance: number;
}

/** Defaults — always overridden by data/catalog.json at runtime. */
export const DEFAULT_RULES: Rules = {
  dailyCheckinCoins: 5,
  minPhotos: 3,
  minVideoSeconds: 5,
  minDescriptionChars: 10,
  referralCoins: 50,
  quizCoins: 10,
  startingBalance: 1250
};

/**
 * Validate a daily check-in submission.
 * A valid check-in needs ≥3 photos, a video of ≥5 seconds and a
 * description of ≥10 characters — exactly what the camera panel enforces.
 */
export function validateCheckin(sub: CheckinSubmission, rules: Rules = DEFAULT_RULES): CheckinValidation {
  const photoCount = sub.photos.length;
  const needVideo = !sub.video || sub.videoSeconds < rules.minVideoSeconds;
  const needDescription = sub.description.trim().length < rules.minDescriptionChars;

  if (photoCount >= rules.minPhotos && !needVideo && !needDescription) {
    return { ok: true };
  }
  return {
    ok: false,
    missingPhotos: Math.max(0, rules.minPhotos - photoCount),
    needVideo,
    needDescription
  };
}

/**
 * Simulate a farmer's balance after `days` consecutive daily check-ins.
 * Balance = startingBalance + days × dailyCheckinCoins (+ bonuses).
 */
export function projectBalance(
  startingBalance: number,
  days: number,
  rules: Rules = DEFAULT_RULES
): { balance: number; earned: number } {
  const earned = days * rules.dailyCheckinCoins;
  return { balance: startingBalance + earned, earned };
}

/** The cheapest product still out of reach — the farmer's "goal item". */
export function computeGoal(products: Product[], balance: number): {
  goal: Product | null;
  needed: number;
  progressPct: number;
} {
  const sorted = [...products].sort((a, b) => a.price - b.price);
  const goal = sorted.find(p => p.price > balance) ?? null;
  if (!goal) {
    return { goal: null, needed: 0, progressPct: 100 };
  }
  return {
    goal,
    needed: goal.price - balance,
    progressPct: Math.min(100, (balance / goal.price) * 100)
  };
}

/** Days of consecutive check-ins required to afford `price`. */
export function daysToAfford(price: number, startingBalance: number, rules: Rules = DEFAULT_RULES): number {
  if (startingBalance >= price) return 0;
  return Math.ceil((price - startingBalance) / rules.dailyCheckinCoins);
}

export interface RedemptionResult {
  ok: boolean;
  balance: number;
  reason?: 'insufficient' | 'unknown-product';
}

/**
 * Redeem a product against a balance. Pure & deterministic — the UI
 * layer persists the result; the server layer (Python/PHP) mirrors it.
 */
export function redeem(
  products: Product[],
  productId: number,
  balance: number
): RedemptionResult {
  const product = products.find(p => p.id === productId);
  if (!product) return { ok: false, balance, reason: 'unknown-product' };
  if (balance < product.price) return { ok: false, balance, reason: 'insufficient' };
  return { ok: true, balance: balance - product.price };
}

/**
 * Affordability report — used by the store to disable "Redeem Now"
 * buttons and by the CLI to print a plan for the farmer.
 */
export function affordabilityReport(catalog: Catalog, balance: number): string[] {
  const lines: string[] = [];
  const rules = { ...DEFAULT_RULES, ...catalog.rewards };
  lines.push(`Balance: ${balance.toLocaleString()} coins`);
  for (const p of [...catalog.products].sort((a, b) => a.price - b.price)) {
    const days = daysToAfford(p.price, balance, rules);
    const mark = balance >= p.price ? '✅ can redeem TODAY' : `⏳ ${days} more check-in day(s) needed`;
    lines.push(`  ${String(p.id).padStart(2, ' ')}. ${p.name.padEnd(24, ' ')} ${String(p.price).padStart(6, ' ')} coins → ${mark}`);
  }
  return lines;
}
