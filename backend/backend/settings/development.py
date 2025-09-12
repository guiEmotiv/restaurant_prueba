"""
Django Development Settings
"""
from .base import *

# ──────────────────────────────────────────────────────────────
# Development Environment
# ──────────────────────────────────────────────────────────────
ENVIRONMENT = 'development'

# Enable debug mode for development
DEBUG = True

# Allow all hosts in development
ALLOWED_HOSTS = ['*']

# ──────────────────────────────────────────────────────────────
# Database - SQLite for local development
# ──────────────────────────────────────────────────────────────
db_name = os.getenv('DATABASE_NAME', 'restaurant.sqlite3')
db_path = os.getenv('DATABASE_PATH', str(BASE_DIR / 'data'))

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": Path(db_path) / db_name,
    }
}

# ──────────────────────────────────────────────────────────────
# CORS - Allow frontend development server
# ──────────────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Additional CORS origins for development
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.43:5173",  # Ethernet interface
    "http://192.168.1.100:5173", # WiFi interface (needed for AP isolation bypass)
]

# Get local network IPs from environment
LOCAL_IP = os.getenv('LOCAL_IP', '')
if LOCAL_IP:
    CORS_ALLOWED_ORIGINS.append(f"http://{LOCAL_IP}:5173")
    CORS_ALLOWED_ORIGINS.append(f"http://{LOCAL_IP}:3000")

# ──────────────────────────────────────────────────────────────
# CSRF Settings for Development
# ──────────────────────────────────────────────────────────────
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.43:5173",  # Ethernet interface
    "http://192.168.1.100:5173", # WiFi interface (needed for AP isolation bypass)
]

if LOCAL_IP:
    CSRF_TRUSTED_ORIGINS.append(f"http://{LOCAL_IP}:5173")
    CSRF_TRUSTED_ORIGINS.append(f"http://{LOCAL_IP}:3000")

# Allow JavaScript access to CSRF cookie in development
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SECURE = False
CSRF_COOKIE_SAMESITE = 'Lax'

# Session cookie settings for development
SESSION_COOKIE_SECURE = False
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_HTTPONLY = True  # Keep session secure

# ──────────────────────────────────────────────────────────────
# Logging - More verbose in development
# ──────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {module} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'data' / 'logs' / 'django_dev.log',
            'formatter': 'verbose',
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
        'django.request': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'backend': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

# ──────────────────────────────────────────────────────────────
# Development-specific settings
# ──────────────────────────────────────────────────────────────
# Show detailed error pages
DEBUG_PROPAGATE_EXCEPTIONS = True

# Email backend for development (console output)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Cache configuration for development
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }
}

# Static files serving in development
STATICFILES_DIRS = [
    BASE_DIR / "static",
]

print("🚀 Django Development Settings Loaded")
print(f"   Environment: {ENVIRONMENT}")
print(f"   Debug: {DEBUG}")
print(f"   Database: SQLite ({DATABASES['default']['NAME']})")
print(f"   Authentication: Django Users")