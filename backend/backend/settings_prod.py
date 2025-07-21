"""
Django settings for production deployment on AWS
"""
from .settings import *
import os

# ──────────────────────────────────────────────────────────────
# Production Security Settings
# ──────────────────────────────────────────────────────────────
DEBUG = False
SECRET_KEY = os.environ['DJANGO_SECRET_KEY']

ALLOWED_HOSTS = [
    os.environ.get('DOMAIN_NAME', ''),
    os.environ.get('EC2_PUBLIC_IP', ''),
    'localhost',
    '127.0.0.1',
]

# ──────────────────────────────────────────────────────────────
# Database - PostgreSQL RDS with SQLite fallback
# ──────────────────────────────────────────────────────────────
if all(key in os.environ for key in ['RDS_DB_NAME', 'RDS_USERNAME', 'RDS_PASSWORD', 'RDS_HOSTNAME']):
    # Use PostgreSQL RDS if all variables are set
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ['RDS_DB_NAME'],
            'USER': os.environ['RDS_USERNAME'],
            'PASSWORD': os.environ['RDS_PASSWORD'],
            'HOST': os.environ['RDS_HOSTNAME'],
            'PORT': os.environ.get('RDS_PORT', '5432'),
            'OPTIONS': {
                'connect_timeout': 20,
            }
        }
    }
else:
    # Fallback to SQLite for development/testing
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': '/app/db.sqlite3',
        }
    }
    print("⚠️  Using SQLite database (RDS variables not found)")

# ──────────────────────────────────────────────────────────────
# Static files - AWS S3
# ──────────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID = os.environ['AWS_ACCESS_KEY_ID']
AWS_SECRET_ACCESS_KEY = os.environ['AWS_SECRET_ACCESS_KEY']
AWS_STORAGE_BUCKET_NAME = os.environ['AWS_S3_BUCKET_NAME']
AWS_S3_REGION_NAME = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')
AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com'

# Static files settings
AWS_LOCATION = 'static'
STATIC_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/{AWS_LOCATION}/'
STATICFILES_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

# Media files settings
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/media/'

# ──────────────────────────────────────────────────────────────
# Security enhancements
# ──────────────────────────────────────────────────────────────
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# SSL/HTTPS settings (if using load balancer)
if os.environ.get('USE_SSL', 'False').lower() == 'true':
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# ──────────────────────────────────────────────────────────────
# CORS settings for production
# ──────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    f"https://{os.environ.get('FRONTEND_DOMAIN', '')}",
    "https://localhost:3000",
]

CORS_ALLOW_CREDENTIALS = True

# ──────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': '/var/log/django/django.log',
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