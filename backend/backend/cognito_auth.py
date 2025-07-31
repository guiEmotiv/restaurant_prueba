import jwt
import requests
import json
from functools import wraps
from django.conf import settings
from django.http import JsonResponse
from django.contrib.auth.models import AnonymousUser
import logging

logger = logging.getLogger(__name__)


class CognitoUser:
    """Represents a Cognito authenticated user"""
    def __init__(self, username, email, groups=None):
        self.username = username
        self.email = email
        self.groups = groups or []
        self.is_authenticated = True
        self.is_anonymous = False
    
    def is_admin(self):
        return 'administradores' in self.groups
    
    def is_waiter(self):
        return 'meseros' in self.groups


class CognitoAuthenticationMiddleware:
    """Middleware to authenticate requests using AWS Cognito JWT tokens"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.jwks_client = None
        
    def __call__(self, request):
        # Check if Cognito is enabled
        if not getattr(settings, 'COGNITO_ENABLED', False):
            # If Cognito is not enabled, pass through without authentication
            return self.get_response(request)
        
        # Skip authentication for certain paths
        skip_paths = ['/admin/', '/api/v1/health/', '/static/', '/media/']
        if any(request.path.startswith(path) for path in skip_paths):
            return self.get_response(request)
        
        # Get token from Authorization header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            request.user = AnonymousUser()
            return self.get_response(request)
        
        token = auth_header.split(' ')[1]
        
        try:
            # Verify and decode the JWT token
            user = self.verify_cognito_token(token)
            request.user = user
        except Exception as e:
            logger.warning(f"Token verification failed: {e}")
            request.user = AnonymousUser()
        
        return self.get_response(request)
    
    def verify_cognito_token(self, token):
        """Verify JWT token from Cognito"""
        try:
            # Decode token header to get kid
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get('kid')
            
            if not kid:
                raise ValueError("Token missing 'kid' in header")
            
            # Get public key from Cognito JWKS endpoint
            public_key = self.get_public_key(kid)
            
            # Configure expected values
            user_pool_id = getattr(settings, 'COGNITO_USER_POOL_ID', '')
            app_client_id = getattr(settings, 'COGNITO_APP_CLIENT_ID', '')
            region = getattr(settings, 'AWS_REGION', 'us-east-1')
            
            issuer = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"
            
            # Verify and decode the token
            payload = jwt.decode(
                token,
                public_key,
                algorithms=['RS256'],
                audience=app_client_id,
                issuer=issuer,
                options={
                    'verify_exp': True,
                    'verify_aud': True,
                    'verify_iss': True
                }
            )
            
            # Extract user information
            username = payload.get('username', payload.get('cognito:username', ''))
            email = payload.get('email', '')
            groups = payload.get('cognito:groups', [])
            
            return CognitoUser(username=username, email=email, groups=groups)
            
        except jwt.ExpiredSignatureError:
            raise ValueError("Token has expired")
        except jwt.InvalidTokenError as e:
            raise ValueError(f"Invalid token: {e}")
        except Exception as e:
            raise ValueError(f"Token verification failed: {e}")
    
    def get_public_key(self, kid):
        """Get public key from Cognito JWKS endpoint"""
        if not self.jwks_client:
            user_pool_id = getattr(settings, 'COGNITO_USER_POOL_ID', '')
            region = getattr(settings, 'AWS_REGION', 'us-east-1')
            jwks_url = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json"
            
            try:
                response = requests.get(jwks_url, timeout=10)
                response.raise_for_status()
                self.jwks_client = response.json()
            except requests.RequestException as e:
                raise ValueError(f"Failed to fetch JWKS: {e}")
        
        # Find the key with matching kid
        for key in self.jwks_client.get('keys', []):
            if key.get('kid') == kid:
                # Convert JWK to PEM format
                from cryptography.hazmat.primitives import serialization
                from cryptography.hazmat.primitives.asymmetric import rsa
                import base64
                
                # Extract RSA components
                n = base64.urlsafe_b64decode(key['n'] + '==')
                e = base64.urlsafe_b64decode(key['e'] + '==')
                
                # Create RSA public key
                public_numbers = rsa.RSAPublicNumbers(
                    int.from_bytes(e, 'big'),
                    int.from_bytes(n, 'big')
                )
                public_key = public_numbers.public_key()
                
                # Convert to PEM format
                pem = public_key.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo
                )
                
                return pem
        
        raise ValueError(f"Public key not found for kid: {kid}")


def cognito_required(allowed_groups=None):
    """Decorator to require Cognito authentication and optionally check groups"""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not hasattr(request.user, 'is_authenticated') or not request.user.is_authenticated:
                return JsonResponse({'error': 'Authentication required'}, status=401)
            
            if allowed_groups:
                user_groups = getattr(request.user, 'groups', [])
                if not any(group in user_groups for group in allowed_groups):
                    return JsonResponse({'error': 'Insufficient permissions'}, status=403)
            
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


# Group-specific decorators
def admin_required(view_func):
    """Require admin group membership"""
    return cognito_required(['administradores'])(view_func)


def waiter_or_admin_required(view_func):
    """Require waiter or admin group membership"""
    return cognito_required(['meseros', 'administradores'])(view_func)