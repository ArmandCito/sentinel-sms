from __future__ import annotations

from unittest.mock import patch

from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from .models import ScanLog
from .services import heuristics
from .services.ai_client import AIError, AIResult, parse_ai_json
from .services.analyzer import blend

PHISH = ("URGENT: Your bank account is suspended. Verify now at http://bit.ly/x9Kd2 "
         "and confirm your PIN within 24 hours.")
SAFE_OTP = "123456 is your verification code. Never share this code with anyone."
FR_PHISH = "Félicitations ! Vous avez gagné 500000 FRW. Cliquez ici https://claim-prize.xyz/go"
MOMO = "Hello, I sent you 20,000 RWF by mistake on MoMo. Please send it back urgently."


class HeuristicTests(SimpleTestCase):
    def test_phishing_is_danger(self) -> None:
        r = heuristics.analyze(PHISH)
        self.assertGreaterEqual(r.score, 65)
        self.assertEqual(heuristics.verdict_for(r.score), "danger")

    def test_genuine_otp_is_safe(self) -> None:
        self.assertEqual(heuristics.verdict_for(heuristics.analyze(SAFE_OTP).score), "safe")

    def test_french_prize_scam(self) -> None:
        self.assertGreaterEqual(heuristics.analyze(FR_PHISH).score, 65)

    def test_money_by_mistake_is_flagged(self) -> None:
        self.assertGreaterEqual(heuristics.analyze(MOMO).score, 35)

    def test_plain_chat_scores_zero(self) -> None:
        self.assertEqual(heuristics.analyze("See you at 6pm for dinner?").score, 0)


class BlendTests(SimpleTestCase):
    def test_no_ai_keeps_offline(self) -> None:
        self.assertEqual(blend(42, None), 42)

    def test_ai_can_raise_unknown_scam(self) -> None:
        self.assertGreaterEqual(blend(0, 95), 65)

    def test_ai_cannot_erase_strong_rules(self) -> None:
        self.assertGreaterEqual(blend(90, 0), 60)

    def test_ai_can_reduce_false_positive(self) -> None:
        self.assertLess(blend(40, 5), 35)


class ParseTests(SimpleTestCase):
    def test_parses_fenced_json_and_clamps(self) -> None:
        out = parse_ai_json('```json\n{"risk_score": 140, "category": "bogus", "summary": "x", "reasons": ["a"]}\n```')
        self.assertEqual(out.score, 100)
        self.assertEqual(out.category, "other_scam")

    def test_rejects_garbage(self) -> None:
        with self.assertRaises(AIError):
            parse_ai_json("sorry I cannot help")


class ApiTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.url = "/api/v1/analyze/"

    def test_health(self) -> None:
        res = self.client.get("/api/health/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")

    @override_settings(AI_PROVIDER="none")
    def test_analyze_rules_only(self) -> None:
        res = self.client.post(self.url, {"device_id": "d1", "sender": "BANK", "body": PHISH}, format="json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["verdict"], "danger")
        self.assertIsNone(data["ai_score"])
        self.assertEqual(data["provider"], "heuristics")
        log = ScanLog.objects.get()
        self.assertEqual(log.body_preview, "")  # privacy default
        self.assertEqual(len(log.body_hash), 64)

    def test_analyze_with_mocked_ai(self) -> None:
        class FakeClient:
            name = "fake"

            def analyze(self, sender, body, hits):
                return AIResult(score=90, summary="Looks like phishing", reasons=["fake link"], category="phishing")

        with patch("analysis.services.analyzer.get_client", return_value=FakeClient()):
            res = self.client.post(self.url, {"sender": "x", "body": PHISH}, format="json")
        self.assertEqual(res.json()["provider"], "fake")
        self.assertEqual(res.json()["verdict"], "danger")

    def test_ai_failure_falls_back_to_rules(self) -> None:
        class Broken:
            name = "broken"

            def analyze(self, *a):
                raise AIError("boom")

        with patch("analysis.services.analyzer.get_client", return_value=Broken()):
            res = self.client.post(self.url, {"sender": "x", "body": PHISH}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["provider"], "heuristics-fallback")

    @override_settings(APP_API_KEY="secret")
    def test_api_key_enforced(self) -> None:
        self.assertEqual(self.client.post(self.url, {"body": "hi"}, format="json").status_code, 403)
        ok = self.client.post(self.url, {"body": "hi"}, format="json", HTTP_X_API_KEY="secret")
        self.assertEqual(ok.status_code, 200)

    def test_empty_body_rejected(self) -> None:
        self.assertEqual(self.client.post(self.url, {"body": ""}, format="json").status_code, 400)
