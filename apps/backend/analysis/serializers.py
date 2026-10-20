"""Request/response serializers. Mirrors packages/contracts/src/index.ts."""
from __future__ import annotations

from django.conf import settings
from rest_framework import serializers


class AnalyzeRequestSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=64, allow_blank=True, required=False, default="")
    sender = serializers.CharField(max_length=64, allow_blank=True, required=False, default="unknown")
    body = serializers.CharField(max_length=settings.MAX_BODY_CHARS, trim_whitespace=True)
    locale = serializers.CharField(max_length=16, required=False, allow_blank=True, default="")


class RuleHitSerializer(serializers.Serializer):
    id = serializers.CharField()
    label = serializers.CharField()
    category = serializers.CharField()
    weight = serializers.IntegerField()


class AnalyzeResponseSerializer(serializers.Serializer):
    analysis_id = serializers.CharField()
    offline_score = serializers.IntegerField()
    ai_score = serializers.IntegerField(allow_null=True)
    final_score = serializers.IntegerField()
    verdict = serializers.ChoiceField(choices=["safe", "caution", "danger"])
    provider = serializers.CharField()
    summary = serializers.CharField(allow_blank=True)
    reasons = serializers.ListField(child=serializers.CharField())
    categories = serializers.ListField(child=serializers.CharField())
    hits = RuleHitSerializer(many=True)
    latency_ms = serializers.IntegerField()
