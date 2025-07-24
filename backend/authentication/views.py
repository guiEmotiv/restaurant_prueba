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


@extend_schema(
    operation_id='user_login',
    request=UserLoginSerializer,
    responses={200: LoginResponseSerializer},
    description='Login user and get authentication token'
)
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Login endpoint for restaurant users
    """
    serializer = UserLoginSerializer(data=request.data)
    
    if serializer.is_valid():
        user = serializer.validated_data['user']
        
        # Update user session info
        user.last_activity = timezone.now()
        user.is_active_session = True
        user.save(update_fields=['last_activity', 'is_active_session'])
        
        # Get or create token
        token, created = Token.objects.get_or_create(user=user)
        
        # Serialize user data
        user_serializer = UserSerializer(user)
        
        return Response({
            'token': token.key,
            'user': user_serializer.data,
            'message': f'Login successful. Welcome {user.get_role_display()}!'
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    operation_id='user_logout',
    responses={200: {'description': 'Logout successful'}},
    description='Logout user and invalidate token'
)
@api_view(['POST'])
def logout_view(request):
    """
    Logout endpoint for restaurant users
    """
    if request.user.is_authenticated:
        # Update user session info
        request.user.is_active_session = False
        request.user.save(update_fields=['is_active_session'])
        
        # Delete the token
        try:
            token = Token.objects.get(user=request.user)
            token.delete()
        except Token.DoesNotExist:
            pass
    
    return Response({
        'message': 'Logout successful'
    }, status=status.HTTP_200_OK)


@extend_schema(
    operation_id='current_user',
    responses={200: UserSerializer},
    description='Get current user information'
)
@api_view(['GET'])
def current_user_view(request):
    """
    Get current user information
    """
    if request.user.is_authenticated:
        # Update last activity
        request.user.last_activity = timezone.now()
        request.user.save(update_fields=['last_activity'])
        
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    return Response({'detail': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)


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
    description='Get current user permissions and role information'
)
@api_view(['GET'])
def user_permissions_view(request):
    """
    Get current user permissions and role information
    """
    if not request.user.is_authenticated:
        return Response({'detail': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
    
    return Response({
        'role': request.user.role,
        'role_display': request.user.get_role_display(),
        'allowed_views': request.user.allowed_views,
        'allowed_api_endpoints': request.user.allowed_api_endpoints,
        'is_admin': request.user.role == 'admin',
        'is_mesero': request.user.role == 'mesero',
        'is_cajero': request.user.role == 'cajero',
    })