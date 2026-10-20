from __future__ import annotations

import uuid

from django.db import models


class Verdict(models.TextChoices):
    SAFE = "safe", "Safe"
    CAUTION = "caution", "Caution"
    DANGER = "danger", "Danger"


class ScanLog(models.Model):
    """One analysed SMS. The raw text is NOT stored unless STORE_MESSAGE_BODY=True."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device_id = models.CharField(max_length=64, db_index=True)
    sender = models.CharField(max_length=64)
    body_hash = models.CharField(max_length=64, db_index=True, help_text="SHA-256 of the message body")
    body_preview = models.CharField(max_length=160, blank=True)
    offline_score = models.PositiveSmallIntegerField()
    ai_score = models.PositiveSmallIntegerField(null=True, blank=True)
    final_score = models.PositiveSmallIntegerField()
    verdict = models.CharField(max_length=10, choices=Verdict.choices, db_index=True)
    provider = models.CharField(max_length=32)
    categories = models.JSONField(default=list, blank=True)
    latency_ms = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.verdict} ({self.final_score}) from {self.sender}"
