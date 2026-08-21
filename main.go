/*
═══════════════════════════════════════════════════════════════════
Kisan Store — go/main.go
The reward engine in Go. Reads the SAME data/catalog.json used by
the website, Python, Dart, TypeScript, Ruby and PHP — so every port
of the engine always agrees on prices and rules.

  cd go && go run .
  cd go && go run . --days 45
═══════════════════════════════════════════════════════════════════
*/

package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

/* ── Reward rules — mirror of data/catalog.json → rewards ── */
const (
	DailyCheckinCoins    = 5
	MinPhotos            = 3
	MinVideoSeconds      = 5
	MinDescriptionChars  = 10
	ReferralCoins        = 50
	QuizCoins            = 10
	StartingBalance      = 1250
)

/* ── Catalog models ── */

type Catalog struct {
	Meta       map[string]any   `json:"meta"`
	Rewards    RewardRules      `json:"rewards"`
	Categories []Category       `json:"categories"`
	Products   []Product        `json:"products"`
}

type RewardRules struct {
	DailyCheckinCoins    int    `json:"dailyCheckinCoins"`
	MinPhotos            int    `json:"minPhotos"`
	MinVideoSeconds      int    `json:"minVideoSeconds"`
	MinDescriptionChars  int    `json:"minDescriptionChars"`
	ReferralCoins        int    `json:"referralCoins"`
	QuizCoins            int    `json:"quizCoins"`
	StartingBalance      int    `json:"startingBalance"`
	DeliveryDays         string `json:"deliveryDays"`
}

type Category struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
}

type Product struct {
	ID        int      `json:"id"`
	Name      string   `json:"name"`
	Desc      string   `json:"desc"`
	Category  string   `json:"category"`
	Price     int      `json:"price"`
	OldPrice  int      `json:"oldPrice"`
	Rating    float64  `json:"rating"`
	Reviews   int      `json:"reviews"`
	Redeemed  int      `json:"redeemed"`
	Trending  bool     `json:"trending"`
	Tags      []string `json:"tags"`
	Img       string   `json:"img"`
}

// IsOnOffer reports whether the product has an active discount.
func (p Product) IsOnOffer() bool { return p.OldPrice > p.Price }

// DiscountPercent returns the rounded discount percentage.
func (p Product) DiscountPercent() int {
	if !p.IsOnOffer() {
		return 0
	}
	return int(math.Round((1 - float64(p.Price)/float64(p.OldPrice)) * 100))
}

/* ── Catalog loading (walk upward until data/ is found) ── */

func findCatalogPath() string {
	dir, err := os.Getwd()
	if err != nil {
		dir = "."
	}
	for i := 0; i < 6; i++ {
		candidate := filepath.Join(dir, "data", "catalog.json")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "data/catalog.json"
}

func loadCatalog() (Catalog, error) {
	var catalog Catalog
	raw, err := os.ReadFile(findCatalogPath())
	if err != nil {
		return catalog, fmt.Errorf("data/catalog.json not found (run from the repo root): %w", err)
	}
	if err := json.Unmarshal(raw, &catalog); err != nil {
		return catalog, err
	}
	return catalog, nil
}

/* ── Reward engine ── */

// ValidateCheckin returns a list of problems; empty ⇒ valid.
func ValidateCheckin(photoCount, videoSeconds int, description string) []string {
	var problems []string
	if photoCount < MinPhotos {
		problems = append(problems, fmt.Sprintf("need %d more photo(s)", MinPhotos-photoCount))
	}
	if videoSeconds < MinVideoSeconds {
		problems = append(problems, fmt.Sprintf("video must be ≥ %ds", MinVideoSeconds))
	}
	if len(strings.TrimSpace(description)) < MinDescriptionChars {
		problems = append(problems, fmt.Sprintf("description must be ≥ %d chars", MinDescriptionChars))
	}
	return problems
}

func ProjectBalance(starting, days int) int {
	return starting + days*DailyCheckinCoins
}

func DaysToAfford(price, balance int) int {
	if balance >= price {
		return 0
	}
	return int(math.Ceil(float64(price-balance) / float64(DailyCheckinCoins)))
}

// ComputeGoal finds the cheapest product still out of reach.
func ComputeGoal(products []Product, balance int) *Product {
	sorted := make([]Product, len(products))
	copy(sorted, products)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Price < sorted[j].Price })
	for i := range sorted {
		if sorted[i].Price > balance {
			return &sorted[i]
		}
	}
	return nil
}

