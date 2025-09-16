"""
Django Authentication Views - Enhanced Version
Secure Django user authentication system with comprehensive error handling,
logging, and security best practices.
"""
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User, Group
from django.contrib.auth.decorators import login_required
from django.contrib.sessions.models import Session
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.views.decorators.cache import never_cache
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

# Configure logger
logger = logging.getLogger(__name__)

class AuthResponse:
    """Helper class for consistent authentication responses"""

    @staticmethod
    def success(data: Dict[str, Any], message: str = "Success") -> Response:
        """Return successful authentication response"""
        return Response({
            'success': True,
            'message': message,
            'timestamp': timezone.now().isoformat(),
            **data
        }, status=status.HTTP_200_OK)

    @staticmethod
    def error(message: str, error_code: str = "AUTH_ERROR", status_code: int = status.HTTP_400_BAD_REQUEST) -> Response:
        """Return error authentication response"""
        return Response({
            'success': False,
            'error': message,
            'error_code': error_code,
            'timestamp': timezone.now().isoformat()
        }, status=status_code)

def get_user_data(user: User) -> Dict[str, Any]:
    """Extract safe user data for API responses"""
    groups = [group.name for group in user.groups.all()]

    # If user is superuser or staff and has no groups, add "Administradores"
    if (user.is_superuser or user.is_staff) and not groups:
        groups = ['Administradores']

    # Superusers and staff have all permissions
    if user.is_superuser or user.is_staff:
        permissions = {
            'can_manage_users': True,
            'can_view_admin': True,
            'can_access_dashboard': True,
            'can_create_orders': True,
            'can_process_payments': True,
            'can_manage_kitchen': True
        }
    else:
        # Role-based permissions for regular users
        permissions = {
            'can_manage_users': False,  # Only staff/superuser
            'can_view_admin': False,   # Only staff/superuser
            'can_access_dashboard': any(role in groups for role in ['Administradores', 'Gerentes']),
            'can_create_orders': any(role in groups for role in ['Administradores', 'Gerentes', 'Meseros']),
            'can_process_payments': any(role in groups for role in ['Administradores', 'Cajeros']),
            'can_manage_kitchen': any(role in groups for role in ['Administradores', 'Cocineros'])
        }

    return {
        'id': user.id,
        'username': user.username,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
        'is_active': user.is_active,
        'date_joined': user.date_joined.isoformat(),
        'last_login': user.last_login.isoformat() if user.last_login else None,
        'groups': groups,
        'permissions': permissions
    }

