from django.contrib import admin

from .models import ScanLog


@admin.register(ScanLog)
class ScanLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "verdict", "final_score", "offline_score", "ai_score", "provider", "sender")
    list_filter = ("verdict", "provider")
    search_fields = ("sender", "device_id", "body_hash")
    readonly_fields = [f.name for f in ScanLog._meta.fields]
