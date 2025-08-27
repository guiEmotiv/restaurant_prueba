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
DEBUG      = os.getenv("DEBUG", "0").lower() in ("1", "true", "yes", "on")
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost").split(",")

# In development, allow all hosts for easier testing
if DEBUG:
    ALLOWED_HOSTS = ['*']

# ──────────────────────────────────────────────────────────────
# AWS Cognito Configuration
# ──────────────────────────────────────────────────────────────
USE_COGNITO_AUTH = os.getenv('USE_COGNITO_AUTH', 'False').lower() == 'true'

# AWS Configuration
AWS_REGION = os.getenv("AWS_REGION", "us-west-2")

# Cognito Configuration
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID", "")

# Set COGNITO_ENABLED for the middleware
COGNITO_ENABLED = USE_COGNITO_AUTH

# Rate limiting moved to Nginx - no longer handled by Django

# Validate required Cognito settings only if authentication is enabled
if USE_COGNITO_AUTH:
    if not COGNITO_USER_POOL_ID:
        print("⚠️  COGNITO_USER_POOL_ID not set. Authentication will fail.")
    if not COGNITO_APP_CLIENT_ID:
        print("⚠️  COGNITO_APP_CLIENT_ID not set. Authentication will fail.")
    print(f"✅ AWS Cognito authentication ENABLED - Pool: {COGNITO_USER_POOL_ID}")
else:
    print("ℹ️  Running without AWS Cognito authentication (USE_COGNITO_AUTH=False)")

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
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Add Cognito middleware only if USE_COGNITO_AUTH is True
if USE_COGNITO_AUTH:
    # Insert after AuthenticationMiddleware
    auth_index = MIDDLEWARE.index("django.contrib.auth.middleware.AuthenticationMiddleware")
    MIDDLEWARE.insert(auth_index + 1, "backend.cognito_auth.CognitoAuthenticationMiddleware")
else:
    # In development, add bypass middleware
    MIDDLEWARE.insert(-1, "backend.dev_middleware.DevAuthBypassMiddleware")

ROOT_URLCONF  = "backend.urls"
WSGI_APPLICATION = "backend.wsgi.application"
ASGI_APPLICATION = "backend.asgi.application"

# ──────────────────────────────────────────────────────────────
# Base de datos PostgreSQL 17
# Usa múltiples esquemas y fija el search_path.
# ──────────────────────────────────────────────────────────────
# ──────────────────────────────────────────────────────────────
# Base de datos - Configuración por entorno
# ──────────────────────────────────────────────────────────────
db_name = os.getenv('DATABASE_NAME', 'restaurant_dev.sqlite3')
db_path = os.getenv('DATABASE_PATH', str(BASE_DIR))

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": Path(db_path) / db_name,
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


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ──────────────────────────────────────────────────────────────
# Django REST Framework
# ──────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
    "DEFAULT_AUTHENTICATION_CLASSES": [],  # No authentication in development
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# Override authentication/permissions based on Cognito setting
if USE_COGNITO_AUTH:
    REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"] = [
        "backend.cognito_drf_auth.CognitoJWTAuthentication",
    ]
    REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"] = [
        "rest_framework.permissions.IsAuthenticated",
    ]

# ──────────────────────────────────────────────────────────────
# CORS Configuration
# ──────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite development server
    "http://127.0.0.1:5173",
    "http://192.168.1.35:5173",  # Local network IP
]

# Allow all origins in development for easier testing
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True

# Add EC2 IP to CORS if configured
EC2_IP = os.getenv('EC2_PUBLIC_IP', '')
if EC2_IP:
    CORS_ALLOWED_ORIGINS.append(f"http://{EC2_IP}")

# Add domain to CORS if configured
DOMAIN_NAME = os.getenv('DOMAIN_NAME', '')
if DOMAIN_NAME:
    CORS_ALLOWED_ORIGINS.extend([
        f"https://{DOMAIN_NAME}",
        f"https://www.{DOMAIN_NAME}",
        f"http://{DOMAIN_NAME}",
        f"http://www.{DOMAIN_NAME}",
    ])

CORS_ALLOW_CREDENTIALS = True

# CSRF Configuration for development
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",  # Vite development server
    "http://127.0.0.1:5173",
    "http://192.168.1.35:5173",  # Local network IP
]

# Add domain to CSRF if configured
if DOMAIN_NAME:
    CSRF_TRUSTED_ORIGINS.extend([
        f"https://{DOMAIN_NAME}",
        f"https://www.{DOMAIN_NAME}",
    ])

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
# AWS Cognito Configuration
# ──────────────────────────────────────────────────────────────
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
COGNITO_USER_POOL_ID = os.getenv('COGNITO_USER_POOL_ID', '')
COGNITO_APP_CLIENT_ID = os.getenv('COGNITO_APP_CLIENT_ID', '')

# Enable Cognito authentication - Check if Cognito is properly configured
COGNITO_ENABLED = bool(COGNITO_USER_POOL_ID and COGNITO_APP_CLIENT_ID)

if COGNITO_ENABLED:
    print(f"✅ AWS Cognito authentication ENABLED - User Pool: {COGNITO_USER_POOL_ID[:10]}...")
else:
    print("⚠️ AWS Cognito authentication DISABLED - Missing configuration")


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

# Cache configuration for rate limiting
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'rate-limiting',
        'OPTIONS': {
            'MAX_ENTRIES': 10000,
        }
    }
}

# Rate limiting settings
RATE_LIMITING = {
    'ENABLED': os.getenv('RATE_LIMITING_ENABLED', 'True').lower() == 'true',
    'REDIS_URL': os.getenv('REDIS_URL', None),  # Optional Redis backend
    'LOG_VIOLATIONS': True,
    'STRICT_MODE': os.getenv('RATE_LIMITING_STRICT', 'False').lower() == 'true',
}

# Logging configuration for rate limiting
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
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'data' / 'logs' / 'rate_limiting.log',
            'formatter': 'verbose',
        },
        'console': {
            'level': 'WARNING',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'loggers': {
        'rate_limiting': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
        'django': {
            'handlers': ['file'],
            'level': 'WARNING',
            'propagate': True,
        },
    },
}