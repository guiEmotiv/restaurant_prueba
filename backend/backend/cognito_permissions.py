"""
Custom permission classes for AWS Cognito authentication
Groups: administradores, meseros, cocineros

Permisos por grupo:
- Administradores: full acceso a todas las vistas y módulos
- Cocineros: vista cocina + modificar estado de pedidos
- Meseros: estado mesas + historial + crear/modificar pedidos + pagos
"""
from rest_framework import permissions


class CognitoAdminOnlyPermission(permissions.BasePermission):
    """
    Solo administradores tienen acceso
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            hasattr(request.user, 'is_authenticated') and 
            request.user.is_authenticated and
            hasattr(request.user, 'is_admin') and
            request.user.is_admin()
        )


class CognitoCookOnlyPermission(permissions.BasePermission):
    """
    Solo cocineros y administradores tienen acceso
    Para vista de cocina
    """
    
    def has_permission(self, request, view):
        if not (request.user and 
                hasattr(request.user, 'is_authenticated') and 
                request.user.is_authenticated):
            return False
            
        # Administradores tienen acceso completo
        if hasattr(request.user, 'is_admin') and request.user.is_admin():
            return True
            
        # Cocineros tienen acceso
        if hasattr(request.user, 'is_cook') and request.user.is_cook():
            return True
            
        return False


class CognitoOrderStatusPermission(permissions.BasePermission):
    """
    Para modificar estado de pedidos:
    - Administradores: full access
    - Cocineros: pueden modificar estados
    - Meseros: pueden crear y modificar pedidos
    """
    
    def has_permission(self, request, view):
        if not (request.user and 
                hasattr(request.user, 'is_authenticated') and 
                request.user.is_authenticated):
            return False
            
        # Administradores tienen acceso completo
        if hasattr(request.user, 'is_admin') and request.user.is_admin():
            return True
            
        # Cocineros pueden modificar estados de pedidos
        if hasattr(request.user, 'is_cook') and request.user.is_cook():
            return True
            
        # Meseros pueden crear y modificar pedidos
        if hasattr(request.user, 'is_waiter') and request.user.is_waiter():
            return True
            
        return False


class CognitoWaiterAndAdminPermission(permissions.BasePermission):
    """
    Solo meseros y administradores:
    - Para estado de mesas, historial, pedidos, pagos
    """
    
    def has_permission(self, request, view):
        if not (request.user and 
                hasattr(request.user, 'is_authenticated') and 
                request.user.is_authenticated):
            return False
            
        # Administradores tienen acceso completo
        if hasattr(request.user, 'is_admin') and request.user.is_admin():
            return True
            
        # Meseros tienen acceso
        if hasattr(request.user, 'is_waiter') and request.user.is_waiter():
            return True
            
        return False


class CognitoReadOnlyForNonAdmins(permissions.BasePermission):
    """
    Para configuración básica que necesitan ver otros roles:
    - Administradores: full access
    - Otros: solo lectura
    """
    
    def has_permission(self, request, view):
        if not (request.user and 
                hasattr(request.user, 'is_authenticated') and 
                request.user.is_authenticated):
            return False
            
        # Administradores tienen acceso completo
        if hasattr(request.user, 'is_admin') and request.user.is_admin():
            return True
            
        # Otros roles solo lectura
        if (hasattr(request.user, 'is_waiter') and request.user.is_waiter()) or \
           (hasattr(request.user, 'is_cook') and request.user.is_cook()):
            return request.method in permissions.SAFE_METHODS
            
        return False