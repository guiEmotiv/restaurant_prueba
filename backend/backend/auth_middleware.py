"""
Enhanced Authentication Debugging Middleware
Logs detailed information about authentication, sessions, and permissions
"""
import logging
import time
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger('backend.auth_views')

class AuthDebugMiddleware(MiddlewareMixin):
    """
    Middleware for debugging authentication issues in development
    Logs detailed information about each request's authentication status
    """

    def process_request(self, request):
        """Process incoming request and log authentication details"""
        start_time = time.time()
        request._auth_debug_start = start_time

        # Get request details
        method = request.method
        path = request.path
        ip = self.get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:100]

        # Authentication status
        user = getattr(request, 'user', None)
        is_authenticated = user and user.is_authenticated if user else False
        username = user.username if is_authenticated else 'Anonymous'
        user_id = user.id if is_authenticated else None

        # Session information
        session_key = request.session.session_key if hasattr(request, 'session') else None
        session_data = {}
        if hasattr(request, 'session') and request.session:
            try:
                # Get safe session data (avoid sensitive info)
                session_data = {
                    'session_key': session_key[:8] + '...' if session_key else None,
                    'is_empty': request.session.is_empty(),
                    'modified': request.session.modified,
                    'has_auth_user_id': '_auth_user_id' in request.session,
                }
                if '_auth_user_id' in request.session:
                    session_data['auth_user_id'] = request.session['_auth_user_id']
            except Exception as e:
                session_data['error'] = str(e)

        # CSRF information
        csrf_token = request.META.get('CSRF_COOKIE')
        csrf_header = request.META.get('HTTP_X_CSRFTOKEN')

        # Log request details for auth-related endpoints
        if self.is_auth_endpoint(path):
            logger.info(f"🔍 AUTH REQUEST: {method} {path}")
            logger.info(f"   👤 User: {username} (ID: {user_id}) | Auth: {is_authenticated}")
            logger.info(f"   🌐 IP: {ip} | UA: {user_agent}")
            logger.info(f"   🍪 Session: {session_data}")
            logger.info(f"   🔒 CSRF Cookie: {csrf_token[:10] if csrf_token else None}...")
            logger.info(f"   🔒 CSRF Header: {csrf_header[:10] if csrf_header else None}...")

            # Log user groups and permissions for authenticated users
            if is_authenticated and user:
                groups = [g.name for g in user.groups.all()]
                logger.info(f"   👥 Groups: {groups}")
                logger.info(f"   🏛️  Staff: {user.is_staff} | Super: {user.is_superuser} | Active: {user.is_active}")

        return None

    def process_response(self, request, response):
        """Process response and log authentication results"""
        path = request.path
        method = request.method
        status_code = response.status_code

        # Calculate request duration
        start_time = getattr(request, '_auth_debug_start', time.time())
        duration = (time.time() - start_time) * 1000  # in milliseconds

        # Log response for auth endpoints
        if self.is_auth_endpoint(path):
            user = getattr(request, 'user', None)
            username = user.username if user and user.is_authenticated else 'Anonymous'

            logger.info(f"🔍 AUTH RESPONSE: {method} {path} | Status: {status_code} | Duration: {duration:.1f}ms")
            logger.info(f"   👤 Final User: {username}")

            # Log detailed information for error responses
            if status_code >= 400:
                logger.warning(f"❌ AUTH ERROR: {status_code} for {method} {path}")
                if hasattr(response, 'content') and response.content:
                    try:
                        content = response.content.decode('utf-8')[:500]
                        logger.warning(f"   📄 Response: {content}...")
                    except:
                        logger.warning(f"   📄 Response: [Binary content]")

            # Log session changes for login/logout
            if path.endswith(('/login/', '/logout/')):
                session_key = request.session.session_key if hasattr(request, 'session') else None
                logger.info(f"   🍪 Session after auth: {session_key[:8] if session_key else None}...")

        return response

    def process_exception(self, request, exception):
        """Log authentication-related exceptions"""
        path = request.path

        if self.is_auth_endpoint(path):
            user = getattr(request, 'user', None)
            username = user.username if user and user.is_authenticated else 'Anonymous'

            logger.error(f"💥 AUTH EXCEPTION: {path} | User: {username}")
            logger.error(f"   Exception: {type(exception).__name__}: {str(exception)}")

        return None

    @staticmethod
    def get_client_ip(request):
        """Get client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    @staticmethod
    def is_auth_endpoint(path):
        """Check if the path is authentication-related"""
        auth_patterns = [
            '/api/v1/auth/',
            '/csrf/',
            '/admin/login/',
            '/admin/logout/',
        ]
        return any(pattern in path for pattern in auth_patterns)