/*
═══════════════════════════════════════════════════════════════════
Kisan Store — cpp/reward_calc.cpp
The reward engine in C++17 (stdlib only). Reads the generated
data/catalog.tsv (produced from data/catalog.json by
scripts/gen_tsv.py) — so it always agrees with the website.

  make run-cpp        (compiles & runs from the repo root)
  g++ -std=c++17 -O2 cpp/reward_calc.cpp -o build/reward_calc
═══════════════════════════════════════════════════════════════════
*/

#include <algorithm>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

/* ── Reward rules — mirror of data/catalog.json → rewards ── */
static constexpr int DAILY_CHECKIN_COINS = 5;
static constexpr int MIN_PHOTOS = 3;
static constexpr int MIN_VIDEO_SECONDS = 5;
static constexpr int MIN_DESCRIPTION_CHARS = 10;
static constexpr int REFERRAL_COINS = 50;
static constexpr int QUIZ_COINS = 10;
static constexpr int STARTING_BALANCE = 1250;

/** A single reward product row from the catalog TSV. */
struct Product {
    int id;
    std::string name;
    std::string category;
    int price;
    int oldPrice;      // 0 ⇒ not on offer
    double rating;
    int reviews;
    int redeemed;
    bool trending;

    bool isOnOffer() const { return oldPrice > price; }
};

/** Split a line on tabs (catalog.tsv uses tab separators). */
static std::vector<std::string> splitTabs(const std::string& line) {
    std::vector<std::string> fields;
    std::string current;
    for (char ch : line) {
        if (ch == '\t') {
            fields.push_back(current);
            current.clear();
        } else {
            current.push_back(ch);
        }
    }
    fields.push_back(current);
    return fields;
}

/** Parse catalog.tsv into products. */
static std::vector<Product> loadProducts(const std::string& path) {
    std::ifstream in(path);
    if (!in) {
        throw std::runtime_error(
            "data/catalog.tsv not found — run: python3 scripts/gen_tsv.py");
    }
    std::vector<Product> products;
    std::string line;
    std::getline(in, line); // skip header
    while (std::getline(in, line)) {
        auto f = splitTabs(line);
        if (f.size() < 9) continue;
        Product p;
        p.id = std::stoi(f[0]);
        p.name = f[1];
        p.category = f[2];
        p.price = std::stoi(f[3]);
        p.oldPrice = f[4].empty() ? 0 : std::stoi(f[4]);
        p.rating = std::stod(f[5]);
        p.reviews = std::stoi(f[6]);
        p.redeemed = std::stoi(f[7]);
        p.trending = (f[8] == "true" || f[8] == "1");
        products.push_back(p);
    }
    std::sort(products.begin(), products.end(),
              [](const Product& a, const Product& b) { return a.id < b.id; });
    return products;
}

/** Validate a daily check-in; empty string ⇒ valid. */
static std::string validateCheckin(int photoCount, int videoSeconds,
                                   const std::string& description) {
    if (photoCount < MIN_PHOTOS) {
        return "need " + std::to_string(MIN_PHOTOS - photoCount) + " more photo(s)";
    }
    if (videoSeconds < MIN_VIDEO_SECONDS) {
        return "video must be at least " + std::to_string(MIN_VIDEO_SECONDS) + " seconds";
    }
    if (static_cast<int>(description.size()) < MIN_DESCRIPTION_CHARS) {
        return "description must be at least " +
               std::to_string(MIN_DESCRIPTION_CHARS) + " characters";
    }
    return "";
}

static int projectBalance(int starting, int days) {
    return starting + days * DAILY_CHECKIN_COINS;
}

static int daysToAfford(int price, int balance) {
    if (balance >= price) return 0;
    return static_cast<int>(std::ceil((price - balance) /
                                      static_cast<double>(DAILY_CHECKIN_COINS)));
}

int main(int argc, char** argv) {
    int days = 30;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg.rfind("--days=", 0) == 0) {
            days = std::max(0, std::stoi(arg.substr(7)));
        }
    }

    std::vector<Product> products;
    try {
        products = loadProducts("data/catalog.tsv");
    } catch (const std::exception& e) {
        std::cerr << "❌ " << e.what() << "\n";
        return 1;
    }

    std::cout << "\n┌─────────────────────────────────────────────────────────────┐\n";
    std::cout << "│  🌱 Kisan Store — C++17 Reward Engine                      │\n";
    std::cout << "│  Data-for-Equipment — Empowering every farmer              │\n";
    std::cout << "└─────────────────────────────────────────────────────────────┘\n";
    std::cout << "  Catalog : " << products.size() << " products\n";
    std::cout << "  Rules   : +" << DAILY_CHECKIN_COINS << " coins/day · " << MIN_PHOTOS
              << " photos + video ≥" << MIN_VIDEO_SECONDS << "s + description ≥"
              << MIN_DESCRIPTION_CHARS << " chars\n\n";

    int balance = projectBalance(STARTING_BALANCE, days);
    std::cout << "  📷 After " << days << " daily check-in day(s):\n";
    std::cout << "     starting " << STARTING_BALANCE << " + earned "
              << days * DAILY_CHECKIN_COINS << " = " << balance << " coins\n\n";

    std::string err = validateCheckin(3, 7, "Sowed wheat in north field");
    std::cout << "  ✓ Validation demo (3 photos / 7s video / description): "
              << (err.empty() ? "PASS" : "FAIL → " + err) << "\n\n";

    const Product* goal = nullptr;
    for (const auto& p : products) {
        if (p.price > balance && (!goal || p.price < goal->price)) goal = &p;
    }
    if (goal) {
        std::cout << "  🎯 Next goal: " << goal->name << " (" << goal->price << " coins)\n";
        std::cout << "     " << goal->price - balance << " more coins needed · progress "
                  << std::fixed << std::setprecision(1)
                  << std::min(100.0, (balance / static_cast<double>(goal->price)) * 100)
                  << "%\n\n";
    } else {
        std::cout << "  🏆 You can afford every reward in the catalog!\n\n";
    }

    std::cout << "  📋 Redemption plan:\n";
    for (const auto& p : products) {
        int d = daysToAfford(p.price, balance);
        std::cout << "     " << std::left << std::setw(26) << p.name
                  << std::right << std::setw(6) << p.price << " coins → "
                  << (balance >= p.price
                          ? "✅ can redeem TODAY"
                          : "⏳ " + std::to_string(d) + " more check-in day(s) needed")
                  << "\n";
    }
    std::cout << "\n";

    const Product& cheapest = *std::min_element(
        products.begin(), products.end(),
        [](const Product& a, const Product& b) { return a.price < b.price; });
    if (balance >= cheapest.price) {
        std::cout << "  ✅ Demo redemption: \"" << cheapest.name << "\" ("
                  << cheapest.price << " coins) → balance now "
                  << balance - cheapest.price << " coins\n\n";
    } else {
        std::cout << "  ❌ Demo redemption blocked: insufficient coins\n\n";
    }
    return 0;
}
