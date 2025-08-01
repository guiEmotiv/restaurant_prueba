"""
CSRF Exempt Middleware for API endpoints
Automatically exempts API endpoints from CSRF protection when using JWT authentication
"""
from django.utils.deprecation import MiddlewareMixin
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings


class CSRFExemptAPIMiddleware(MiddlewareMixin):
    """
    Middleware to automatically exempt API endpoints from CSRF protection
    when using JWT authentication (Cognito)
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        super().__init__(get_response)
        
    def process_view(self, request, view_func, view_args, view_kwargs):
        # Only exempt if Cognito auth is enabled and this is an API request
        if (getattr(settings, 'USE_COGNITO_AUTH', False) and 
            request.path.startswith('/api/v1/')):
            # Mark the view as CSRF exempt
            view_func = csrf_exempt(view_func)
            
        return None