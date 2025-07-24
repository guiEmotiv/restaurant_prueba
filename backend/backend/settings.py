"""
Django settings for restaurant_mvp project.
Python 3.12 · Django 5.2 · DRF 3.16
"""
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()  # carga variables de .env

BASE_DIR = Path(__file__).resolve().parent.parent

# ──────────────────────────────────────────────────────────────
# Seguridad / entorno
# ──────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "unsafe-dev-key")
DEBUG      = bool(int(os.getenv("DEBUG", "0")))
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost").split(",")

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# ──────────────────────────────────────────────────────────────
# Apps
# ──────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    # Core Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",  # <– token auth
    "corsheaders",
    "drf_spectacular",
    
    # Custom authentication
    "authentication",
    
    # Restaurant Apps
    "config",
    "inventory", 
    "operation",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "authentication.aws_middleware.AWSIAMAuthenticationMiddleware",
    "authentication.aws_middleware.AWSIAMPermissionMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF  = "backend.urls"
WSGI_APPLICATION = "backend.wsgi.application"
ASGI_APPLICATION = "backend.asgi.application"

# ──────────────────────────────────────────────────────────────
# Base de datos PostgreSQL 17
# Usa múltiples esquemas y fija el search_path.
# ──────────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# ──────────────────────────────────────────────────────────────
# Internacionalización
# ──────────────────────────────────────────────────────────────
LANGUAGE_CODE = "es-pe"
TIME_ZONE     = os.getenv("TIME_ZONE", "America/Lima")
USE_I18N = True
USE_TZ   = True

# ──────────────────────────────────────────────────────────────
# Ficheros estáticos
# ──────────────────────────────────────────────────────────────
STATIC_URL  = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# ──────────────────────────────────────────────────────────────
# AWS Configuration
# ──────────────────────────────────────────────────────────────
AWS_DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

# Cache configuration (required for AWS token management)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'restaurant-cache',
        'TIMEOUT': 3600,  # 1 hour
        'OPTIONS': {
            'MAX_ENTRIES': 1000,
            'CULL_FREQUENCY': 3,
        }
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ──────────────────────────────────────────────────────────────
# Custom User Model
# ──────────────────────────────────────────────────────────────
AUTH_USER_MODEL = 'authentication.RestaurantUser'

# ──────────────────────────────────────────────────────────────
# Django REST Framework
# ──────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "authentication.permissions.IsAuthenticatedRestaurantUser",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# ──────────────────────────────────────────────────────────────
# CORS Configuration
# ──────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite development server
    "http://127.0.0.1:5173",
]

CORS_ALLOW_CREDENTIALS = True

# ──────────────────────────────────────────────────────────────
# Logging Configuration
# ──────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose'
        },
    },
    'loggers': {
        'authentication.aws_auth': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': True,
        },
        'authentication.aws_views': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': True,
        },
    },
}

# ──────────────────────────────────────────────────────────────
# API Documentation (drf-spectacular)
# ──────────────────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "Restaurant Management API",
    "DESCRIPTION": "API completa para la gestión de restaurantes",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}