"""
Development middleware to disable authentication when USE_COGNITO_AUTH=False
"""
from django.conf import settings
from django.http import HttpResponse
import json

class DevAuthBypassMiddleware:
    """
    Middleware to bypass authentication in development mode
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Only apply in development when Cognito is disabled
        if not getattr(settings, 'USE_COGNITO_AUTH', False) and settings.DEBUG:
            # Create a fake user for development
            if not hasattr(request, 'user') or not request.user.is_authenticated:
                from django.contrib.auth.models import AnonymousUser
                # Create a development user object
                class DevUser:
                    is_authenticated = True
                    is_anonymous = False
                    username = 'dev_user'
                    email = 'dev@localhost'
                    
                    def has_perm(self, perm, obj=None):
                        return True
                    
                    def get_all_permissions(self, obj=None):
                        return set()
                    
                    def get_group_permissions(self, obj=None):
                        return set()
                    
                    def get_user_permissions(self, obj=None):
                        return set()
                    
                    def has_perms(self, perm_list, obj=None):
                        return True
                    
                    def has_module_perms(self, module):
                        return True
                
                request.user = DevUser()
        
        response = self.get_response(request)
        return response