/*
 * ═══════════════════════════════════════════════════════════════
 * Kisan Store — java/CoinWallet.java
 * An in-memory wallet with a transaction ledger — the Java twin of
 * the browser's store.js wallet. Used by Main.java's CLI demo.
 * ═══════════════════════════════════════════════════════════════
 */

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** A single ledger entry (+ earned, − spent). */
public final class CoinWallet {

    /** One ledger line. */
    public static final class Entry {
        public final int amount;
        public final String reason;
        public final long atEpochMs;

        public Entry(int amount, String reason, long atEpochMs) {
            this.amount = amount;
            this.reason = reason;
            this.atEpochMs = atEpochMs;
        }

        @Override
        public String toString() {
            String when = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm", Locale.ENGLISH)
                    .withZone(ZoneId.systemDefault())
                    .format(Instant.ofEpochMilli(atEpochMs));
            String sign = amount >= 0 ? "+" : "";
            return String.format("%-8s %-6d coins  %-48s  %s", sign, amount, reason, when);
        }
    }

    private int balance;
    private final List<Entry> ledger = new ArrayList<>();

    public CoinWallet(int startingBalance) {
        this.balance = startingBalance;
    }

    public int getBalance() {
        return balance;
    }

    /** Credit coins (positive amount). */
    public int credit(int amount, String reason) {
        if (amount < 0) {
            throw new IllegalArgumentException("credit amount must be ≥ 0");
        }
        balance += amount;
        ledger.add(0, new Entry(amount, reason, System.currentTimeMillis()));
        return balance;
    }

    /** Debit coins; returns false when the balance is insufficient. */
    public boolean debit(int amount, String reason) {
        if (amount < 0) {
            throw new IllegalArgumentException("debit amount must be ≥ 0");
        }
        if (balance < amount) {
            return false;
        }
        balance -= amount;
        ledger.add(0, new Entry(-amount, reason, System.currentTimeMillis()));
        return true;
    }

    public List<Entry> getLedger() {
        return new ArrayList<>(ledger);
    }

    public void printLedger(int maxLines) {
        System.out.println("  ── Coin history ──");
        if (ledger.isEmpty()) {
            System.out.println("   (no transactions yet — do a daily check-in to earn +5)");
            return;
        }
        for (int i = 0; i < Math.min(maxLines, ledger.size()); i++) {
            System.out.println("   " + ledger.get(i));
        }
    }
}
