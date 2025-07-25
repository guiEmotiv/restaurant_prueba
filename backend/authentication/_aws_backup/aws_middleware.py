"""
AWS IAM Authentication Middleware
Handles token validation for AWS IAM authenticated users
"""

from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from rest_framework import status
from .aws_auth import aws_authenticator
import logging

logger = logging.getLogger(__name__)

class AWSIAMAuthenticationMiddleware(MiddlewareMixin):
    """
    Middleware to handle AWS IAM token authentication
    Adds user information to request object for authenticated users
    """
    
    # Paths that don't require authentication
    EXEMPT_PATHS = [
        '/api/v1/auth/login/',
        '/api/v1/auth/aws-login/',
        '/admin/',
        '/api/docs/',
        '/api/schema/',
        '/static/',
        '/media/',
        '/'
    ]
    
    def process_request(self, request):
        # Skip authentication for exempt paths
        if any(request.path.startswith(path) for path in self.EXEMPT_PATHS):
            return None
        
        # Extract token from Authorization header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not auth_header.startswith('Token '):
            # No token provided for protected endpoint
            return JsonResponse({
                'error': 'Authentication required',
                'details': 'Token de autorización requerido'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        token = auth_header.replace('Token ', '')
        
        # Validate token
        user_info = aws_authenticator.validate_token(token)
        
        if not user_info:
            return JsonResponse({
                'error': 'Invalid token',
                'details': 'Token inválido o expirado'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Add user info to request
        request.aws_user = user_info
        request.user_role = user_info['role']
        request.allowed_endpoints = user_info['allowed_api_endpoints']
        
        return None

class AWSIAMPermissionMiddleware(MiddlewareMixin):
    """
    Middleware to check AWS IAM user permissions for API endpoints
    """
    
    def process_request(self, request):
        # Skip if no AWS user (already handled by auth middleware)
        if not hasattr(request, 'aws_user'):
            return None
        
        # Admin users have access to everything
        if request.user_role == 'admin':
            return None
        
        # Check if user has access to this endpoint
        path_parts = request.path.strip('/').split('/')
        
        if len(path_parts) >= 3 and path_parts[0] == 'api' and path_parts[1] == 'v1':
            endpoint = path_parts[2]
            
            # Check permission
            allowed_endpoints = request.allowed_endpoints
            
            if '*' not in allowed_endpoints and endpoint not in allowed_endpoints:
                return JsonResponse({
                    'error': 'Permission denied',
                    'details': 'Usted no tiene permiso para realizar esta acción.'
                }, status=status.HTTP_403_FORBIDDEN)
        
        return None