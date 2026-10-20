"""Django settings for SMS Sentinel. Everything configurable comes from environment variables."""
from __future__ import annotations

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from urllib.parse import parse_qs, unquote, urlparse

BASE_DIR = Path(__file__).resolve().parent.parent


def load_env_file(path: Path) -> None:
    """Load simple KEY=VALUE entries without requiring an external dotenv package."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return

    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        name, separator, value = line.partition("=")
        if not separator or not name.strip():
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        os.environ.setdefault(name.strip(), value)


load_env_file(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


def env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


DEBUG = env_bool("DJANGO_DEBUG", False)

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "dev-only-insecure-key"
    else:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is False.")

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,10.0.2.2")
if DEBUG:
    ALLOWED_HOSTS = ["*"]  # lets your phone reach the PC over the LAN while developing
_render_host = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
if _render_host:
    ALLOWED_HOSTS.append(_render_host)
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "analysis",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "sentinel.urls"
WSGI_APPLICATION = "sentinel.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

# SQLite when DATABASE_URL is empty (zero-setup on your PC), PostgreSQL otherwise.
def database_config() -> dict:
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        return {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(BASE_DIR / "db.sqlite3"),
            "CONN_MAX_AGE": 600,
            "CONN_HEALTH_CHECKS": True,
        }

    parsed = urlparse(database_url)
    scheme = parsed.scheme.lower()
    engines = {
        "postgres": "django.db.backends.postgresql",
        "postgresql": "django.db.backends.postgresql",
        "pgsql": "django.db.backends.postgresql",
        "mysql": "django.db.backends.mysql",
        "sqlite": "django.db.backends.sqlite3",
    }
    if scheme not in engines:
        raise ImproperlyConfigured(f"Unsupported DATABASE_URL scheme: {scheme}")

    if scheme == "sqlite":
        name = unquote(parsed.path[1:] if parsed.path.startswith("/") else parsed.path)
        name = "/" + name if parsed.path.startswith("//") else name
        name = name or ":memory:"
    else:
        name = unquote(parsed.path.lstrip("/"))

    config = {
        "ENGINE": engines[scheme],
        "NAME": name,
        "CONN_MAX_AGE": 600,
        "CONN_HEALTH_CHECKS": True,
    }
    if scheme != "sqlite":
        config.update({
            "USER": unquote(parsed.username or ""),
            "PASSWORD": unquote(parsed.password or ""),
            "HOST": parsed.hostname or "",
            "PORT": str(parsed.port or ""),
        })
        options = parse_qs(parsed.query)
        if options:
            config["OPTIONS"] = {key: values[-1] for key, values in options.items()}
    return config


DATABASES = {"default": database_config()}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---- Security behind a TLS-terminating proxy (Render, Koyeb, Railway...) ----
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# ---- Django REST Framework ----
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["analysis.permissions.HasAppKey"],
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"anon": os.environ.get("THROTTLE_RATE", "60/min")},
    # Number of reverse proxies in front of Django (needed for correct per-IP throttling).
    "NUM_PROXIES": None if DEBUG else env_int("DRF_NUM_PROXIES", 1),
}

# ---- SMS Sentinel settings ----
APP_API_KEY = os.environ.get("APP_API_KEY", "")
AI_PROVIDER = os.environ.get("AI_PROVIDER", "none").strip().lower()
AI_API_KEY = os.environ.get("AI_API_KEY", "")
AI_MODEL = os.environ.get("AI_MODEL", "")
AI_BASE_URL = os.environ.get("AI_BASE_URL", "")
AI_TIMEOUT_SECONDS = env_int("AI_TIMEOUT_SECONDS", 8)
STORE_MESSAGE_BODY = env_bool("STORE_MESSAGE_BODY", False)
MAX_BODY_CHARS = 4000

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {"analysis": {"level": "DEBUG" if DEBUG else "INFO"}},
}

import sys

if 'test' in sys.argv:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    }
    # 1. Définir la variable de configuration globale pour l'application
    APP_API_KEY = ""
    
    # # 2. Configurer la variable d'environnement pour qu'elle soit détectée au chargement des modules
    # os.environ["APP_API_KEY"] = "secret"
    
    # # 3. Désactiver temporairement la vérification stricte des jetons CSRF pour le client de test natif de Django
    # REST_FRAMEWORK = {
    #     'DEFAULT_PERMISSION_CLASSES': [
    #         'rest_framework.permissions.AllowAny',
    #     ]
    # }
