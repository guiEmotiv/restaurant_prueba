from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.utils import timezone
from django.contrib.auth import authenticate
from drf_spectacular.utils import extend_schema
from .models import RestaurantUser
from .serializers import (
    UserLoginSerializer, UserSerializer, UserCreateSerializer, 
    LoginResponseSerializer
)
from .permissions import AdminOnlyPermission
from .aws_auth import aws_authenticator
import logging

logger = logging.getLogger(__name__)


@extend_schema(
    operation_id='user_login',
    request=UserLoginSerializer,
    responses={200: LoginResponseSerializer},
    description='Login user with AWS IAM credentials'
)
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Login endpoint using AWS IAM authentication
    """
    # Get credentials from request
    access_key = request.data.get('username')  # Frontend sends as username
    secret_key = request.data.get('password')  # Frontend sends as password
    
    if not access_key or not secret_key:
        return Response({
            'message': 'AWS Access Key y Secret Key son requeridos'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Authenticate with AWS IAM
    success, user_info = aws_authenticator.authenticate_user(access_key, secret_key)
    
    if not success or not user_info:
        return Response({
            'message': 'Credenciales AWS IAM inválidas'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    # Generate authentication token
    token = aws_authenticator.get_or_create_token(user_info)
    
    # Format role display names
    role_display_map = {
        'admin': 'Administrador',
        'mesero': 'Mesero', 
        'cajero': 'Cajero',
        'cocinero': 'Cocinero'
    }
    
    return Response({
        'token': token,
        'user': {
            'id': user_info['id'],
            'username': user_info['username'],
            'first_name': user_info['first_name'],
            'last_name': user_info['last_name'],
            'email': user_info['email'],
            'role': user_info['role'],
            'allowed_views': user_info['allowed_views'],
            'allowed_api_endpoints': user_info['allowed_api_endpoints'],
            'is_active': user_info['is_active'],
            'last_activity': user_info['last_activity'],
            'is_active_session': user_info['is_active_session'],
        },
        'message': f'Login exitoso. Bienvenido {role_display_map.get(user_info["role"], "Usuario")}!'
    }, status=status.HTTP_200_OK)


@extend_schema(
    operation_id='user_logout',
    responses={200: {'description': 'Logout successful'}},
    description='Logout user and invalidate AWS IAM token'
)
@api_view(['POST'])
def logout_view(request):
    """
    Logout endpoint for AWS IAM users
    """
    # Get token from request headers
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Token '):
        token = auth_header[6:]  # Remove 'Token ' prefix
        aws_authenticator.logout_user(token)
    
    return Response({
        'message': 'Logout exitoso'
    }, status=status.HTTP_200_OK)


@extend_schema(
    operation_id='current_user',
    responses={200: UserSerializer},
    description='Get current AWS IAM user information'
)
@api_view(['GET'])
def current_user_view(request):
    """
    Get current AWS IAM user information
    """
    # Get token from request headers
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header.startswith('Token '):
        return Response({'detail': 'Token de autenticación requerido'}, status=status.HTTP_401_UNAUTHORIZED)
    
    token = auth_header[6:]  # Remove 'Token ' prefix
    user_info = aws_authenticator.validate_token(token)
    
    if not user_info:
        return Response({'detail': 'Token inválido o expirado'}, status=status.HTTP_401_UNAUTHORIZED)
    
    return Response({
        'id': user_info['id'],
        'username': user_info['username'],
        'first_name': user_info['first_name'],
        'last_name': user_info['last_name'],
        'email': user_info['email'],
        'role': user_info['role'],
        'allowed_views': user_info['allowed_views'],
        'allowed_api_endpoints': user_info['allowed_api_endpoints'],
        'is_active': user_info['is_active'],
        'last_activity': user_info['last_activity'],
        'is_active_session': user_info['is_active_session'],
    })


@extend_schema(
    operation_id='create_user',
    request=UserCreateSerializer,
    responses={201: UserSerializer},
    description='Create new restaurant user (Admin only)'
)
@api_view(['POST'])
@permission_classes([AdminOnlyPermission])
def create_user_view(request):
    """
    Create new restaurant user (Admin only)
    """
    serializer = UserCreateSerializer(data=request.data)
    
    if serializer.is_valid():
        user = serializer.save()
        user_serializer = UserSerializer(user)
        
        return Response({
            'user': user_serializer.data,
            'message': f'User {user.username} created successfully'
        }, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    operation_id='list_users',
    responses={200: UserSerializer(many=True)},
    description='List all restaurant users (Admin only)'
)
@api_view(['GET'])
@permission_classes([AdminOnlyPermission])
def list_users_view(request):
    """
    List all restaurant users (Admin only)
    """
    users = RestaurantUser.objects.all().order_by('username')
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)


@extend_schema(
    operation_id='user_permissions',
    responses={200: {'description': 'User permissions and role info'}},
    description='Get current AWS IAM user permissions and role information'
)
@api_view(['GET'])
def user_permissions_view(request):
    """
    Get current AWS IAM user permissions and role information
    """
    # Get token from request headers
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header.startswith('Token '):
        return Response({'detail': 'Token de autenticación requerido'}, status=status.HTTP_401_UNAUTHORIZED)
    
    token = auth_header[6:]  # Remove 'Token ' prefix
    user_info = aws_authenticator.validate_token(token)
    
    if not user_info:
        return Response({'detail': 'Token inválido o expirado'}, status=status.HTTP_401_UNAUTHORIZED)
    
    return Response({
        'role': user_info['role'],
        'role_display': user_info['role'].title(),
        'allowed_views': user_info['allowed_views'],
        'allowed_api_endpoints': user_info['allowed_api_endpoints'],
        'is_admin': user_info['role'] == 'admin',
        'is_mesero': user_info['role'] == 'mesero',
        'is_cajero': user_info['role'] == 'cajero',
        'is_cocinero': user_info['role'] == 'cocinero',
    })


@extend_schema(
    operation_id='password_reset_instructions',
    responses={200: {'description': 'Password reset instructions'}},
    description='Get password reset instructions for AWS IAM users'
)
@api_view(['GET'])
@permission_classes([AllowAny])
def password_reset_instructions_view(request):
    """
    Get password reset instructions for AWS IAM users
    """
    instructions = aws_authenticator.get_password_reset_instructions()
    
    return Response({
        'instructions': instructions,
        'simple_users': list(aws_authenticator.SIMPLE_USER_MAPPING.keys()),
        'default_password': 'simple123'
    })