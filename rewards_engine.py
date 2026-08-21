"""═══════════════════════════════════════════════════════════════════
Kisan Store — backend/reward_engine.py
Pure reward logic (no I/O): check-in validation, coin projection,
goal computation and redemption. The exact same rules implemented
by the browser app (JS/TS), Dart, Go, Java, Kotlin, C++, PHP and Ruby.

Rules (single source of truth: data/catalog.json → rewards.*):
    • daily check-in  = 3 photos + 1 video (≥5 s) + description (≥10 chars)
    • reward          = +5 coins, once per calendar day
    • referral        = +50 coins · survey quiz = +10 coins (one time)
    • starting wallet = 1,250 coins
═══════════════════════════════════════════════════════════════════"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

DEFAULT_RULES = {
    "dailyCheckinCoins": 5,
    "minPhotos": 3,
    "minVideoSeconds": 5,
    "minDescriptionChars": 10,
    "referralCoins": 50,
    "quizCoins": 10,
    "startingBalance": 1250,
    "deliveryDays": "3-5",
}


@dataclass(frozen=True)
class Product:
    """A single reward product (mirrors data/catalog.json)."""

    id: int
    name: str
    desc: str
    category: str
    price: int
    rating: float
    reviews: int
    redeemed: int
    trending: bool
    tags: list = field(default_factory=list)
    old_price: Optional[int] = None
    img: str = "assets/img/product.png"

    @property
    def is_on_offer(self) -> bool:
        return bool(self.old_price and self.old_price > self.price)

    @property
    def discount_percent(self) -> int:
        if not self.is_on_offer:
            return 0
        return round((1 - self.price / self.old_price) * 100)

    @classmethod
    def from_json(cls, data: dict) -> "Product":
        return cls(
            id=int(data["id"]),
            name=data["name"],
            desc=data.get("desc", ""),
            category=data.get("category", "utility"),
            price=int(data["price"]),
            rating=float(data.get("rating", 4.5)),
            reviews=int(data.get("reviews", 0)),
            redeemed=int(data.get("redeemed", 0)),
            trending=bool(data.get("trending", False)),
            tags=list(data.get("tags", [])),
            old_price=data.get("oldPrice"),
            img=data.get("img", "assets/img/product.png"),
        )


@dataclass(frozen=True)
class CheckinValidation:
    """Outcome of validating a daily farm check-in."""

    ok: bool
    missing_photos: int = 0
    need_video: bool = False
    need_description: bool = False

    def to_dict(self) -> dict:
        return {
            "ok": self.ok,
            "missingPhotos": self.missing_photos,
            "needVideo": self.need_video,
            "needDescription": self.need_description,
        }


def validate_checkin(
    photo_count: int,
    video_seconds: int,
    description: str,
    rules: Optional[dict] = None,
) -> CheckinValidation:
    """Validate a daily check-in against the reward rules."""
    r = {**DEFAULT_RULES, **(rules or {})}
    need_video = video_seconds < r["minVideoSeconds"]
    need_description = len(description.strip()) < r["minDescriptionChars"]
    if photo_count >= r["minPhotos"] and not need_video and not need_description:
        return CheckinValidation(ok=True)
    return CheckinValidation(
        ok=False,
        missing_photos=max(0, r["minPhotos"] - photo_count),
        need_video=need_video,
        need_description=need_description,
    )


def project_balance(starting_balance: int, days: int, rules: Optional[dict] = None) -> dict:
    """Project a wallet balance after `days` consecutive daily check-ins."""
    r = {**DEFAULT_RULES, **(rules or {})}
    earned = days * r["dailyCheckinCoins"]
    return {"balance": starting_balance + earned, "earned": earned}


def days_to_afford(price: int, current_balance: int, rules: Optional[dict] = None) -> int:
    """Days of consecutive check-ins required to afford `price`."""
    r = {**DEFAULT_RULES, **(rules or {})}
    if current_balance >= price:
        return 0
    return math.ceil((price - current_balance) / r["dailyCheckinCoins"])


def compute_goal(products: list, balance: int) -> dict:
    """Find the cheapest product still out of reach — the farmer's goal."""
    for product in sorted(products, key=lambda p: p.price):
        if product.price > balance:
            return {
                "goal": product,
                "needed": product.price - balance,
                "progressPct": round(min(100.0, (balance / product.price) * 100), 1),
            }
    return {"goal": None, "needed": 0, "progressPct": 100.0}


@dataclass(frozen=True)
class RedemptionResult:
    ok: bool
    balance: int
    reason: Optional[str] = None
    product: Optional[Product] = None

    def to_dict(self) -> dict:
        return {
            "ok": self.ok,
            "balance": self.balance,
            "reason": self.reason,
            "product": self.product.name if self.product else None,
        }


def redeem(products: list, product_id: int, balance: int) -> RedemptionResult:
    """Attempt to redeem a product; never lets the balance go negative."""
    product = next((p for p in products if p.id == product_id), None)
    if product is None:
        return RedemptionResult(ok=False, balance=balance, reason="unknown-product")
    if balance < product.price:
        return RedemptionResult(ok=False, balance=balance, reason="insufficient")
    return RedemptionResult(ok=True, balance=balance - product.price, product=product)