def validate_auth_data(data: Dict[str, Any]) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Validate and extract authentication data"""
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username:
        return None, None, "El nombre de usuario es requerido"

    if not password:
        return None, None, "La contraseña es requerida"

    if len(username) < 3:
        return None, None, "El nombre de usuario debe tener al menos 3 caracteres"

    if len(password) < 6:
        return None, None, "La contraseña debe tener al menos 6 caracteres"

    return username, password, None

@api_view(['POST'])
@permission_classes([AllowAny])
@never_cache
def login_view(request):
    """
    Enhanced login endpoint with comprehensive security and logging

    POST /api/v1/auth/login/
    Body: {"username": "user", "password": "pass"}
    """
    client_ip = request.META.get('REMOTE_ADDR', 'unknown')
    user_agent = request.META.get('HTTP_USER_AGENT', 'unknown')

    try:
        # Parse and validate request data
        if not request.body:
            logger.warning(f"Empty login attempt from {client_ip}")
            return AuthResponse.error("Datos de login requeridos", "EMPTY_REQUEST")

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON in login attempt from {client_ip}")
            return AuthResponse.error("Formato JSON inválido", "INVALID_JSON")

        # Validate authentication data
        username, password, error = validate_auth_data(data)
        if error:
            logger.warning(f"Invalid login data from {client_ip}: {error}")
            return AuthResponse.error(error, "VALIDATION_ERROR")

        # Check if user already authenticated
        if request.user.is_authenticated:
            logger.info(f"Already authenticated user {request.user.username} tried to login again from {client_ip}")
            return AuthResponse.success({
                'user': get_user_data(request.user),
                'already_authenticated': True
            }, "Ya tienes una sesión activa")

        # Attempt authentication
        logger.info(f"Login attempt for user '{username}' from {client_ip}")
        user = authenticate(request, username=username, password=password)

        if user is not None:
            if not user.is_active:
                logger.warning(f"Inactive user '{username}' attempted login from {client_ip}")
                return AuthResponse.error(
                    "Cuenta desactivada. Contacta al administrador",
                    "ACCOUNT_INACTIVE",
                    status.HTTP_403_FORBIDDEN
                )

            # Perform login
            login(request, user)

            # Update last login
            user.last_login = timezone.now()
            user.save(update_fields=['last_login'])

            # Log successful login
            logger.info(f"Successful login for user '{username}' (ID: {user.id}) from {client_ip}")

            # Clean old sessions for this user (optional security measure)
            try:
                current_session_key = request.session.session_key
                user_sessions = Session.objects.filter(
                    expire_date__gte=timezone.now()
                ).exclude(session_key=current_session_key)

                for session in user_sessions:
                    session_data = session.get_decoded()
                    if session_data.get('_auth_user_id') == str(user.id):
                        session.delete()
                        logger.debug(f"Cleaned old session for user {username}")
            except Exception as e:
                logger.warning(f"Error cleaning old sessions for {username}: {e}")

            return AuthResponse.success({
                'user': get_user_data(user),
                'session_id': request.session.session_key[:8] + '...',  # Partial session ID for debugging
            }, f"Bienvenido, {user.username}!")

        else:
            # Authentication failed
            logger.warning(f"Failed login attempt for user '{username}' from {client_ip} (User-Agent: {user_agent[:100]})")

            # Check if user exists to provide better error message
            user_exists = User.objects.filter(username=username).exists()
            if not user_exists:
                error_msg = "Usuario no encontrado"
                error_code = "USER_NOT_FOUND"
            else:
                error_msg = "Contraseña incorrecta"
                error_code = "INVALID_PASSWORD"

            return AuthResponse.error(
                error_msg,
                error_code,
                status.HTTP_401_UNAUTHORIZED
            )

    except Exception as e:
        logger.error(f"Critical error during login from {client_ip}: {str(e)}", exc_info=True)
        return AuthResponse.error(
            "Error interno del servidor",
            "INTERNAL_ERROR",
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@never_cache
def logout_view(request):
    """
    Enhanced logout endpoint with session cleanup

    POST /api/v1/auth/logout/
    """
    client_ip = request.META.get('REMOTE_ADDR', 'unknown')

    try:
        user = request.user
        username = user.username if user.is_authenticated else "anonymous"
        session_key = request.session.session_key

        logger.info(f"Logout request from user '{username}' (IP: {client_ip}, Session: {session_key[:8] if session_key else 'None'}...)")

        if not user.is_authenticated:
            logger.warning(f"Logout attempt from non-authenticated user (IP: {client_ip})")
            return AuthResponse.error(
                "No hay sesión activa para cerrar",
                "NOT_AUTHENTICATED",
                status.HTTP_401_UNAUTHORIZED
            )

        # Store user info before logout
        user_info = {
            'username': username,
            'id': user.id,
            'session_duration': None
        }

        # Calculate session duration if possible
        if user.last_login:
            session_duration = timezone.now() - user.last_login
            user_info['session_duration'] = str(session_duration)

        # Perform logout
        logout(request)

        # Additional session cleanup
        try:
            if session_key:
                Session.objects.filter(session_key=session_key).delete()
                logger.debug(f"Cleaned session {session_key[:8]}... for user {username}")
        except Exception as e:
            logger.warning(f"Error cleaning session for {username}: {e}")

        logger.info(f"Successful logout for user '{username}' from {client_ip}")

        return AuthResponse.success({
            'logged_out_user': user_info['username'],
            'session_duration': user_info.get('session_duration')
        }, "Sesión cerrada exitosamente")

    except Exception as e:
        logger.error(f"Critical error during logout from {client_ip}: {str(e)}", exc_info=True)
        return AuthResponse.error(
            "Error al cerrar sesión",
            "LOGOUT_ERROR",
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
@never_cache
def user_status(request):
    """
    Enhanced user status endpoint with detailed session info

    GET /api/v1/auth/status/
    """
    try:
        if request.user.is_authenticated:
            user = request.user
            session_key = request.session.session_key

            # Get session information
            session_info = {
                'session_key': session_key[:8] + '...' if session_key else None,
                'session_age': None,
                'expires_at': None
            }

            if session_key:
                try:
                    session_obj = Session.objects.get(session_key=session_key)
                    session_info['expires_at'] = session_obj.expire_date.isoformat()

                    # Calculate session age
                    if user.last_login:
                        session_age = timezone.now() - user.last_login
                        session_info['session_age'] = str(session_age)
                except Session.DoesNotExist:
                    logger.warning(f"Session {session_key} not found for user {user.username}")

            return Response({
                'authenticated': True,
                'user': get_user_data(user),
                'session': session_info,
                'timestamp': timezone.now().isoformat()
            })
        else:
            return Response({
                'authenticated': False,
                'user': None,
                'session': None,
                'timestamp': timezone.now().isoformat()
            })

    except Exception as e:
        logger.error(f"Error checking user status: {str(e)}", exc_info=True)
        return Response({
            'authenticated': False,
            'user': None,
            'error': 'Error checking authentication status',
            'timestamp': timezone.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    """
    Enhanced user registration endpoint with proper validation

    POST /api/v1/auth/register/
    """
    client_ip = request.META.get('REMOTE_ADDR', 'unknown')

    try:
        data = json.loads(request.body)

        # Check permissions
        users_exist = User.objects.exists()
        is_admin_request = request.user.is_authenticated and request.user.is_staff

        if users_exist and not is_admin_request:
            logger.warning(f"Unauthorized registration attempt from {client_ip}")
            return AuthResponse.error(
                "Solo los administradores pueden crear nuevos usuarios",
                "UNAUTHORIZED",
                status.HTTP_403_FORBIDDEN
            )

        # Validate required fields
        username = data.get('username', '').strip()
        password = data.get('password', '')
        is_staff = data.get('is_staff', False)
        groups = data.get('groups', [])

        if not username or not password:
            return AuthResponse.error("Usuario y contraseña son requeridos", "MISSING_FIELDS")

        # Validate password strength
        try:
            validate_password(password)
        except ValidationError as e:
            return AuthResponse.error(f"Contraseña inválida: {'; '.join(e.messages)}", "WEAK_PASSWORD")

        # Check if user exists
        if User.objects.filter(username=username).exists():
            return AuthResponse.error("El usuario ya existe", "USER_EXISTS")

        # Create user with transaction
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                password=password
            )

            if is_staff:
                user.is_staff = True
                user.save()

            # Add to groups
            for group_name in groups:
                group, created = Group.objects.get_or_create(name=group_name)
                user.groups.add(group)
                if created:
                    logger.info(f"Created new group: {group_name}")

        logger.info(f"New user '{username}' created by {request.user.username if request.user.is_authenticated else 'system'}")

        return AuthResponse.success({
            'user': get_user_data(user)
        }, f"Usuario '{username}' creado exitosamente")

    except json.JSONDecodeError:
        return AuthResponse.error("Formato JSON inválido", "INVALID_JSON")
    except Exception as e:
        logger.error(f"Error creating user from {client_ip}: {str(e)}", exc_info=True)
        return AuthResponse.error("Error interno del servidor", "INTERNAL_ERROR", status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf_token(request):
    """
    Get CSRF token for frontend with enhanced security headers

    GET /api/v1/auth/csrf/ or /csrf/
    """
    token = get_token(request)
    return Response({
        'csrfToken': token,
        'timestamp': timezone.now().isoformat()
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def user_list(request):
    """
    Enhanced user list and creation endpoint for admin users

    GET /api/v1/auth/users/ - List all users
    POST /api/v1/auth/users/ - Create new user
    """
    if not request.user.is_staff:
        return AuthResponse.error(
            "Acceso de administrador requerido",
            "ADMIN_REQUIRED",
            status.HTTP_403_FORBIDDEN
        )

    if request.method == 'GET':
        try:
            users = User.objects.all().order_by('username')
            users_data = [get_user_data(user) for user in users]

            return Response(users_data)

        except Exception as e:
            logger.error(f"Error fetching user list: {str(e)}", exc_info=True)
            return AuthResponse.error("Error obteniendo lista de usuarios", "FETCH_ERROR", status.HTTP_500_INTERNAL_SERVER_ERROR)

    elif request.method == 'POST':
        try:
            data = request.data
            username = data.get('username', '').strip()
            password = data.get('password', '')
            is_staff = data.get('is_staff', False)
            is_active = data.get('is_active', True)
            groups = data.get('groups', [])

            if not username or not password:
                return AuthResponse.error("Usuario y contraseña son requeridos", "MISSING_FIELDS")

            # Check if user exists
            if User.objects.filter(username=username).exists():
                return AuthResponse.error("El usuario ya existe", "USER_EXISTS")

            # Create user
            with transaction.atomic():
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    is_staff=is_staff,
                    is_active=is_active
                )

                # Add to groups
                for group_name in groups:
                    group, created = Group.objects.get_or_create(name=group_name)
                    user.groups.add(group)

            logger.info(f"New user '{username}' created by {request.user.username}")

            return AuthResponse.success({
                'user': get_user_data(user)
            }, f"Usuario '{username}' creado exitosamente")

        except Exception as e:
            logger.error(f"Error creating user: {str(e)}", exc_info=True)
            return AuthResponse.error("Error creando usuario", "CREATE_ERROR", status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_detail(request, user_id):
    """
    User detail management endpoint for admin users

    GET /api/v1/auth/users/{id}/ - Get user details
    PUT /api/v1/auth/users/{id}/ - Update user
    PATCH /api/v1/auth/users/{id}/ - Partial update user
    DELETE /api/v1/auth/users/{id}/ - Delete user
    """
    if not request.user.is_staff:
        return AuthResponse.error(
            "Acceso de administrador requerido",
            "ADMIN_REQUIRED",
            status.HTTP_403_FORBIDDEN
        )

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AuthResponse.error("Usuario no encontrado", "USER_NOT_FOUND", status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(get_user_data(user))

    elif request.method in ['PUT', 'PATCH']:
        try:
            data = request.data

            # Update basic fields
            if 'is_staff' in data and not user.is_superuser:
                user.is_staff = data['is_staff']
            if 'is_active' in data and user.id != request.user.id:
                user.is_active = data['is_active']

            # Update password if provided
            if 'password' in data and data['password']:
                user.set_password(data['password'])

            # Update groups
            if 'groups' in data and not user.is_superuser:
                user.groups.clear()
                for group_name in data['groups']:
                    group, created = Group.objects.get_or_create(name=group_name)
                    user.groups.add(group)

            user.save()

            logger.info(f"User '{user.username}' updated by {request.user.username}")

            return AuthResponse.success({
                'user': get_user_data(user)
            }, f"Usuario '{user.username}' actualizado exitosamente")

        except Exception as e:
            logger.error(f"Error updating user: {str(e)}", exc_info=True)
            return AuthResponse.error("Error actualizando usuario", "UPDATE_ERROR", status.HTTP_500_INTERNAL_SERVER_ERROR)

    elif request.method == 'DELETE':
        # Prevent self-deletion and superuser deletion
        if user.id == request.user.id:
            return AuthResponse.error("No puede eliminar su propio usuario", "SELF_DELETE")
        if user.is_superuser:
            return AuthResponse.error("No puede eliminar un superusuario", "SUPERUSER_DELETE")

        username = user.username
        user.delete()
        logger.info(f"User '{username}' deleted by {request.user.username}")

        return AuthResponse.success({}, f"Usuario '{username}' eliminado exitosamente")


@api_view(['GET'])
@permission_classes([AllowAny])
def setup_status(request):
    """
    Check if initial setup is needed

    GET /api/v1/auth/setup-status/
    """
    try:
        admin_exists = User.objects.filter(is_superuser=True).exists()
        users_exist = User.objects.exists()
        total_users = User.objects.count()

        return Response({
            'setup_needed': not admin_exists,
            'users_exist': users_exist,
            'admin_exists': admin_exists,
            'total_users': total_users,
            'timestamp': timezone.now().isoformat()
        })

    except Exception as e:
        logger.error(f"Error checking setup status: {str(e)}", exc_info=True)
        return Response({
            'error': 'Error checking setup status',
            'timestamp': timezone.now().isoformat()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """
    Change user password endpoint

    POST /api/v1/auth/change-password/
    Body: {"current_password": "old", "new_password": "new"}
    """
    try:
        data = json.loads(request.body)
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')

        if not current_password or not new_password:
            return AuthResponse.error("Contraseña actual y nueva son requeridas", "MISSING_PASSWORDS")

        user = request.user

        # Verify current password
        if not user.check_password(current_password):
            logger.warning(f"Failed password change attempt for user {user.username}")
            return AuthResponse.error("Contraseña actual incorrecta", "INVALID_CURRENT_PASSWORD", status.HTTP_401_UNAUTHORIZED)

        # Validate new password
        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return AuthResponse.error(f"Nueva contraseña inválida: {'; '.join(e.messages)}", "WEAK_PASSWORD")

        # Change password
        user.set_password(new_password)
        user.save()

        logger.info(f"Password changed successfully for user {user.username}")

        return AuthResponse.success({
            'user': get_user_data(user)
        }, "Contraseña cambiada exitosamente")

    except json.JSONDecodeError:
        return AuthResponse.error("Formato JSON inválido", "INVALID_JSON")
    except Exception as e:
        logger.error(f"Error changing password: {str(e)}", exc_info=True)
        return AuthResponse.error("Error interno del servidor", "INTERNAL_ERROR", status.HTTP_500_INTERNAL_SERVER_ERROR)