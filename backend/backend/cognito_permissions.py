"""
Custom permission classes for AWS Cognito authentication
"""
from rest_framework import permissions


class CognitoAuthenticatedPermission(permissions.BasePermission):
    """
    Custom permission that allows access to authenticated Cognito users
    """
    
    def has_permission(self, request, view):
        # Check if user is authenticated via Cognito
        return (
            request.user and 
            hasattr(request.user, 'is_authenticated') and 
            request.user.is_authenticated and
            hasattr(request.user, 'groups')  # Cognito user has groups
        )


class CognitoAdminPermission(permissions.BasePermission):
    """
    Permission that allows access to admin users only
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            hasattr(request.user, 'is_authenticated') and 
            request.user.is_authenticated and
            hasattr(request.user, 'is_admin') and
            request.user.is_admin()
        )


class CognitoWaiterOrAdminPermission(permissions.BasePermission):
    """
    Permission that allows access to waiters and admins
    """
    
    def has_permission(self, request, view):
        if not (request.user and 
                hasattr(request.user, 'is_authenticated') and 
                request.user.is_authenticated):
            return False
            
        # Check if user is admin or waiter
        if hasattr(request.user, 'is_admin') and request.user.is_admin():
            return True
            
        if hasattr(request.user, 'is_waiter') and request.user.is_waiter():
            return True
            
        return False


class CognitoReadOnlyForWaiters(permissions.BasePermission):
    """
    Permission that allows:
    - Full access for admins
    - Read-only access for waiters
    """
    
    def has_permission(self, request, view):
        if not (request.user and 
                hasattr(request.user, 'is_authenticated') and 
                request.user.is_authenticated):
            return False
            
        # Admins have full access
        if hasattr(request.user, 'is_admin') and request.user.is_admin():
            return True
            
        # Waiters have read-only access
        if hasattr(request.user, 'is_waiter') and request.user.is_waiter():
            return request.method in permissions.SAFE_METHODS
            
        return False