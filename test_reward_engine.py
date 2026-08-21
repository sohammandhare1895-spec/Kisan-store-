"""═══════════════════════════════════════════════════════════════════
Kisan Store — backend/tests/test_reward_engine.py
Unit tests for the pure reward logic. Run with:

    python3 -m unittest discover -s backend/tests -v
═══════════════════════════════════════════════════════════════════"""

import unittest

from reward_engine import (
    DEFAULT_RULES,
    Product,
    compute_goal,
    days_to_afford,
    project_balance,
    redeem,
    validate_checkin,
)


def make_products():
    return [
        Product(id=1, name="Solar Lantern", desc="12h backup", category="utility",
                price=400, rating=4.7, reviews=130, redeemed=980, trending=True),
        Product(id=11, name="Water Pump", desc="1 HP, 100 ft head", category="irrigation",
                price=1000, rating=4.9, reviews=98, redeemed=560, trending=True),
        Product(id=15, name="Borewell Motor", desc="2 HP submersible", category="irrigation",
                price=2000, rating=4.7, reviews=48, redeemed=260, trending=False),
    ]


class TestCheckinValidation(unittest.TestCase):
    def test_valid_checkin_passes(self):
        v = validate_checkin(3, 7, "Sowed wheat in the north field")
        self.assertTrue(v.ok)

    def test_too_few_photos(self):
        v = validate_checkin(2, 7, "Sowed wheat in the north field")
        self.assertFalse(v.ok)
        self.assertEqual(v.missing_photos, 1)

    def test_video_too_short(self):
        v = validate_checkin(3, 3, "Sowed wheat in the north field")
        self.assertFalse(v.ok)
        self.assertTrue(v.need_video)

    def test_description_too_short(self):
        v = validate_checkin(3, 8, "hi")
        self.assertFalse(v.ok)
        self.assertTrue(v.need_description)

    def test_custom_rules_are_respected(self):
        v = validate_checkin(2, 4, "ok desc here", rules={**DEFAULT_RULES, "minPhotos": 2, "minVideoSeconds": 4})
        self.assertTrue(v.ok)


class TestProjection(unittest.TestCase):
    def test_starting_balance_only(self):
        self.assertEqual(project_balance(1250, 0)["balance"], 1250)

    def test_thirty_days(self):
        res = project_balance(1250, 30)
        self.assertEqual(res["earned"], 150)
        self.assertEqual(res["balance"], 1400)

    def test_days_to_afford(self):
        # 1000 − 1250 → already affordable
        self.assertEqual(days_to_afford(1000, 1250), 0)
        # 1400 − 1000 = 400 → 80 days at +5/day
        self.assertEqual(days_to_afford(1400, 1000), 80)


class TestGoal(unittest.TestCase):
    def test_goal_is_next_unaffordable(self):
        goal = compute_goal(make_products(), 500)
        self.assertIsNotNone(goal["goal"])
        self.assertEqual(goal["goal"].name, "Water Pump")
        self.assertEqual(goal["needed"], 500)

    def test_no_goal_when_rich(self):
        goal = compute_goal(make_products(), 9999)
        self.assertIsNone(goal["goal"])
        self.assertEqual(goal["progressPct"], 100.0)


class TestRedemption(unittest.TestCase):
    def test_successful_redeem(self):
        res = redeem(make_products(), 1, 1250)
        self.assertTrue(res.ok)
        self.assertEqual(res.balance, 850)

    def test_insufficient_coins(self):
        res = redeem(make_products(), 15, 1250)
        self.assertFalse(res.ok)
        self.assertEqual(res.reason, "insufficient")
        self.assertEqual(res.balance, 1250)

    def test_unknown_product(self):
        res = redeem(make_products(), 999, 1250)
        self.assertFalse(res.ok)
        self.assertEqual(res.reason, "unknown-product")


if __name__ == "__main__":
    unittest.main()
