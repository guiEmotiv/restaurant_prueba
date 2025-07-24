from rest_framework import permissions
from django.utils import timezone


class IsAuthenticatedRestaurantUser(permissions.BasePermission):
    """
    Permission that only allows authenticated restaurant users
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            hasattr(request.user, 'role')
        )


class RoleBasedPermission(permissions.BasePermission):
    """
    Permission class that checks user role and allowed endpoints
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Update last activity
        request.user.last_activity = timezone.now()
        request.user.is_active_session = True
        request.user.save(update_fields=['last_activity', 'is_active_session'])
        
        # Admin has access to everything
        if request.user.role == 'admin':
            return True
        
        # Get the current view's basename
        view_name = getattr(view, 'basename', None)
        
        if not view_name:
            return False
        
        # Check if user can access this endpoint
        return request.user.can_access_api_endpoint(view_name)


class AdminOnlyPermission(permissions.BasePermission):
    """
    Permission that only allows admin users
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'admin'
        )


class MeseroPermission(permissions.BasePermission):
    """
    Permission for mesero role - only orders and kitchen related endpoints
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.role == 'admin':
            return True
            
        if request.user.role == 'mesero':
            view_name = getattr(view, 'basename', None)
            allowed_endpoints = ['order', 'orderitem', 'orderitemingredient', 'recipe', 'ingredient', 'table']
            return any(endpoint in view_name for endpoint in allowed_endpoints)
        
        return False


class CajeroPermission(permissions.BasePermission):
    """
    Permission for cajero role - only payments and order reading
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.role == 'admin':
            return True
            
        if request.user.role == 'cajero':
            view_name = getattr(view, 'basename', None)
            
            # Cajero can read orders but only create/update payments
            if view_name == 'order':
                return request.method in ['GET', 'HEAD', 'OPTIONS']
            
            # Full access to payments
            if view_name == 'payment':
                return True
                
            return False
        
        return False


class InventoryPermission(permissions.BasePermission):
    """
    Permission for inventory endpoints:
    - Admin: Full access
    - Mesero: Read-only access to recipes and ingredients
    - Cajero: No access
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.role == 'admin':
            return True
            
        if request.user.role == 'mesero':
            view_name = getattr(view, 'basename', None)
            # Mesero can only read recipes and ingredients
            if view_name in ['recipe', 'ingredient']:
                return request.method in ['GET', 'HEAD', 'OPTIONS']
            return False
        
        # Cajero has no access to inventory
        return False