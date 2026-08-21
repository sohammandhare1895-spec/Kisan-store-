/*
 * ═══════════════════════════════════════════════════════════════
 * Kisan Store — kotlin/Main.kt
 * The reward engine in Kotlin — the JVM sibling of the Java port.
 * Reads the same data/catalog.tsv generated from data/catalog.json.
 *
 *   kotlinc kotlin/Main.kt -include-runtime -d build/kisan.jar
 *   java -jar build/kisan.jar            (or: kotlin MainKt)
 * ═══════════════════════════════════════════════════════════════
 */

import java.io.File
import kotlin.math.ceil
import kotlin.math.min
import kotlin.math.roundToInt

/* ── Reward rules (mirror of data/catalog.json → rewards) ── */
const val DAILY_CHECKIN_COINS = 5
const val MIN_PHOTOS = 3
const val MIN_VIDEO_SECONDS = 5
const val MIN_DESCRIPTION_CHARS = 10
const val REFERRAL_COINS = 50
const val QUIZ_COINS = 10
const val STARTING_BALANCE = 1250

/** A single reward product. */
data class Product(
    val id: Int,
    val name: String,
    val category: String,
    val price: Int,
    val oldPrice: Int,
    val rating: Double,
    val reviews: Int,
    val redeemed: Int,
    val trending: Boolean
) {
    val isOnOffer: Boolean get() = oldPrice > price
    val discountPercent: Int
        get() = if (isOnOffer) ((1.0 - price.toDouble() / oldPrice) * 100).roundToInt() else 0
}

/** Locate the repo root by walking upward until data/ is found. */
fun findRepoRoot(): File {
    var dir = File("").absoluteFile
    repeat(6) {
        if (File(dir, "data").isDirectory) return dir
        dir = dir.parentFile ?: error("Could not locate repo root (looking for data/).")
    }
    error("Could not locate repo root (looking for data/).")
}

/** Parse the TSV exported from data/catalog.json. */
fun loadProducts(): List<Product> {
    val tsv = File(findRepoRoot(), "data/catalog.tsv")
    require(tsv.exists()) {
        "data/catalog.tsv not found — run: python3 scripts/gen_tsv.py"
    }
    return tsv.readLines().drop(1).mapNotNull { line ->
        val f = line.split("\t")
        if (f.size < 9) return@mapNotNull null
        Product(
            id = f[0].trim().toInt(),
            name = f[1].trim(),
            category = f[2].trim(),
            price = f[3].trim().toInt(),
            oldPrice = f[4].trim().ifEmpty { "0" }.toInt(),
            rating = f[5].trim().toDouble(),
            reviews = f[6].trim().toInt(),
            redeemed = f[7].trim().toInt(),
            trending = f[8].trim().toBoolean()
        )
    }.sortedBy { it.id }
}

/** Validate a daily check-in — null means valid. */
fun validateCheckin(photoCount: Int, videoSeconds: Int, description: String): String? = when {
    photoCount < MIN_PHOTOS -> "Need ${MIN_PHOTOS - photoCount} more photo(s)."
    videoSeconds < MIN_VIDEO_SECONDS -> "Video must be at least $MIN_VIDEO_SECONDS seconds."
    description.trim().length < MIN_DESCRIPTION_CHARS ->
        "Description must be at least $MIN_DESCRIPTION_CHARS characters."
    else -> null
}

fun projectBalance(starting: Int, days: Int): Int = starting + days * DAILY_CHECKIN_COINS

fun daysToAfford(price: Int, balance: Int): Int =
    if (balance >= price) 0 else ceil((price - balance) / DAILY_CHECKIN_COINS.toDouble()).toInt()

/** The cheapest product still out of reach — the farmer's goal. */
fun computeGoal(products: List<Product>, balance: Int): Product? =
    products.filter { it.price > balance }.minByOrNull { it.price }

/** Immutable wallet with a functional-style update. */
data class Wallet(val balance: Int, val history: List<Pair<Int, String>> = emptyList()) {
    fun credit(amount: Int, reason: String): Wallet =
        copy(balance = balance + amount, history = listOf(amount to reason) + history)

    fun debit(amount: Int, reason: String): Wallet? =
        if (balance < amount) null
        else copy(balance = balance - amount, history = listOf(-amount to reason) + history)
}

fun main(args: Array<String>) {
    val days = args.firstOrNull { it.startsWith("--days=") }
        ?.split("=")?.get(1)?.toIntOrNull() ?: 30

    val products = loadProducts()

    println()
    println("┌─────────────────────────────────────────────────────────────┐")
    println("│  🌱 Kisan Store — Kotlin Reward Engine                     │")
    println("│  Data-for-Equipment — Empowering every farmer              │")
    println("└─────────────────────────────────────────────────────────────┘")
    println("  Catalog : ${products.size} products")
    println("  Rules   : +$DAILY_CHECKIN_COINS coins/day · $MIN_PHOTOS photos + "
            + "video ≥${MIN_VIDEO_SECONDS}s + description ≥$MIN_DESCRIPTION_CHARS chars")
    println()

    var wallet = Wallet(STARTING_BALANCE)
    println("  📷 After $days daily check-in day(s):")
    val balance = projectBalance(wallet.balance, days)
    println("     starting $STARTING_BALANCE + earned ${days * DAILY_CHECKIN_COINS} = $balance coins")
    println()

    val error = validateCheckin(3, 7, "Sowed wheat in north field")
    println("  ✓ Validation demo (3 photos / 7s video / description): ${if (error == null) "PASS" else "FAIL → $error"}")
    println()

    val goal = computeGoal(products, balance)
    if (goal != null) {
        println("  🎯 Next goal: ${goal.name} (${goal.price} coins)")
        println("     ${goal.price - balance} more coins needed · progress "
                + "${String.format("%.1f", min(100.0, balance / goal.price.toDouble() * 100))}%")
    } else {
        println("  🏆 You can afford every reward in the catalog!")
    }
    println()

    println("  📋 Redemption plan:")
    for (p in products) {
        val d = daysToAfford(p.price, balance)
        val mark = if (balance >= p.price) "✅ can redeem TODAY"
        else "⏳ $d more check-in day(s) needed"
        println("     ${p.name.padEnd(26)} ${p.price.toString().padStart(6)} coins → $mark")
    }
    println()

    // Demo redemption — cheapest product
    val cheapest = products.first()
    val after = wallet.debit(cheapest.price, "🎁 Redeemed \"${cheapest.name}\"")
    if (after != null) {
        wallet = after
        println("  ✅ Demo redemption: \"${cheapest.name}\" (${cheapest.price} coins) → "
                + "balance now ${wallet.balance} coins")
    } else {
        println("  ❌ Demo redemption blocked: insufficient coins")
    }
    println()
}
