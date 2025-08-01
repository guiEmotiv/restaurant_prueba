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
            # Return 401 for API endpoints that require authentication
            if request.path.startswith('/api/v1/'):
                return JsonResponse({'detail': 'Las credenciales de autenticación no se proveyeron.'}, status=401)
            request.user = AnonymousUser()
            return self.get_response(request)
        
        token = auth_header.split(' ')[1]
        
        try:
            # Verify and decode the JWT token
            user = self.verify_cognito_token(token)
            request.user = user
        except Exception as e:
            logger.warning(f"Token verification failed: {e}")
            # Return 401 for API endpoints with invalid tokens
            if request.path.startswith('/api/v1/'):
                return JsonResponse({'detail': 'Token de autenticación inválido.'}, status=401)
            request.user = AnonymousUser()
        
        return self.get_response(request)
    
    def verify_cognito_token(self, token):
        """Verify JWT token from Cognito"""
        try:
            # Configure expected values
            user_pool_id = getattr(settings, 'COGNITO_USER_POOL_ID', '')
            app_client_id = getattr(settings, 'COGNITO_APP_CLIENT_ID', '')
            region = getattr(settings, 'AWS_REGION', 'us-east-1')
            
            logger.info(f"🔍 Token verification config:")
            logger.info(f"  User Pool ID: {user_pool_id}")
            logger.info(f"  App Client ID: {app_client_id}")
            logger.info(f"  Region: {region}")
            
            if not user_pool_id or not app_client_id:
                raise ValueError(f"Missing Cognito configuration: pool_id={user_pool_id}, client_id={app_client_id}")
            
            # Decode token header to get kid
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get('kid')
            
            logger.info(f"🔍 Token header kid: {kid}")
            
            if not kid:
                raise ValueError("Token missing 'kid' in header")
            
            # Get public key from Cognito JWKS endpoint
            public_key = self.get_public_key(kid)
            
            issuer = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"
            
            # First decode without verification to check token structure
            unverified_payload = jwt.decode(token, options={"verify_signature": False})
            logger.info(f"🔍 Token payload claims: {list(unverified_payload.keys())}")
            
            # Check if token has 'aud' claim
            has_aud = 'aud' in unverified_payload
            logger.info(f"🔍 Token has 'aud' claim: {has_aud}")
            
            # Verify and decode the token with appropriate options
            logger.info(f"🔍 JWT verification with issuer: {issuer}")
            if has_aud:
                logger.info(f"🔍 JWT verification with audience: {app_client_id}")
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
            else:
                # For Access Tokens without 'aud' claim, verify client_id in token_use or client_id claim
                logger.info(f"🔍 JWT verification without audience (Access Token)")
                payload = jwt.decode(
                    token,
                    public_key,
                    algorithms=['RS256'],
                    issuer=issuer,
                    options={
                        'verify_exp': True,
                        'verify_aud': False,  # Skip audience verification
                        'verify_iss': True
                    }
                )
                
                # Manually verify client ID for Access Tokens
                token_client_id = payload.get('client_id', '')
                logger.info(f"🔍 Token client_id: {token_client_id}")
                if token_client_id != app_client_id:
                    raise ValueError(f"Token client_id '{token_client_id}' does not match expected '{app_client_id}'")              
                logger.info(f"✅ Client ID verified successfully")
            
            logger.info(f"✅ Token verified successfully for user: {payload.get('username', payload.get('cognito:username', 'unknown'))}")
            logger.info(f"🔍 Token type: {payload.get('token_use', 'unknown')}")
            logger.info(f"🔍 Token groups: {payload.get('cognito:groups', [])}")
            
            # Extract user information (handle both ID tokens and Access tokens)
            username = payload.get('username', payload.get('cognito:username', ''))
            email = payload.get('email', '')
            groups = payload.get('cognito:groups', [])
            
            logger.info(f"✅ User extracted: username={username}, email={email}, groups={groups}")
            
            return CognitoUser(username=username, email=email, groups=groups)
            
        except jwt.ExpiredSignatureError as e:
            logger.warning(f"❌ Token expired: {e}")
            raise ValueError("Token has expired")
        except jwt.InvalidTokenError as e:
            logger.warning(f"❌ Invalid token: {e}")
            raise ValueError(f"Invalid token: {e}")
        except Exception as e:
            logger.warning(f"❌ Token verification failed: {e}")
            raise ValueError(f"Token verification failed: {e}")
    
    def get_public_key(self, kid):
        """Get public key from Cognito JWKS endpoint"""
        if not self.jwks_client:
            user_pool_id = getattr(settings, 'COGNITO_USER_POOL_ID', '')
            region = getattr(settings, 'AWS_REGION', 'us-east-1')
            jwks_url = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json"
            
            logger.info(f"🔍 Fetching JWKS from: {jwks_url}")
            
            try:
                response = requests.get(jwks_url, timeout=10)
                response.raise_for_status()
                self.jwks_client = response.json()
                logger.info(f"✅ JWKS fetched successfully, {len(self.jwks_client.get('keys', []))} keys found")
            except requests.RequestException as e:
                logger.error(f"❌ Failed to fetch JWKS: {e}")
                raise ValueError(f"Failed to fetch JWKS: {e}")
        
        # Find the key with matching kid
        available_kids = [key.get('kid') for key in self.jwks_client.get('keys', [])]
        logger.info(f"🔍 Looking for kid '{kid}' in available kids: {available_kids}")
        
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
                
                logger.info(f"✅ Found matching public key for kid: {kid}")
                return pem
        
        logger.error(f"❌ Public key not found for kid: {kid}")
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