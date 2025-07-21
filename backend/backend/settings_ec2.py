"""
Django settings for EC2 + SQLite + Docker production deployment
Optimized for simple, reliable deployment with minimal configuration
"""

from .settings import *
import os

# ──────────────────────────────────────────────────────────────
# Production Security Settings
# ──────────────────────────────────────────────────────────────
DEBUG = False
SECRET_KEY = os.environ['DJANGO_SECRET_KEY']

# Host configuration for EC2 deployment
ALLOWED_HOSTS = [
    os.environ.get('DOMAIN_NAME', ''),
    os.environ.get('EC2_PUBLIC_IP', ''),
    'localhost',
    '127.0.0.1',
    '*'  # Temporary for initial setup - should be restricted in production
]

# ──────────────────────────────────────────────────────────────
# Database - SQLite for EC2 deployment
# ──────────────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': '/app/data/db.sqlite3',  # Persistent volume mount
    }
}

# ──────────────────────────────────────────────────────────────
# Static Files - Local filesystem
# ──────────────────────────────────────────────────────────────
STATIC_URL = '/static/'
STATIC_ROOT = '/app/staticfiles/'
MEDIA_URL = '/media/'
MEDIA_ROOT = '/app/media/'

# ──────────────────────────────────────────────────────────────
# Security enhancements
# ──────────────────────────────────────────────────────────────
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# SSL/HTTPS settings (optional for EC2)
USE_HTTPS = os.environ.get('USE_HTTPS', 'false').lower() == 'true'
if USE_HTTPS:
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# ──────────────────────────────────────────────────────────────
# CORS settings for frontend integration
# ──────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    f"http://{os.environ.get('EC2_PUBLIC_IP', 'localhost')}:3000",
    f"https://{os.environ.get('EC2_PUBLIC_IP', 'localhost')}:3000",
    f"http://{os.environ.get('DOMAIN_NAME', 'localhost')}",
    f"https://{os.environ.get('DOMAIN_NAME', 'localhost')}",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = os.environ.get('DEBUG', 'false').lower() == 'true'

# ──────────────────────────────────────────────────────────────
# Logging configuration
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
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'simple'
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': '/app/logs/django.log',
            'formatter': 'verbose'
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.server': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# ──────────────────────────────────────────────────────────────
# Performance optimizations for EC2
# ──────────────────────────────────────────────────────────────

# Database optimizations for SQLite
DATABASES['default']['OPTIONS'] = {
    'timeout': 20,
    'check_same_thread': False,
}

# Cache configuration (simple local memory cache for single instance)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'restaurant-cache',
        'TIMEOUT': 300,
        'OPTIONS': {
            'MAX_ENTRIES': 1000
        }
    }
}

# Session configuration
SESSION_ENGINE = 'django.contrib.sessions.backends.cached_db'
SESSION_CACHE_ALIAS = 'default'

# ──────────────────────────────────────────────────────────────
# Email configuration (optional)
# ──────────────────────────────────────────────────────────────
if os.environ.get('EMAIL_HOST'):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.environ.get('EMAIL_HOST')
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
    EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')
    EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'true').lower() == 'true'
    DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)
else:
    # Fallback to console backend for development
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# ──────────────────────────────────────────────────────────────
# Deployment validation
# ──────────────────────────────────────────────────────────────
print("🚀 EC2 Production Configuration Loaded")
print(f"📍 Allowed Hosts: {ALLOWED_HOSTS}")
print(f"💾 Database: SQLite at {DATABASES['default']['NAME']}")
print(f"📁 Static Files: {STATIC_ROOT}")
print(f"🔒 HTTPS: {'Enabled' if USE_HTTPS else 'Disabled'}")