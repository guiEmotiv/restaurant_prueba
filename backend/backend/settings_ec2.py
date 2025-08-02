"""
EC2 Production Settings for Restaurant Management System
Simplified configuration without authentication
"""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Environment variables are loaded by Docker Compose via env_file
# We don't need to manually load .env.ec2 since Docker handles it
print("ℹ️  Using environment variables loaded by Docker Compose")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECURITY SETTINGS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'your-production-secret-key-change-this')
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '*,44.248.47.186,localhost,127.0.0.1').split(',')

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# APPLICATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTALLED_APPS = [
    # Core Django
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party
    'rest_framework',
    'corsheaders',
    'drf_spectacular',
    
    # Restaurant Apps
    'config',
    'inventory',
    'operation',
]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MIDDLEWARE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
]

# Conditionally add CSRF and Auth middleware based on authentication mode
if os.getenv('USE_COGNITO_AUTH', 'False').lower() == 'true':
    # For Cognito auth, add CSRF exemption for API endpoints
    MIDDLEWARE.extend([
        'backend.csrf_exempt_middleware.CSRFExemptAPIMiddleware',  # Exempt API from CSRF
        'django.middleware.csrf.CsrfViewMiddleware',  # Still needed for admin/web
        'django.contrib.auth.middleware.AuthenticationMiddleware',  # Required by DRF
        # Note: We use DRF authentication instead of custom middleware
    ])
else:
    # For non-auth mode, keep standard CSRF and auth
    MIDDLEWARE.extend([
        'django.middleware.csrf.CsrfViewMiddleware',
        'django.contrib.auth.middleware.AuthenticationMiddleware',
    ])

# Always add these at the end
MIDDLEWARE.extend([
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
])

ROOT_URLCONF = 'backend.urls'
WSGI_APPLICATION = 'backend.wsgi.application'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DATABASE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Configuración de base de datos centralizada
db_name = os.getenv('DATABASE_NAME', 'restaurant_prod.sqlite3')
db_path = os.getenv('DATABASE_PATH', '/app/data')

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(db_path, db_name),
    }
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEMPLATES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# INTERNATIONALIZATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LANGUAGE_CODE = 'es-pe'
TIME_ZONE = 'America/Lima'
USE_I18N = True
USE_TZ = True

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STATIC FILES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MEDIA FILES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'data' / 'media'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# REST FRAMEWORK
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Determine authentication and permission classes based on authentication mode
if os.getenv('USE_COGNITO_AUTH', 'False').lower() == 'true':
    DEFAULT_AUTHENTICATION_CLASSES = ['backend.cognito_drf_auth.CognitoJWTAuthentication']
    DEFAULT_PERMISSION_CLASSES = ['rest_framework.permissions.IsAuthenticated']
else:
    DEFAULT_AUTHENTICATION_CLASSES = ['rest_framework.authentication.SessionAuthentication']
    DEFAULT_PERMISSION_CLASSES = ['rest_framework.permissions.AllowAny']

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': DEFAULT_AUTHENTICATION_CLASSES,
    'DEFAULT_PERMISSION_CLASSES': DEFAULT_PERMISSION_CLASSES,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,  # Aumentado para mostrar más elementos
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CORS SETTINGS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

# In production, add your domain and EC2 IP
EC2_PUBLIC_IP = os.getenv('EC2_PUBLIC_IP', 'localhost')
DOMAIN_NAME = os.getenv('DOMAIN_NAME', '')

# Add EC2 IP
if EC2_PUBLIC_IP != 'localhost':
    CORS_ALLOWED_ORIGINS.extend([
        f"http://{EC2_PUBLIC_IP}",
        f"https://{EC2_PUBLIC_IP}",
    ])

# Add domain name
if DOMAIN_NAME:
    CORS_ALLOWED_ORIGINS.extend([
        f"http://{DOMAIN_NAME}",
        f"https://{DOMAIN_NAME}",
        f"https://www.{DOMAIN_NAME}",
    ])

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = True  # For development - restrict in production

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECURITY SETTINGS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Security Headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# CSRF Settings - disable for API when using JWT authentication
if os.getenv('USE_COGNITO_AUTH', 'False').lower() == 'true':
    # For JWT authentication, we don't need CSRF protection on API endpoints
    CSRF_EXEMPT_URLS = [r'^api/v1/.*$']
    CSRF_COOKIE_SECURE = False  # Allow HTTP for development
    CSRF_COOKIE_HTTPONLY = False
else:
    # Standard CSRF protection for non-JWT authentication
    CSRF_COOKIE_SECURE = not DEBUG
    CSRF_COOKIE_HTTPONLY = True

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LOGGING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
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
    },
}

# Create logs directory
try:
    os.makedirs(BASE_DIR / 'data' / 'logs', exist_ok=True)
except PermissionError:
    # In case of permission issues, use a fallback directory
    LOGGING['handlers']['file']['filename'] = '/tmp/django.log'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# API DOCUMENTATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SPECTACULAR_SETTINGS = {
    'TITLE': 'Restaurant Management API',
    'DESCRIPTION': 'API completa para la gestión de restaurantes sin autenticación',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AWS COGNITO SETTINGS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Authentication Mode
USE_COGNITO_AUTH = os.getenv('USE_COGNITO_AUTH', 'False').lower() == 'true'

# AWS Configuration
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')

# Cognito Configuration
COGNITO_USER_POOL_ID = os.getenv('COGNITO_USER_POOL_ID', '')
COGNITO_APP_CLIENT_ID = os.getenv('COGNITO_APP_CLIENT_ID', '')

# Set COGNITO_ENABLED for the middleware
COGNITO_ENABLED = USE_COGNITO_AUTH

# Validate required Cognito settings only if authentication is enabled
if USE_COGNITO_AUTH:
    if not COGNITO_USER_POOL_ID:
        print("⚠️  COGNITO_USER_POOL_ID not set. Authentication will fail.")
    if not COGNITO_APP_CLIENT_ID:
        print("⚠️  COGNITO_APP_CLIENT_ID not set. Authentication will fail.")
    print(f"✅ AWS Cognito authentication ENABLED - Pool: {COGNITO_USER_POOL_ID}")
else:
    print("ℹ️  Running without AWS Cognito authentication (USE_COGNITO_AUTH=False)")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# OTHER SETTINGS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Create data directory
os.makedirs(BASE_DIR / 'data', exist_ok=True)