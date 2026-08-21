/// ═══════════════════════════════════════════════════════════════
/// Kisan Store — dart/lib/reward_engine.dart
/// Pure reward logic (no I/O): check-in validation, coin projection,
/// goal computation and redemption — the same rules the browser app,
/// the Flask backend and the other 15+ language ports implement.
/// ═══════════════════════════════════════════════════════════════

import 'models.dart';

/// Result of validating a daily farm check-in.
class CheckinValidation {
  const CheckinValidation({
    required this.ok,
    this.missingPhotos = 0,
    this.needVideo = false,
    this.needDescription = false,
  });

  final bool ok;
  final int missingPhotos;
  final bool needVideo;
  final bool needDescription;

  @override
  String toString() => ok
      ? 'CheckinValidation(ok)'
      : 'CheckinValidation(missingPhotos: $missingPhotos, '
          'needVideo: $needVideo, needDescription: $needDescription)';
}

class RewardEngine {
  RewardEngine(this.rules);

  final RewardRules rules;

  /// A valid check-in needs ≥ minPhotos photos, a video ≥ minVideoSeconds
  /// seconds and a description ≥ minDescriptionChars characters.
  CheckinValidation validateCheckin({
    required int photoCount,
    required int videoSeconds,
    required String description,
  }) {
    final needVideo = videoSeconds < rules.minVideoSeconds;
    final needDescription =
        description.trim().length < rules.minDescriptionChars;
    if (photoCount >= rules.minPhotos && !needVideo && !needDescription) {
      return const CheckinValidation(ok: true);
    }
    return CheckinValidation(
      ok: false,
      missingPhotos: (rules.minPhotos - photoCount).clamp(0, 999).toInt(),
      needVideo: needVideo,
      needDescription: needDescription,
    );
  }

  /// Project a balance after [days] consecutive daily check-ins.
  int projectBalance(int startingBalance, int days) =>
      startingBalance + days * rules.dailyCheckinCoins;

  /// Days of consecutive check-ins needed to afford [price].
  int daysToAfford(int price, int currentBalance) {
    if (currentBalance >= price) return 0;
    return ((price - currentBalance) / rules.dailyCheckinCoins).ceil();
  }

  /// The cheapest product still out of reach — the farmer's goal.
  GoalResult computeGoal(List<Product> products, int balance) {
    final sorted = [...products]..sort((a, b) => a.price.compareTo(b.price));
    for (final p in sorted) {
      if (p.price > balance) {
        return GoalResult(
          goal: p,
          needed: p.price - balance,
          progressPct: ((balance / p.price) * 100).clamp(0, 100).toDouble(),
        );
      }
    }
    return GoalResult(goal: null, needed: 0, progressPct: 100);
  }

  /// Redeem a product. Returns the new balance or throws on failure.
  int redeem(List<Product> products, int productId, int balance) {
    final product =
        products.where((p) => p.id == productId).firstOrNull;
    if (product == null) {
      throw StateError('Unknown product id: $productId');
    }
    if (balance < product.price) {
      throw StateError(
          'Insufficient coins: need ${product.price - balance} more '
          'for "${product.name}"');
    }
    return balance - product.price;
  }
}

/// The result of [RewardEngine.computeGoal].
class GoalResult {
  const GoalResult({
    required this.goal,
    required this.needed,
    required this.progressPct,
  });

  final Product? goal; // null => everything is affordable
  final int needed;
  final double progressPct;
}
