"""
Enhanced Permission Logging System
Logs detailed permission checks across all Django REST Framework views
"""
import logging
import functools
import time
from typing import Any, Callable
from django.contrib.auth.models import User, AnonymousUser
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

logger = logging.getLogger('backend.auth_views')

class PermissionLogger:
    """Logger for detailed permission tracking"""

    @staticmethod
    def log_permission_check(view_name: str, user: User, method: str,
                           permission_classes: list, result: bool,
                           duration_ms: float = None, extra_info: dict = None):
        """Log detailed permission check information"""

        # User information
        if isinstance(user, AnonymousUser) or not user.is_authenticated:
            user_info = "Anonymous (not authenticated)"
            user_groups = []
            user_permissions = {}
        else:
            user_groups = [g.name for g in user.groups.all()]
            user_info = f"{user.username} (ID: {user.id})"
            user_permissions = {
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
                'is_active': user.is_active,
                'groups': user_groups
            }

        # Permission class names
        permission_names = [p.__name__ for p in permission_classes] if permission_classes else ['No permissions']

        # Log level based on result
        log_level = logging.INFO if result else logging.WARNING

        # Main permission log
        logger.log(log_level, f"🔐 PERMISSION CHECK: {view_name}")
        logger.log(log_level, f"   🌐 Method: {method}")
        logger.log(log_level, f"   👤 User: {user_info}")
        logger.log(log_level, f"   📋 Required: {', '.join(permission_names)}")
        logger.log(log_level, f"   ✅ Result: {'GRANTED' if result else 'DENIED'}")

        if duration_ms:
            logger.log(log_level, f"   ⏱️  Duration: {duration_ms:.1f}ms")

        # Detailed user info for authenticated users
        if user.is_authenticated:
            logger.log(log_level, f"   👥 Groups: {user_groups}")
            logger.log(log_level, f"   🏛️  Flags: Staff={user.is_staff}, Super={user.is_superuser}, Active={user.is_active}")

        # Extra context information
        if extra_info:
            for key, value in extra_info.items():
                logger.log(log_level, f"   📌 {key}: {value}")

        # Log denial details for debugging
        if not result:
            logger.warning(f"❌ PERMISSION DENIED: {user_info} tried to {method} {view_name}")
            if permission_classes:
                logger.warning(f"   Required permissions: {', '.join(permission_names)}")
            if user.is_authenticated:
                logger.warning(f"   User has groups: {user_groups}")
                logger.warning(f"   User flags: staff={user.is_staff}, super={user.is_superuser}")

def log_permissions(view_func: Callable = None, *, extra_context: dict = None):
    """
    Decorator to log permission checks for Django REST Framework views

    Usage:
        @log_permissions
        def my_view(request):
            ...

        @log_permissions(extra_context={'endpoint': 'user_management'})
        def admin_view(request):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Get view and request from args
            if len(args) >= 2 and hasattr(args[0], 'permission_classes'):
                # Class-based view: self, request
                view_instance, request = args[0], args[1]
                view_name = f"{view_instance.__class__.__name__}.{func.__name__}"
                permission_classes = getattr(view_instance, 'permission_classes', [])
            elif len(args) >= 1 and hasattr(args[0], 'user'):
                # Function-based view: request
                request = args[0]
                view_name = f"{func.__module__}.{func.__name__}"
                permission_classes = getattr(func, 'permission_classes', [])
            else:
                # Fallback
                request = None
                view_name = f"{func.__module__}.{func.__name__}"
                permission_classes = []

            if request:
                start_time = time.time()
                user = getattr(request, 'user', AnonymousUser())
                method = getattr(request, 'method', 'UNKNOWN')

                # Check if this view has permission requirements
                has_permission = True
                permission_errors = []

                # For class-based views, check permissions manually
                if hasattr(view_instance, 'get_permissions'):
                    try:
                        permissions = view_instance.get_permissions()
                        for permission in permissions:
                            if hasattr(permission, 'has_permission'):
                                perm_result = permission.has_permission(request, view_instance)
                                if not perm_result:
                                    has_permission = False
                                    permission_errors.append(permission.__class__.__name__)
                    except Exception as e:
                        logger.error(f"Error checking permissions for {view_name}: {e}")
                        has_permission = False
                        permission_errors.append(f"Error: {str(e)}")

                # Calculate duration
                duration_ms = (time.time() - start_time) * 1000

                # Extra context
                context = extra_context or {}
                if permission_errors:
                    context['failed_permissions'] = permission_errors

                # Log permission check
                PermissionLogger.log_permission_check(
                    view_name=view_name,
                    user=user,
                    method=method,
                    permission_classes=permission_classes,
                    result=has_permission,
                    duration_ms=duration_ms,
                    extra_info=context
                )

            # Execute the original function
            return func(*args, **kwargs)

        return wrapper

    # Handle both @log_permissions and @log_permissions(extra_context=...)
    if view_func is None:
        return decorator
    else:
        return decorator(view_func)


class DetailedPermissionMiddleware:
    """Middleware to log all permission checks across the application"""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Before view processing
        if hasattr(request, 'user') and request.path.startswith('/api/'):
            start_time = time.time()

            # Log API request start
            user = request.user
            method = request.method
            path = request.path

            user_info = user.username if user.is_authenticated else "Anonymous"
            logger.info(f"🔍 API REQUEST: {method} {path} | User: {user_info}")

        # Process request
        response = self.get_response(request)

        # After view processing
        if hasattr(request, 'user') and request.path.startswith('/api/'):
            duration_ms = (time.time() - start_time) * 1000
            status_code = response.status_code

            # Log response with permission context
            log_level = logging.INFO if status_code < 400 else logging.WARNING

            logger.log(log_level, f"🔍 API RESPONSE: {method} {path} | Status: {status_code} | Duration: {duration_ms:.1f}ms")

            # Log permission-related errors specifically
            if status_code == 403:
                logger.warning(f"🚫 PERMISSION DENIED: {user_info} -> {method} {path}")
            elif status_code == 401:
                logger.warning(f"🔒 AUTHENTICATION REQUIRED: {user_info} -> {method} {path}")

        return response