"""Optional shared-secret protection for the API."""
from __future__ import annotations

import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request


class HasAppKey(BasePermission):
    """Allows the request when APP_API_KEY is unset, or when the X-API-Key header matches it."""

    message = "Missing or invalid API key."

    def has_permission(self, request: Request, view: object) -> bool:
        expected: str = settings.APP_API_KEY
        if not expected:
            return True
        provided = request.headers.get("X-API-Key", "")
        return hmac.compare_digest(provided.encode(), expected.encode())
