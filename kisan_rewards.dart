/// ═══════════════════════════════════════════════════════════════
/// Kisan Store — dart/bin/kisan_rewards.dart (CLI)
/// A terminal version of the reward store driven by the SAME
/// data/catalog.json the website uses.
///
///   dart run bin/kisan_rewards.dart
///   dart run bin/kisan_rewards.dart --days 45
///   dart run bin/kisan_rewards.dart --redeem 11   (Water Pump id)
/// ═══════════════════════════════════════════════════════════════

import 'dart:io';

import 'package:kisan_rewards/models.dart';
import 'package:kisan_rewards/reward_engine.dart';

/// Walk upward from the current directory until data/catalog.json is found.
File findCatalog() {
  final candidates = <String>[
    'data/catalog.json',
    '../data/catalog.json',
    '../../data/catalog.json',
  ];
  for (final c in candidates) {
    final f = File(c);
    if (f.existsSync()) return f;
  }
  throw StateError('data/catalog.json not found — run from the repo root.');
}

String _pad(String s, int width) => s.padRight(width).substring(0, width);

void main(List<String> args) {
  final catalog = Catalog.fromJsonString(findCatalog().readAsStringSync());
  final engine = RewardEngine(catalog.rewards);

  final days = int.tryParse(
        args
            .where((a) => a.startsWith('--days='))
            .map((a) => a.split('=')[1])
            .firstOrNull ??
            '30',
      ) ??
      30;

  final redeemId = int.tryParse(
    args
        .where((a) => a.startsWith('--redeem='))
        .map((a) => a.split('=')[1])
        .firstOrNull ??
        '',
  );

  stdout.writeln('');
  stdout.writeln('┌─────────────────────────────────────────────────────────────┐');
  stdout.writeln('│  🌱 ${catalog.meta['storeName']} — Dart Reward Engine v${catalog.meta['version']}                │');
  stdout.writeln('│  ${_pad(catalog.meta['tagline'] as String, 59)}│');
  stdout.writeln('└─────────────────────────────────────────────────────────────┘');
  stdout.writeln('  Catalog   : ${catalog.products.length} products · ${catalog.categories.length} categories');
  stdout.writeln('  Rules     : +${engine.rules.dailyCheckinCoins} coins/day · '
      '${engine.rules.minPhotos} photos + video ≥${engine.rules.minVideoSeconds}s '
      '+ description ≥${engine.rules.minDescriptionChars} chars');
  stdout.writeln('');

  // Balance projection
  final balance = engine.projectBalance(engine.rules.startingBalance, days);
  stdout.writeln('  📷 After $days daily check-in day(s):');
  stdout.writeln('     starting ${engine.rules.startingBalance} + '
      'earned ${days * engine.rules.dailyCheckinCoins} = $balance coins');
  stdout.writeln('');

  // Validation demo
  final v = engine.validateCheckin(
      photoCount: 3, videoSeconds: 7, description: 'Sowed wheat today');
  stdout.writeln('  ✓ Validation demo (3 photos / 7s video / description): ${v.ok ? "PASS" : "FAIL"}');
  stdout.writeln('');

  // Goal
  final goal = engine.computeGoal(catalog.products, balance);
  if (goal.goal != null) {
    stdout.writeln('  🎯 Next goal: ${goal.goal!.name} (${goal.goal!.price} coins)');
    stdout.writeln('     ${goal.needed} more coins needed · progress ${goal.progressPct.toStringAsFixed(1)}%');
  } else {
    stdout.writeln('  🏆 You can afford every reward in the catalog!');
  }
  stdout.writeln('');

  // Redemption plan
  stdout.writeln('  📋 Redemption plan:');
  final sorted = [...catalog.products]..sort((a, b) => a.price.compareTo(b.price));
  for (final p in sorted) {
    final d = engine.daysToAfford(p.price, balance);
    final mark = balance >= p.price
        ? '✅ can redeem TODAY'
        : '⏳ $d more check-in day(s) needed';
    stdout.writeln('     ${_pad(p.name, 26)} ${p.price.toString().padLeft(6)} coins → $mark');
  }
  stdout.writeln('');

  // Demo redemption
  if (redeemId != null) {
    try {
      final newBalance = engine.redeem(catalog.products, redeemId, balance);
      final p = catalog.products.firstWhere((x) => x.id == redeemId);
      stdout.writeln('  ✅ Redeemed "${p.name}" (${p.price} coins) → balance now $newBalance coins');
    } catch (e) {
      stdout.writeln('  ❌ ${e.toString()}');
    }
  } else {
    stdout.writeln('  (Tip: pass --redeem=<productId> to simulate a redemption)');
  }
  stdout.writeln('');
}
