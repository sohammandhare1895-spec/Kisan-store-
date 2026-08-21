/// ═══════════════════════════════════════════════════════════════
/// Kisan Store — dart/lib/models.dart
/// Domain models for the Dart reward engine. These classes mirror
/// data/catalog.json — the same catalog consumed by the website
/// (JS/TS), Python, Go, Java, Kotlin, C++, PHP and Ruby.
/// ═══════════════════════════════════════════════════════════════

import 'dart:convert';

/// A single reward product in the store.
class Product {
  const Product({
    required this.id,
    required this.name,
    required this.desc,
    required this.category,
    required this.price,
    this.oldPrice,
    required this.rating,
    required this.reviews,
    required this.redeemed,
    required this.trending,
    required this.tags,
    required this.img,
  });

  final int id;
  final String name;
  final String desc;
  final String category;
  final int price;
  final int? oldPrice; // present => product is on offer
  final double rating;
  final int reviews;
  final int redeemed;
  final bool trending;
  final List<String> tags;
  final String img;

  bool get isOnOffer => oldPrice != null && oldPrice! > price;

  int get discountPercent =>
      isOnOffer ? (((oldPrice! - price) / oldPrice!) * 100).round() : 0;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as int,
        name: json['name'] as String,
        desc: json['desc'] as String,
        category: json['category'] as String,
        price: json['price'] as int,
        oldPrice: json['oldPrice'] as int?,
        rating: (json['rating'] as num).toDouble(),
        reviews: json['reviews'] as int,
        redeemed: json['redeemed'] as int,
        trending: json['trending'] as bool? ?? false,
        tags: (json['tags'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .toList(),
        img: json['img'] as String? ?? 'assets/img/product.png',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'desc': desc,
        'category': category,
        'price': price,
        if (oldPrice != null) 'oldPrice': oldPrice,
        'rating': rating,
        'reviews': reviews,
        'redeemed': redeemed,
        'trending': trending,
        'tags': tags,
        'img': img,
      };
}

/// The reward rules — identical across every language in this repo.
class RewardRules {
  const RewardRules({
    this.dailyCheckinCoins = 5,
    this.minPhotos = 3,
    this.minVideoSeconds = 5,
    this.minDescriptionChars = 10,
    this.referralCoins = 50,
    this.quizCoins = 10,
    this.startingBalance = 1250,
    this.deliveryDays = '3-5',
  });

  final int dailyCheckinCoins;
  final int minPhotos;
  final int minVideoSeconds;
  final int minDescriptionChars;
  final int referralCoins;
  final int quizCoins;
  final int startingBalance;
  final String deliveryDays;

  factory RewardRules.fromJson(Map<String, dynamic> json) => RewardRules(
        dailyCheckinCoins: json['dailyCheckinCoins'] as int? ?? 5,
        minPhotos: json['minPhotos'] as int? ?? 3,
        minVideoSeconds: json['minVideoSeconds'] as int? ?? 5,
        minDescriptionChars: json['minDescriptionChars'] as int? ?? 10,
        referralCoins: json['referralCoins'] as int? ?? 50,
        quizCoins: json['quizCoins'] as int? ?? 10,
        startingBalance: json['startingBalance'] as int? ?? 1250,
        deliveryDays: json['deliveryDays'] as String? ?? '3-5',
      );
}

/// A single coin ledger entry.
class LedgerEntry {
  const LedgerEntry({
    required this.amount,
    required this.reason,
    required this.at,
  });

  final int amount; // + earned, − spent
  final String reason;
  final DateTime at;

  bool get isEarning => amount >= 0;

  Map<String, dynamic> toJson() =>
      {'amount': amount, 'reason': reason, 'at': at.toIso8601String()};

  factory LedgerEntry.fromJson(Map<String, dynamic> json) => LedgerEntry(
        amount: json['amount'] as int,
        reason: json['reason'] as String,
        at: DateTime.parse(json['at'] as String),
      );
}

/// The full catalog document (data/catalog.json).
class Catalog {
  const Catalog({
    required this.meta,
    required this.rewards,
    required this.categories,
    required this.products,
  });

  final Map<String, dynamic> meta;
  final RewardRules rewards;
  final List<Map<String, dynamic>> categories;
  final List<Product> products;

  factory Catalog.fromJson(Map<String, dynamic> json) => Catalog(
        meta: (json['meta'] as Map<String, dynamic>? ?? const {}),
        rewards: RewardRules.fromJson(
            json['rewards'] as Map<String, dynamic>? ?? const {}),
        categories: (json['categories'] as List<dynamic>? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList(),
        products: (json['products'] as List<dynamic>? ?? const [])
            .map((e) => Product.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
      );

  factory Catalog.fromJsonString(String source) =>
      Catalog.fromJson(jsonDecode(source) as Map<String, dynamic>);
}
