/*
 * ═══════════════════════════════════════════════════════════════
 * Kisan Store — java/RewardEngine.java
 * The reward rules as a Java engine. Reads data/catalog.tsv
 * (generated from data/catalog.json by scripts/gen_tsv.py) so the
 * Java, Kotlin, C++ and R ports always agree with the website.
 * Java 11+ — no external dependencies.
 * ═══════════════════════════════════════════════════════════════
 */

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** A single reward product (mirrors data/catalog.json). */
public final class RewardEngine {

    /** One product row from the catalog TSV. */
    public static final class Product {
        public final int id;
        public final String name;
        public final String category;
        public final int price;
        public final int oldPrice; // 0 ⇒ not on offer
        public final double rating;
        public final int reviews;
        public final int redeemed;
        public final boolean trending;

        public Product(int id, String name, String category, int price, int oldPrice,
                       double rating, int reviews, int redeemed, boolean trending) {
            this.id = id;
            this.name = name;
            this.category = category;
            this.price = price;
            this.oldPrice = oldPrice;
            this.rating = rating;
            this.reviews = reviews;
            this.redeemed = redeemed;
            this.trending = trending;
        }

        public boolean isOnOffer() {
            return oldPrice > price;
        }

        @Override
        public String toString() {
            return String.format(Locale.ROOT, "%2d. %-22s %6d coins  (%s)%s",
                    id, name, price, category,
                    isOnOffer() ? "  [OFFER]" : "");
        }
    }

    /* ── Reward rules — identical to data/catalog.json → rewards ── */
    public static final int DAILY_CHECKIN_COINS = 5;
    public static final int MIN_PHOTOS = 3;
    public static final int MIN_VIDEO_SECONDS = 5;
    public static final int MIN_DESCRIPTION_CHARS = 10;
    public static final int REFERRAL_COINS = 50;
    public static final int QUIZ_COINS = 10;
    public static final int STARTING_BALANCE = 1250;

    private final List<Product> products = new ArrayList<>();

    /** Locate the repo root by walking upward until data/ is found. */
    public static Path findRepoRoot() {
        Path dir = Paths.get("").toAbsolutePath();
        for (int i = 0; i < 6; i++) {
            if (Files.isDirectory(dir.resolve("data"))) {
                return dir;
            }
            dir = dir.getParent();
            if (dir == null) {
                break;
            }
        }
        throw new IllegalStateException("Could not locate repo root (looking for data/).");
    }

    /** Parse the TSV exported from data/catalog.json. */
    public List<Product> loadProducts() throws IOException {
        Path tsv = findRepoRoot().resolve("data").resolve("catalog.tsv");
        List<String> lines = Files.readAllLines(tsv, StandardCharsets.UTF_8);
        products.clear();
        for (int i = 1; i < lines.size(); i++) { // skip header
            String[] f = lines.get(i).split("\t", -1);
            if (f.length < 9) {
                continue;
            }
            products.add(new Product(
                    Integer.parseInt(f[0].trim()),
                    f[1].trim(),
                    f[2].trim(),
                    Integer.parseInt(f[3].trim()),
                    f[4].trim().isEmpty() ? 0 : Integer.parseInt(f[4].trim()),
                    Double.parseDouble(f[5].trim()),
                    Integer.parseInt(f[6].trim()),
                    Integer.parseInt(f[7].trim()),
                    Boolean.parseBoolean(f[8].trim())
            ));
        }
        products.sort(Comparator.comparingInt(p -> p.id));
        return products;
    }

    public List<Product> getProducts() {
        return new ArrayList<>(products);
    }

    /** Validate a daily check-in. Returns an error string or null when valid. */
    public String validateCheckin(int photoCount, int videoSeconds, String description) {
        if (photoCount < MIN_PHOTOS) {
            return "Need " + (MIN_PHOTOS - photoCount) + " more photo(s).";
        }
        if (videoSeconds < MIN_VIDEO_SECONDS) {
            return "Video must be at least " + MIN_VIDEO_SECONDS + " seconds.";
        }
        if (description == null || description.trim().length() < MIN_DESCRIPTION_CHARS) {
            return "Description must be at least " + MIN_DESCRIPTION_CHARS + " characters.";
        }
        return null;
    }

    /** Project a balance after `days` consecutive check-ins. */
    public int projectBalance(int startingBalance, int days) {
        return startingBalance + days * DAILY_CHECKIN_COINS;
    }

    /** Days of check-ins needed to afford `price` from `balance`. */
    public int daysToAfford(int price, int balance) {
        if (balance >= price) {
            return 0;
        }
        return (int) Math.ceil((price - balance) / (double) DAILY_CHECKIN_COINS);
    }

    /** The cheapest product still out of reach — the farmer's goal. */
    public Product computeGoal(int balance) {
        return products.stream()
                .sorted(Comparator.comparingInt(p -> p.price))
                .filter(p -> p.price > balance)
                .findFirst()
                .orElse(null);
    }

    /** Redeem a product; returns new balance or throws. */
    public int redeem(int productId, int balance) {
        Product product = products.stream()
                .filter(p -> p.id == productId)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown product id " + productId));
        if (balance < product.price) {
            throw new IllegalStateException(
                    "Insufficient coins: need " + (product.price - balance)
                            + " more for \"" + product.name + "\"");
        }
        return balance - product.price;
    }
}