// Redeem deducts the price; returns the new balance or an error.
func Redeem(products []Product, productID, balance int) (int, error) {
	for _, p := range products {
		if p.ID == productID {
			if balance < p.Price {
				return balance, fmt.Errorf("insufficient coins: need %d more for %q", p.Price-balance, p.Name)
			}
			return balance - p.Price, nil
		}
	}
	return balance, fmt.Errorf("unknown product id %d", productID)
}

/* ── CLI ── */

func main() {
	days := 30
	for _, arg := range os.Args[1:] {
		if strings.HasPrefix(arg, "--days=") {
			if n, err := strconv.Atoi(strings.TrimPrefix(arg, "--days=")); err == nil && n >= 0 {
				days = n
			}
		}
	}

	catalog, err := loadCatalog()
	if err != nil {
		fmt.Fprintln(os.Stderr, "❌", err)
		os.Exit(1)
	}

	fmt.Println()
	fmt.Println("┌─────────────────────────────────────────────────────────────┐")
	fmt.Printf("│  🌱 %s — Go Reward Engine (stdlib only) %s│\n", catalog.Meta["storeName"], strings.Repeat(" ", 5))
	fmt.Println("│  Data-for-Equipment — Empowering every farmer               │")
	fmt.Println("└─────────────────────────────────────────────────────────────┘")
	fmt.Printf("  Catalog : %d products · %d categories\n", len(catalog.Products), len(catalog.Categories))
	fmt.Printf("  Rules   : +%d coins/day · %d photos + video ≥%ds + description ≥%d chars\n",
		DailyCheckinCoins, MinPhotos, MinVideoSeconds, MinDescriptionChars)
	fmt.Println()

	balance := ProjectBalance(StartingBalance, days)
	fmt.Printf("  📷 After %d daily check-in day(s):\n", days)
	fmt.Printf("     starting %d + earned %d = %d coins\n", StartingBalance, days*DailyCheckinCoins, balance)
	fmt.Println()

	problems := ValidateCheckin(3, 7, "Sowed wheat in north field")
	if len(problems) == 0 {
		fmt.Println("  ✓ Validation demo (3 photos / 7s video / description): PASS")
	} else {
		fmt.Println("  ✗ Validation demo FAIL:", strings.Join(problems, "; "))
	}
	fmt.Println()

	if goal := ComputeGoal(catalog.Products, balance); goal != nil {
		fmt.Printf("  🎯 Next goal: %s (%d coins)\n", goal.Name, goal.Price)
		fmt.Printf("     %d more coins needed · progress %.1f%%\n",
			goal.Price-balance, math.Min(100, float64(balance)/float64(goal.Price)*100))
	} else {
		fmt.Println("  🏆 You can afford every reward in the catalog!")
	}
	fmt.Println()

	fmt.Println("  📋 Redemption plan:")
	for _, p := range catalog.Products {
		d := DaysToAfford(p.Price, balance)
		mark := fmt.Sprintf("⏳ %d more check-in day(s) needed", d)
		if balance >= p.Price {
			mark = "✅ can redeem TODAY"
		}
		fmt.Printf("     %-26s %6d coins → %s\n", p.Name, p.Price, mark)
	}
	fmt.Println()

	cheapest := catalog.Products[0]
	for _, p := range catalog.Products {
		if p.Price < cheapest.Price {
			cheapest = p
		}
	}
	if after, err := Redeem(catalog.Products, cheapest.ID, balance); err == nil {
		fmt.Printf("  ✅ Demo redemption: %q (%d coins) → balance now %d coins\n", cheapest.Name, cheapest.Price, after)
	} else {
		fmt.Println("  ❌ Demo redemption blocked:", err)
	}
	fmt.Println()
}
