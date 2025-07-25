from rest_framework import permissions


class AWSIAMPermission(permissions.BasePermission):
    """
    Permission class for AWS IAM authenticated users
    Permissions are handled by aws_middleware.py based on user role
    """
    
    def has_permission(self, request, view):
        # Check if user info is available from AWS IAM middleware
        user_info = getattr(request, 'aws_user_info', None)
        if not user_info:
            return False
        
        return user_info.get('is_active', False)


class AdminOnlyPermission(permissions.BasePermission):
    """
    Permission that only allows admin users with AWS IAM authentication
    """
    
    def has_permission(self, request, view):
        user_info = getattr(request, 'aws_user_info', None)
        if not user_info:
            return False
        
        return user_info.get('role') == 'admin'