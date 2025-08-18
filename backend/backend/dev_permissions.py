"""
Development permission helper
"""
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.conf import settings

def get_default_permissions():
    """
    Returns appropriate permissions based on USE_COGNITO_AUTH setting
    """
    if getattr(settings, 'USE_COGNITO_AUTH', False):
        return []  # Use default from REST_FRAMEWORK setting
    else:
        return [AllowAny]  # Allow all in development