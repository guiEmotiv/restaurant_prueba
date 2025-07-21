"""
EC2 Production Settings - Restaurant Management System
Optimized for EC2 + SQLite + Docker deployment
"""

from .settings import *
import os

# Security Settings
DEBUG = False
SECRET_KEY = os.environ['DJANGO_SECRET_KEY']

# Allowed hosts configuration
ALLOWED_HOSTS = [
    os.environ.get('EC2_PUBLIC_IP', ''),
    os.environ.get('DOMAIN_NAME', ''),
    '127.0.0.1',
    'localhost',
]
# Remove empty strings
ALLOWED_HOSTS = [host for host in ALLOWED_HOSTS if host]

# Database - SQLite for production
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'data' / 'db.sqlite3',
        'OPTIONS': {
            'timeout': 20,
        }
    }
}

# Static files configuration
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [
    BASE_DIR / 'frontend_static',
] if (BASE_DIR / 'frontend_static').exists() else []

# Media files configuration
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# CORS settings
CORS_ALLOWED_ORIGINS = [
    f"http://{os.environ.get('EC2_PUBLIC_IP', 'localhost')}",
    f"https://{os.environ.get('DOMAIN_NAME', 'localhost')}",
]
CORS_ALLOW_CREDENTIALS = True

# Security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Logging configuration - Console only for Docker
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}