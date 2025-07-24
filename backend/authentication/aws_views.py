"""
AWS IAM Authentication Views
Direct authentication against AWS IAM without database dependency
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .aws_auth import aws_authenticator
from .serializers import UserLoginSerializer
import logging

logger = logging.getLogger(__name__)

@extend_schema(
    operation_id='aws_user_login',
    request=UserLoginSerializer,
    responses={
        200: {
            'type': 'object',
            'properties': {
                'token': {'type': 'string'},
                'user': {
                    'type': 'object',
                    'properties': {
                        'id': {'type': 'integer'},
                        'username': {'type': 'string'},
                        'email': {'type': 'string'},
                        'first_name': {'type': 'string'},
                        'last_name': {'type': 'string'},
                        'role': {'type': 'string'},
                        'is_active': {'type': 'boolean'},
                        'allowed_views': {
                            'type': 'array',
                            'items': {'type': 'string'}
                        },
                        'allowed_api_endpoints': {
                            'type': 'array',
                            'items': {'type': 'string'}
                        },
                        'last_activity': {'type': 'string'},
                        'is_active_session': {'type': 'boolean'}
                    }
                },
                'message': {'type': 'string'}
            }
        },
        400: {
            'type': 'object',
            'properties': {
                'error': {'type': 'string'},
                'details': {'type': 'string'}
            }
        }
    },
    description='Login with AWS IAM credentials (access_key as username, secret_key as password)'
)
@api_view(['POST'])
@permission_classes([AllowAny])
def aws_login_view(request):
    """
    AWS IAM Login endpoint
    
    Expected payload:
    {
        "username": "AKIA...",  // AWS Access Key ID
        "password": "secret..."  // AWS Secret Access Key
    }
    """
    try:
        # Extract credentials
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()
        
        if not username or not password:
            return Response({
                'error': 'Credenciales requeridas',
                'details': 'Proporcione Access Key ID y Secret Access Key'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Authenticate against AWS IAM
        success, user_info = aws_authenticator.authenticate_user(username, password)
        
        if not success or not user_info:
            logger.warning(f"Failed AWS authentication attempt for access key: {username[:8]}...")
            return Response({
                'error': 'Credenciales inválidas',
                'details': 'Access Key ID o Secret Access Key incorrectos'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate token
        token = aws_authenticator.get_or_create_token(user_info)
        
        # Prepare response
        response_data = {
            'token': token,
            'user': {
                'id': user_info['id'],
                'username': user_info['username'],
                'email': user_info['email'],
                'first_name': user_info['first_name'],
                'last_name': user_info['last_name'],
                'role': user_info['role'],
                'is_active': user_info['is_active'],
                'allowed_views': user_info['allowed_views'],
                'allowed_api_endpoints': user_info['allowed_api_endpoints'],
                'last_activity': user_info['last_activity'],
                'is_active_session': user_info['is_active_session']
            },
            'message': f'Login successful. Welcome {user_info["first_name"]}!'
        }
        
        logger.info(f"Successful AWS IAM login for user: {user_info['username']}")
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Unexpected error in AWS login: {str(e)}")
        return Response({
            'error': 'Error interno del servidor',
            'details': 'Error durante la autenticación'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    operation_id='aws_user_logout',
    responses={
        200: {
            'type': 'object',
            'properties': {
                'message': {'type': 'string'}
            }
        }
    },
    description='Logout AWS IAM user and invalidate token'
)
@api_view(['POST'])
def aws_logout_view(request):
    """
    AWS IAM Logout endpoint
    """
    try:
        # Extract token from Authorization header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Token '):
            return Response({
                'error': 'Token de autorización requerido'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        token = auth_header.replace('Token ', '')
        
        # Logout user
        aws_authenticator.logout_user(token)
        
        return Response({
            'message': 'Logout successful'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error in AWS logout: {str(e)}")
        return Response({
            'error': 'Error durante logout'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    operation_id='aws_current_user',
    responses={
        200: {
            'type': 'object',
            'properties': {
                'user': {
                    'type': 'object',
                    'properties': {
                        'id': {'type': 'integer'},
                        'username': {'type': 'string'},
                        'email': {'type': 'string'},
                        'first_name': {'type': 'string'},
                        'last_name': {'type': 'string'},
                        'role': {'type': 'string'},
                        'is_active': {'type': 'boolean'},
                        'allowed_views': {
                            'type': 'array',
                            'items': {'type': 'string'}
                        },
                        'allowed_api_endpoints': {
                            'type': 'array',
                            'items': {'type': 'string'}
                        }
                    }
                }
            }
        },
        401: {
            'type': 'object',
            'properties': {
                'error': {'type': 'string'}
            }
        }
    },
    description='Get current AWS IAM user information'
)
@api_view(['GET'])
def aws_current_user_view(request):
    """
    Get current AWS IAM user information
    """
    try:
        # Extract token from Authorization header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Token '):
            return Response({
                'error': 'Token de autorización requerido'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        token = auth_header.replace('Token ', '')
        
        # Validate token and get user info
        user_info = aws_authenticator.validate_token(token)
        
        if not user_info:
            return Response({
                'error': 'Token inválido o expirado'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Return user info
        return Response({
            'user': {
                'id': user_info['id'],
                'username': user_info['username'],
                'email': user_info['email'],
                'first_name': user_info['first_name'],
                'last_name': user_info['last_name'],
                'role': user_info['role'],
                'is_active': user_info['is_active'],
                'allowed_views': user_info['allowed_views'],
                'allowed_api_endpoints': user_info['allowed_api_endpoints'],
                'last_activity': user_info['last_activity'],
                'is_active_session': user_info['is_active_session']
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting current AWS user: {str(e)}")
        return Response({
            'error': 'Error interno del servidor'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)