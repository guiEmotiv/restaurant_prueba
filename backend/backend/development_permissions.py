"""
Django authentication permission classes
Standard Django authentication system
"""
from rest_framework import permissions


class IsAuthenticatedPermission(permissions.BasePermission):
    """
    Standard Django authentication requirement
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            hasattr(request.user, 'is_authenticated') and 
            request.user.is_authenticated
        )


class IsAdminPermission(permissions.BasePermission):
    """
    Requires admin/staff authentication
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            hasattr(request.user, 'is_authenticated') and 
            request.user.is_authenticated and
            (request.user.is_staff or request.user.is_superuser)
        )


# Compatibility aliases - for replacing DevelopmentAware classes
DevelopmentAwarePermission = IsAuthenticatedPermission
DevelopmentAwareAdminPermission = IsAdminPermission
IsAuthenticatedOrDev = IsAuthenticatedPermission
IsAdminOrDev = IsAdminPermission