"""
Django Base Settings - Common configuration for all environments
Python 3.12 · Django 5.2 · DRF 3.16
"""
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/ directory

# ──────────────────────────────────────────────────────────────
# Core Settings
# ──────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-dev-key-change-in-production")

# Debug is set per environment
DEBUG = False  # Override in development.py

# Hosts configuration
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# ──────────────────────────────────────────────────────────────
# Authentication Configuration - Django only (Cognito removed)
# ──────────────────────────────────────────────────────────────

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
    "corsheaders",
    "drf_spectacular",
    
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
    "backend.auth_middleware.AuthDebugMiddleware",  # Custom auth debugging
    "backend.permissions_logger.DetailedPermissionMiddleware",  # Permission logging
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Standard Django authentication middleware (Cognito removed)

ROOT_URLCONF  = "backend.urls"
WSGI_APPLICATION = "backend.wsgi.application"
ASGI_APPLICATION = "backend.asgi.application"

# ──────────────────────────────────────────────────────────────
# Database - Local Development Only
# ──────────────────────────────────────────────────────────────
# Database configuration is handled in development.py
# This project is configured for local development with SQLite

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


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ──────────────────────────────────────────────────────────────
# Django REST Framework
# ──────────────────────────────────────────────────────────────
# DRF Configuration - Django authentication only
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",  # Require Django authentication
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",  # Django session auth
        "rest_framework.authentication.BasicAuthentication",    # Django basic auth
    ]
}

# ──────────────────────────────────────────────────────────────
# CORS Configuration
# ──────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite development server
    "http://127.0.0.1:5173",
]

# Allow all origins in development for easier testing
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True

CORS_ALLOW_CREDENTIALS = True

# CSRF Configuration for development
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",  # Vite development server
    "http://127.0.0.1:5173",
    "http://localhost:8000",  # Backend server
    "http://127.0.0.1:8000",
]

# Add LOCAL_IP dynamically to CORS and CSRF if available
LOCAL_IP = os.getenv('LOCAL_IP', '')
if LOCAL_IP:
    CORS_ALLOWED_ORIGINS.append(f"http://{LOCAL_IP}:5173")
    CSRF_TRUSTED_ORIGINS.append(f"http://{LOCAL_IP}:5173")
    CSRF_TRUSTED_ORIGINS.append(f"http://{LOCAL_IP}:8000")

# Local development CSRF origins only

# CSRF Cookie settings for frontend
CSRF_COOKIE_NAME = 'csrftoken'
CSRF_COOKIE_HTTPONLY = False  # Allow JavaScript access
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = not DEBUG  # Use secure cookies in production
CSRF_USE_SESSIONS = False  # Use cookies instead of sessions

# Allow specific headers including 'Expires'
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'expires',  # lowercase version
    'Expires',  # uppercase version - this is what the frontend sends
    'cache-control',
    'pragma',
]


# ──────────────────────────────────────────────────────────────
# Django Authentication - Standard Django user system
# ──────────────────────────────────────────────────────────────

# Session Configuration - Enhanced Security
SESSION_ENGINE = 'django.contrib.sessions.backends.db'  # Database sessions
SESSION_COOKIE_NAME = 'sessionid'
SESSION_COOKIE_AGE = 86400  # 24 hours (86400 seconds)
SESSION_SAVE_EVERY_REQUEST = True  # Refresh session on every request
SESSION_EXPIRE_AT_BROWSER_CLOSE = False  # Keep session after browser close
SESSION_COOKIE_SECURE = not DEBUG  # Use secure cookies in production
SESSION_COOKIE_HTTPONLY = True  # Prevent JavaScript access to session cookie
SESSION_COOKIE_SAMESITE = 'Lax'  # CSRF protection
SESSION_SERIALIZER = 'django.contrib.sessions.serializers.JSONSerializer'

# Password Validation - Enhanced Security
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 8,  # Increased minimum length
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

print("✅ Django authentication ENABLED - Enhanced Standard Django user system")


# ──────────────────────────────────────────────────────────────
# API Documentation (drf-spectacular)
# ──────────────────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "Restaurant Management API",
    "DESCRIPTION": "API completa para la gestión de restaurantes",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# ──────────────────────────────────────────────────────────────
# Rate Limiting Configuration
# ──────────────────────────────────────────────────────────────

# NO RATE LIMITING - Local development unlimited requests
# Cache configuration for Django sessions only
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'default-cache',
        'OPTIONS': {
            'MAX_ENTRIES': 1000,
        }
    }
}

# Enhanced Logging configuration with Authentication support
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
        'auth': {
            'format': '[AUTH] {levelname} {asctime} {name} - {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'data' / 'logs' / 'django.log',
            'formatter': 'verbose',
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'auth_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'data' / 'logs' / 'auth.log',
            'maxBytes': 1024*1024*5,  # 5MB
            'backupCount': 5,
            'formatter': 'auth',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
        'backend.auth_views': {  # Our enhanced authentication views
            'handlers': ['console', 'auth_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.contrib.auth': {  # Django auth system
            'handlers': ['auth_file'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}