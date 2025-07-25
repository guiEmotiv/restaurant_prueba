from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .serializers import UserLoginSerializer, LoginResponseSerializer
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
    operation_id='password_reset_instructions',
    responses={200: {'description': 'Password reset instructions for AWS IAM users'}},
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