"""
Django REST Framework Authentication for AWS Cognito
This integrates properly with DRF's authentication system
"""
import jwt
import requests
import json
from django.conf import settings
from rest_framework import authentication, exceptions
from .cognito_auth import CognitoUser
import logging

logger = logging.getLogger(__name__)


class CognitoJWTAuthentication(authentication.BaseAuthentication):
    """
    DRF Authentication class for AWS Cognito JWT tokens
    This integrates properly with Django REST Framework
    """
    
    def __init__(self):
        self.jwks_client = None
        self.user_pool_id = getattr(settings, 'COGNITO_USER_POOL_ID', '')
        self.app_client_id = getattr(settings, 'COGNITO_APP_CLIENT_ID', '')
        self.region = getattr(settings, 'AWS_DEFAULT_REGION', getattr(settings, 'AWS_REGION', 'us-west-2'))
        
    def authenticate(self, request):
        """
        Authenticate the request and return a two-tuple of (user, token).
        """
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not auth_header.startswith('Bearer '):
            return None  # No authentication attempted
            
        token = auth_header.split(' ')[1]
        
        try:
            user = self.verify_cognito_token(token)
            return (user, token)
        except Exception as e:
            logger.warning(f"Token verification failed: {e}")
            raise exceptions.AuthenticationFailed('Token de autenticación inválido.')
    
    def verify_cognito_token(self, token):
        """Verify JWT token from Cognito"""
        try:
            logger.info(f"🔍 Token verification config:")
            logger.info(f"  User Pool ID: {self.user_pool_id}")
            logger.info(f"  App Client ID: {self.app_client_id}")
            logger.info(f"  Region: {self.region}")
            
            if not self.user_pool_id or not self.app_client_id:
                raise ValueError(f"Missing Cognito configuration: pool_id={self.user_pool_id}, client_id={self.app_client_id}")
            
            # Decode token header to get kid
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get('kid')
            
            logger.info(f"🔍 Token header kid: {kid}")
            
            if not kid:
                raise ValueError("Token missing 'kid' in header")
            
            # Get public key from Cognito JWKS endpoint
            public_key = self.get_public_key(kid)
            
            issuer = f"https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}"
            
            # First decode without verification to check token structure
            unverified_payload = jwt.decode(token, options={"verify_signature": False})
            logger.info(f"🔍 Token payload claims: {list(unverified_payload.keys())}")
            
            # Check if token has 'aud' claim
            has_aud = 'aud' in unverified_payload
            logger.info(f"🔍 Token has 'aud' claim: {has_aud}")
            
            # Verify and decode the token with appropriate options
            logger.info(f"🔍 JWT verification with issuer: {issuer}")
            if has_aud:
                logger.info(f"🔍 JWT verification with audience: {self.app_client_id}")
                payload = jwt.decode(
                    token,
                    public_key,
                    algorithms=['RS256'],
                    audience=self.app_client_id,
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
                if token_client_id != self.app_client_id:
                    raise ValueError(f"Token client_id '{token_client_id}' does not match expected '{self.app_client_id}'")              
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
            raise exceptions.AuthenticationFailed("Token has expired")
        except jwt.InvalidTokenError as e:
            logger.warning(f"❌ Invalid token: {e}")
            raise exceptions.AuthenticationFailed(f"Invalid token: {e}")
        except Exception as e:
            logger.warning(f"❌ Token verification failed: {e}")
            logger.warning(f"❌ Full error details: {type(e).__name__}: {str(e)}")
            raise exceptions.AuthenticationFailed(f"Token verification failed: {e}")
    
    def get_public_key(self, kid):
        """Get public key from Cognito JWKS endpoint"""
        if not self.jwks_client:
            jwks_url = f"https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}/.well-known/jwks.json"
            
            logger.info(f"🔍 Fetching JWKS from: {jwks_url}")
            
            try:
                response = requests.get(jwks_url, timeout=10)
                response.raise_for_status()
                self.jwks_client = response.json()
                logger.info(f"✅ JWKS fetched successfully, {len(self.jwks_client.get('keys', []))} keys found")
            except requests.RequestException as e:
                logger.error(f"❌ Failed to fetch JWKS: {e}")
                raise exceptions.AuthenticationFailed(f"Failed to fetch JWKS: {e}")
        
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
        raise exceptions.AuthenticationFailed(f"Public key not found for kid: {kid}")

    def authenticate_header(self, request):
        """
        Return a string to be used as the value of the `WWW-Authenticate`
        header in a `401 Unauthenticated` response.
        """
        return 'Bearer'