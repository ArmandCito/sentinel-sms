from __future__ import annotations

import hashlib
import logging
from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.db.models import Count
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ScanLog
from .serializers import AnalyzeRequestSerializer, AnalyzeResponseSerializer
from .services.analyzer import AnalysisOutcome, analyze_message

logger = logging.getLogger(__name__)


class HealthView(APIView):
    """Unauthenticated liveness probe. Also tells you what is configured (no secrets)."""

    permission_classes = [AllowAny]
    throttle_classes: list = []

    def get(self, request: Request) -> Response:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            db_ok = True
        except Exception:  # noqa: BLE001 - health must never raise
            logger.exception("Database health check failed")
            db_ok = False
        return Response(
            {
                "status": "ok" if db_ok else "degraded",
                "database": "up" if db_ok else "down",
                "ai_provider": settings.AI_PROVIDER,
                "ai_configured": settings.AI_PROVIDER != "none" and bool(settings.AI_API_KEY),
                "api_key_required": bool(settings.APP_API_KEY),
            },
            status=200 if db_ok else 503,
        )


class AnalyzeView(APIView):
    """POST an SMS, get a hybrid (rules + AI) risk assessment."""

    def post(self, request: Request) -> Response:
        serializer = AnalyzeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        outcome = analyze_message(data["sender"], data["body"], locale=data.get("locale", ""))
        self._log(data, outcome)
        return Response(AnalyzeResponseSerializer(outcome.to_dict()).data)

    @staticmethod
    def _log(data: dict, outcome: AnalysisOutcome) -> None:
        """Persist the scan. A DB hiccup must never break the user's analysis."""
        body: str = data["body"]
        try:
            ScanLog.objects.create(
                id=outcome.analysis_id,
                device_id=data.get("device_id", "")[:64],
                sender=data["sender"][:64],
                body_hash=hashlib.sha256(body.encode()).hexdigest(),
                body_preview=body[:160] if settings.STORE_MESSAGE_BODY else "",
                offline_score=outcome.offline_score,
                ai_score=outcome.ai_score,
                final_score=outcome.final_score,
                verdict=outcome.verdict,
                provider=outcome.provider[:32],
                categories=outcome.categories,
                latency_ms=outcome.latency_ms,
            )
        except Exception:  # noqa: BLE001
            logger.exception("Could not persist ScanLog")


class StatsView(APIView):
    """Aggregate counters (no message content)."""

    def get(self, request: Request) -> Response:
        since = timezone.now() - timedelta(hours=24)
        by_verdict = {row["verdict"]: row["n"] for row in ScanLog.objects.values("verdict").annotate(n=Count("id"))}
        return Response(
            {
                "total": ScanLog.objects.count(),
                "last_24h": ScanLog.objects.filter(created_at__gte=since).count(),
                "by_verdict": {v: by_verdict.get(v, 0) for v in ("safe", "caution", "danger")},
            }
        )
