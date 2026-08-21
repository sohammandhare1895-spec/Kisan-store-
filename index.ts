/* ═══════════════════════════════════════════════════════════════
   Kisan Store — src/ts/index.ts (Node CLI)
   A terminal version of the reward store, driven by the SAME
   data/catalog.json that powers the website, Python, Dart, Go,
   Java, Kotlin, C++, PHP and Ruby implementations.

   Usage:
     npx tsx src/ts/index.ts            # run directly
     node dist/index.js                 # after `npm run build`
     node dist/index.js --days 30       # simulate 30 check-in days
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Catalog } from './models.js';
import {
  projectBalance, computeGoal, affordabilityReport, redeem, DEFAULT_RULES
} from './reward-engine.js';
import { CameraService, checkinProgress } from './camera-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Locate the repo root by walking upwards until data/catalog.json is found. */
function findCatalog(): string {
  const candidates = [
    join(__dirname, '../../data/catalog.json'),
    join(__dirname, '../data/catalog.json'),
    'data/catalog.json'
  ];
  for (const c of candidates) {
    try {
      readFileSync(c);
      return c;
    } catch { /* keep walking */ }
  }
  throw new Error('data/catalog.json not found — run from the repo root.');
}

function main(): void {
  const catalog: Catalog = JSON.parse(readFileSync(findCatalog(), 'utf-8'));
  const rules = { ...DEFAULT_RULES, ...catalog.rewards };

  const daysArg = Number(process.argv.find(a => a.startsWith('--days='))?.split('=')[1] ?? 30);
  const days = Math.max(0, Math.min(365, Math.floor(daysArg) || 30));

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log(`│  🌱 ${catalog.meta.storeName} — TypeScript Reward Engine v${catalog.meta.version}        │`);
  console.log('│  ' + catalog.meta.tagline.padEnd(59) + '│');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log(`  Catalog   : ${catalog.products.length} products · ${catalog.categories.length} categories`);
  console.log(`  Rules     : +${rules.dailyCheckinCoins} coins/day · ${rules.minPhotos} photos + video ≥${rules.minVideoSeconds}s + description ≥${rules.minDescriptionChars} chars`);
  console.log('');

  // Simulate the farmer's balance
  const { balance, earned } = projectBalance(rules.startingBalance, days, rules);
  console.log(`  📷 After ${days} daily check-in day(s):`);
  console.log(`     starting ${rules.startingBalance.toLocaleString()} + earned ${earned.toLocaleString()} = ${balance.toLocaleString()} coins`);
  console.log('');

  // Camera service demo (DOM-free)
  const cam = CameraService.detectCapabilities();
  console.log('  📹 Camera capability probe:');
  console.log(`     getUserMedia → ${cam.hasGetUserMedia ? 'available' : 'NOT available (headless)'}`);
  console.log(`     MediaRecorder → ${cam.hasMediaRecorder ? 'available' : 'NOT available (headless)'}`);
  console.log('');

  // Goal computation
  const { goal, needed, progressPct } = computeGoal(catalog.products, balance);
  if (goal) {
    console.log(`  🎯 Next goal: ${goal.name} (${goal.price.toLocaleString()} coins)`);
    console.log(`     ${needed.toLocaleString()} more coins needed · progress ${progressPct.toFixed(1)}%`);
  } else {
    console.log('  🏆 You can afford every single reward in the catalog!');
  }
  console.log('');

  // Affordability plan
  console.log('  📋 Redemption plan:');
  for (const line of affordabilityReport(catalog, balance)) console.log(line);
  console.log('');

  // Demo a redemption if affordable
  const cheapest = [...catalog.products].sort((a, b) => a.price - b.price)[0];
  const result = redeem(catalog.products, cheapest.id, balance);
  if (result.ok) {
    console.log(`  ✅ Demo redemption: "${cheapest.name}" (${cheapest.price} coins) → balance now ${result.balance.toLocaleString()} coins`);
  } else {
    console.log(`  ❌ Demo redemption blocked: ${result.reason}`);
  }
  console.log('');

  // Check-in progress sanity print
  const p = checkinProgress(3, 7, 'Sowed wheat and watered the saplings', rules);
  console.log(`  ✓ Sample check-in progress → photos ${p.photosOk ? 'OK' : 'missing'} · video ${p.videoOk ? 'OK' : 'short'} · description ${p.descOk ? 'OK' : 'short'} · complete=${p.complete}`);
  console.log('');
}

main();
