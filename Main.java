/*
 * ═══════════════════════════════════════════════════════════════
 * Kisan Store — java/Main.java (CLI)
 * Terminal demo of the reward store using the shared catalog TSV.
 *
 *   javac -d build java/*.java && java -cp build Main
 *   javac -d build java/*.java && java -cp build Main --days 45
 * ═══════════════════════════════════════════════════════════════
 */

import java.io.IOException;
import java.util.List;

public final class Main {

    private Main() { /* static entry only */ }

    public static void main(String[] args) throws IOException {
        int days = 30;
        for (String arg : args) {
            if (arg.startsWith("--days=")) {
                days = Math.max(0, Integer.parseInt(arg.split("=")[1]));
            }
        }

        RewardEngine engine = new RewardEngine();
        List<RewardEngine.Product> products = engine.loadProducts();

        System.out.println();
        System.out.println("┌─────────────────────────────────────────────────────────────┐");
        System.out.println("│  🌱 Kisan Store — Java Reward Engine (JDK 11+)              │");
        System.out.println("│  Data-for-Equipment — Empowering every farmer               │");
        System.out.println("└─────────────────────────────────────────────────────────────┘");
        System.out.println("  Catalog : " + products.size() + " products");
        System.out.println("  Rules   : +" + RewardEngine.DAILY_CHECKIN_COINS + " coins/day · "
                + RewardEngine.MIN_PHOTOS + " photos + video ≥" + RewardEngine.MIN_VIDEO_SECONDS
                + "s + description ≥" + RewardEngine.MIN_DESCRIPTION_CHARS + " chars");
        System.out.println();

        // Wallet simulation
        CoinWallet wallet = new CoinWallet(RewardEngine.STARTING_BALANCE);
        System.out.println("  📷 After " + days + " daily check-in day(s):");
        int balance = engine.projectBalance(wallet.getBalance(), days);
        System.out.println("     starting " + RewardEngine.STARTING_BALANCE + " + earned "
                + (days * RewardEngine.DAILY_CHECKIN_COINS) + " = " + balance + " coins");
        System.out.println();

        // Check-in validation demo
        String error = engine.validateCheckin(3, 7, "Sowed wheat in north field");
        System.out.println("  ✓ Validation demo (3 photos / 7s video / description): "
                + (error == null ? "PASS" : "FAIL → " + error));
        System.out.println();

        // Goal
        RewardEngine.Product goal = engine.computeGoal(balance);
        if (goal != null) {
            System.out.println("  🎯 Next goal: " + goal.name + " (" + goal.price + " coins)");
            System.out.println("     " + (goal.price - balance) + " more coins needed · progress "
                    + String.format("%.1f", Math.min(100.0, (balance / (double) goal.price) * 100)) + "%");
        } else {
            System.out.println("  🏆 You can afford every reward in the catalog!");
        }
        System.out.println();

        // Redemption plan
        System.out.println("  📋 Redemption plan:");
        for (RewardEngine.Product p : products) {
            int d = engine.daysToAfford(p.price, balance);
            String mark = balance >= p.price
                    ? "✅ can redeem TODAY"
                    : "⏳ " + d + " more check-in day(s) needed";
            System.out.printf("     %-26s %6d coins → %s%n", p.name, p.price, mark);
        }
        System.out.println();

        // Demo redemption — cheapest product
        RewardEngine.Product cheapest = products.get(0);
        try {
            int after = engine.redeem(cheapest.id, balance);
            System.out.println("  ✅ Demo redemption: \"" + cheapest.name + "\" ("
                    + cheapest.price + " coins) → balance now " + after + " coins");
        } catch (RuntimeException e) {
            System.out.println("  ❌ Demo redemption blocked: " + e.getMessage());
        }
        System.out.println();
    }
}
