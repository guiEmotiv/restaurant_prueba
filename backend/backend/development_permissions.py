"""
Development-aware permission classes
Automatically switches between authenticated and open access based on environment
"""
from rest_framework import permissions
from django.conf import settings


class DevelopmentAwarePermission(permissions.BasePermission):
    """
    Permission class that adapts to environment:
    - Production (COGNITO_ENABLED=True): Requires authentication
    - Development (COGNITO_ENABLED=False): Allows any access
    """
    
    def has_permission(self, request, view):
        # If Cognito is disabled (development mode), allow all access
        if not getattr(settings, 'COGNITO_ENABLED', True):
            return True
        
        # Otherwise, require authentication
        return (
            request.user and 
            hasattr(request.user, 'is_authenticated') and 
            request.user.is_authenticated
        )


class DevelopmentAwareAdminPermission(permissions.BasePermission):
    """
    Permission class for admin-only endpoints that adapts to environment:
    - Production (COGNITO_ENABLED=True): Requires admin authentication
    - Development (COGNITO_ENABLED=False): Allows any access
    """
    
    def has_permission(self, request, view):
        # If Cognito is disabled (development mode), allow all access
        if not getattr(settings, 'COGNITO_ENABLED', True):
            return True
        
        # Otherwise, require admin authentication
        return (
            request.user and 
            hasattr(request.user, 'is_authenticated') and 
            request.user.is_authenticated and
            hasattr(request.user, 'is_admin') and
            request.user.is_admin()
        )


# Legacy compatibility - use DevelopmentAwarePermission instead of IsAuthenticated
IsAuthenticatedOrDev = DevelopmentAwarePermission
IsAdminOrDev = DevelopmentAwareAdminPermission