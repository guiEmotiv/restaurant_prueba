"""
Production settings for Restaurant Management System
Optimized for EC2 deployment
"""
from .settings import *
import os

# Security Settings
DEBUG = False
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ValueError('DJANGO_SECRET_KEY environment variable must be set')

# Allowed hosts - add your EC2 IP and domain
ALLOWED_HOSTS = [
    os.getenv('EC2_PUBLIC_IP', 'localhost'),
    os.getenv('DOMAIN_NAME', ''),
    '127.0.0.1',
    'localhost',
]

# Remove empty strings
ALLOWED_HOSTS = [host for host in ALLOWED_HOSTS if host]

# Database - SQLite for production (simple deployment)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'data' / 'db.sqlite3',
    }
}

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Frontend static files (React build)
STATICFILES_DIRS = [
    BASE_DIR / 'frontend_static',
] if (BASE_DIR / 'frontend_static').exists() else []

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# CORS settings for production
CORS_ALLOWED_ORIGINS = [
    f"http://{os.getenv('EC2_PUBLIC_IP', 'localhost')}",
    f"https://{os.getenv('DOMAIN_NAME', 'localhost')}",
]

CORS_ALLOW_CREDENTIALS = True

# Security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'data' / 'django.log',
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}