from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.HealthView.as_view(), name="health"),
    path("v1/analyze/", views.AnalyzeView.as_view(), name="analyze"),
    path("v1/stats/", views.StatsView.as_view(), name="stats"),
]
