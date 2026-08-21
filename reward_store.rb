# ═══════════════════════════════════════════════════════════════
# Kisan Store — ruby/reward_store.rb
# The reward engine in Ruby. Reads the SAME data/catalog.json the
# website uses, so every port agrees on prices and rules.
#
#   ruby ruby/reward_store.rb
#   ruby ruby/reward_store.rb --days 45
# ═══════════════════════════════════════════════════════════════

require 'json'

# ── Reward rules — mirror of data/catalog.json → rewards ──
DAILY_CHECKIN_COINS   = 5
MIN_PHOTOS            = 3
MIN_VIDEO_SECONDS     = 5
MIN_DESCRIPTION_CHARS = 10
REFERRAL_COINS        = 50
QUIZ_COINS            = 10
STARTING_BALANCE      = 1_250

module KisanStore
  # A single reward product (mirrors data/catalog.json).
  Product = Struct.new(
    :id, :name, :desc, :category, :price, :old_price, :rating,
    :reviews, :redeemed, :trending, :tags, :img,
    keyword_init: true
  ) do
    def on_offer?
      old_price && old_price > price
    end

    def discount_percent
      on_offer? ? ((1 - price.to_f / old_price) * 100).round : 0
    end
  end

  # The shared catalog document.
  class Catalog
    attr_reader :meta, :rules, :categories, :products

    def self.load
      candidates = [
        File.expand_path('../data/catalog.json', __dir__),
        File.expand_path('../../data/catalog.json', __dir__),
        File.expand_path('../../../data/catalog.json', __dir__),
        'data/catalog.json'
      ]
      path = candidates.find { |c| File.exist?(c) }
      raise 'data/catalog.json not found — run from the repo root.' unless path

      new(JSON.parse(File.read(path)))
    end

    def initialize(doc)
      @meta = doc.fetch('meta', {})
      @rules = doc.fetch('rewards', {})
      @categories = doc.fetch('categories', [])
      @products = doc.fetch('products', []).map do |p|
        Product.new(
          id: p['id'], name: p['name'], desc: p['desc'],
          category: p['category'], price: p['price'],
          old_price: p['oldPrice'], rating: p['rating'],
          reviews: p['reviews'], redeemed: p['redeemed'],
          trending: p.fetch('trending', false),
          tags: p.fetch('tags', []), img: p.fetch('img', 'assets/img/product.png')
        )
      end.sort_by(&:id)
    end
  end

  # Pure reward logic — the Ruby twin of the JS/Python/Dart engines.
  class RewardEngine
    attr_reader :rules

    def initialize(rules = {})
      @rules = {
        'dailyCheckinCoins' => DAILY_CHECKIN_COINS,
        'minPhotos' => MIN_PHOTOS,
        'minVideoSeconds' => MIN_VIDEO_SECONDS,
        'minDescriptionChars' => MIN_DESCRIPTION_CHARS,
        'referralCoins' => REFERRAL_COINS,
        'quizCoins' => QUIZ_COINS,
        'startingBalance' => STARTING_BALANCE
      }.merge(rules)
    end

    # Returns an array of problems; empty ⇒ valid.
    def validate_checkin(photo_count:, video_seconds:, description:)
      problems = []
      problems << "need #{rules['minPhotos'] - photo_count} more photo(s)" if photo_count < rules['minPhotos']
      problems << "video must be ≥ #{rules['minVideoSeconds']}s" if video_seconds < rules['minVideoSeconds']
      problems << "description must be ≥ #{rules['minDescriptionChars']} chars" if description.strip.length < rules['minDescriptionChars']
      problems
    end

    def project_balance(starting, days)
      starting + days * rules['dailyCheckinCoins']
    end

    def days_to_afford(price, balance)
      return 0 if balance >= price

      ((price - balance).to_f / rules['dailyCheckinCoins']).ceil
    end

    # The cheapest product still out of reach — the farmer's goal.
    def compute_goal(products, balance)
      products.select { |p| p.price > balance }.min_by(&:price)
    end

    def redeem(products, product_id, balance)
      product = products.find { |p| p.id == product_id }
      raise ArgumentError, "unknown product id #{product_id}" unless product
      raise ArgumentError, "insufficient coins: need #{product.price - balance} more for \"#{product.name}\"" if balance < product.price

      balance - product.price
    end
  end

  # Immutable-ish wallet with a ledger.
  class CoinWallet
    attr_reader :balance, :ledger

    def initialize(balance)
      @balance = balance
      @ledger = []
    end

    def credit(amount, reason)
      @balance += amount
      @ledger.unshift([amount, reason, Time.now])
      @balance
    end

    def debit(amount, reason)
      return false if @balance < amount

      @balance -= amount
      @ledger.unshift([-amount, reason, Time.now])
      true
    end
  end
end

# ── CLI ──
if $PROGRAM_NAME == __FILE__
  days = (ARGV.find { |a| a.start_with?('--days=') }&.split('=')&.last || 30).to_i

  catalog = KisanStore::Catalog.load
  engine = KisanStore::RewardEngine.new(catalog.rules)

  puts
  puts '┌─────────────────────────────────────────────────────────────┐'
  puts "│  🌱 #{catalog.meta['storeName']} — Ruby Reward Engine".ljust(62) + '│'
  puts '│  Data-for-Equipment — Empowering every farmer               │'
  puts '└─────────────────────────────────────────────────────────────┘'
  puts "  Catalog : #{catalog.products.size} products · #{catalog.categories.size} categories"
  r = engine.rules
  puts "  Rules   : +#{r['dailyCheckinCoins']} coins/day · #{r['minPhotos']} photos + video ≥#{r['minVideoSeconds']}s + description ≥#{r['minDescriptionChars']} chars"
  puts

  balance = engine.project_balance(STARTING_BALANCE, days)
  puts "  📷 After #{days} daily check-in day(s):"
  puts "     starting #{STARTING_BALANCE} + earned #{days * DAILY_CHECKIN_COINS} = #{balance} coins"
  puts

  problems = engine.validate_checkin(photo_count: 3, video_seconds: 7, description: 'Sowed wheat in north field')
  puts "  ✓ Validation demo (3 photos / 7s video / description): #{problems.empty? ? 'PASS' : 'FAIL → ' + problems.join('; ')}"
  puts

  goal = engine.compute_goal(catalog.products, balance)
  if goal
    puts "  🎯 Next goal: #{goal.name} (#{goal.price} coins)"
    puts "     #{goal.price - balance} more coins needed · progress #{format('%.1f', [100.0, balance.to_f / goal.price * 100].min)}%"
  else
    puts '  🏆 You can afford every reward in the catalog!'
  end
  puts

  puts '  📋 Redemption plan:'
  catalog.products.each do |p|
    d = engine.days_to_afford(p.price, balance)
    mark = balance >= p.price ? '✅ can redeem TODAY' : "⏳ #{d} more check-in day(s) needed"
    puts format('     %-26s %6d coins → %s', p.name, p.price, mark)
  end
  puts

  cheapest = catalog.products.min_by(&:price)
  begin
    after = engine.redeem(catalog.products, cheapest.id, balance)
    puts "  ✅ Demo redemption: \"#{cheapest.name}\" (#{cheapest.price} coins) → balance now #{after} coins"
  rescue ArgumentError => e
    puts "  ❌ Demo redemption blocked: #{e.message}"
  end
  puts
end
