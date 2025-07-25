"""
AWS IAM Authentication System
Authenticates users directly against AWS IAM without database dependency
"""

import boto3
import json
import hashlib
import logging
import os
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework.authtoken.models import Token
from botocore.exceptions import ClientError, NoCredentialsError

logger = logging.getLogger(__name__)

class AWSIAMAuthenticator:
    """
    Authenticates users against AWS IAM using access keys
    Maps IAM users to application roles and permissions
    """
    
    # Simple username to AWS credentials mapping
    # AWS credentials are loaded from environment variables for security
    def _get_simple_user_mapping(self):
        return {
            # Admin user
            'admin': {
                'aws_access_key': os.getenv('AWS_ACCESS_KEY_ID_ADMIN_SYSTEM'),
                'aws_secret_key': os.getenv('AWS_SECRET_ACCESS_KEY_ADMIN_SYSTEM'),
                'aws_username': 'restaurant-admin-system',
                'role': 'admin',
                'first_name': 'Administrador',
                'last_name': 'Sistema',
                'email': 'admin@restaurant.com',
                'allowed_views': [
                    'dashboard', 'categories', 'units', 'zones', 'tables',
                    'groups', 'ingredients', 'recipes', 'orders', 'kitchen',
                    'payments', 'payment-history'
                ],
                'allowed_api_endpoints': ['*']
            },
            # Mesero users
            'mesero1': {
                'aws_access_key': os.getenv('AWS_ACCESS_KEY_ID_MESERO_CARLOS'),
                'aws_secret_key': os.getenv('AWS_SECRET_ACCESS_KEY_MESERO_CARLOS'),
                'aws_username': 'restaurant-mesero-carlos',
                'role': 'mesero',
                'first_name': 'Carlos',
                'last_name': 'Mesero',
                'email': 'mesero1@restaurant.com',
                'allowed_views': ['orders', 'kitchen'],
                'allowed_api_endpoints': [
                    'orders', 'order-items', 'order-item-ingredients',
                    'recipes', 'ingredients', 'tables'
                ]
            },
            'mesero2': {
                'aws_access_key': os.getenv('AWS_ACCESS_KEY_ID_MESERO_ANA'),
                'aws_secret_key': os.getenv('AWS_SECRET_ACCESS_KEY_MESERO_ANA'),
                'aws_username': 'restaurant-mesero-ana',
                'role': 'mesero',
                'first_name': 'Ana',
                'last_name': 'Mesero',
                'email': 'mesero2@restaurant.com',
                'allowed_views': ['orders', 'kitchen'],
                'allowed_api_endpoints': [
                    'orders', 'order-items', 'order-item-ingredients',
                    'recipes', 'ingredients', 'tables'
                ]
            },
            # Cocinero users
            'cocinero1': {
                'aws_access_key': os.getenv('AWS_ACCESS_KEY_ID_COCINERO_MIGUEL'),
                'aws_secret_key': os.getenv('AWS_SECRET_ACCESS_KEY_COCINERO_MIGUEL'),
                'aws_username': 'restaurant-cocinero-miguel',
                'role': 'cocinero',
                'first_name': 'Miguel',
                'last_name': 'Cocinero',
                'email': 'cocinero1@restaurant.com',
                'allowed_views': ['kitchen', 'orders'],
                'allowed_api_endpoints': ['orders', 'order-items', 'recipes', 'ingredients']
            },
            'cocinero2': {
                'aws_access_key': os.getenv('AWS_ACCESS_KEY_ID_COCINERO_MIGUEL'),  # Using same AWS user
                'aws_secret_key': os.getenv('AWS_SECRET_ACCESS_KEY_COCINERO_MIGUEL'),
                'aws_username': 'restaurant-cocinero-miguel',
                'role': 'cocinero',
                'first_name': 'Luis',
                'last_name': 'Cocinero',
                'email': 'cocinero2@restaurant.com',
                'allowed_views': ['kitchen', 'orders'],
                'allowed_api_endpoints': ['orders', 'order-items', 'recipes', 'ingredients']
            },
            # Cajero users
            'cajero1': {
                'aws_access_key': os.getenv('AWS_ACCESS_KEY_ID_CAJERO_LUIS'),
                'aws_secret_key': os.getenv('AWS_SECRET_ACCESS_KEY_CAJERO_LUIS'),
                'aws_username': 'restaurant-cajero-luis',
                'role': 'cajero',
                'first_name': 'Luis',
                'last_name': 'Cajero',
                'email': 'cajero1@restaurant.com',
                'allowed_views': ['payments', 'payment-history'],
                'allowed_api_endpoints': ['payments', 'orders']
            },
            'cajero2': {
                'aws_access_key': os.getenv('AWS_ACCESS_KEY_ID_CAJERO_MARIA'),
                'aws_secret_key': os.getenv('AWS_SECRET_ACCESS_KEY_CAJERO_MARIA'),
                'aws_username': 'restaurant-cajero-maria',
                'role': 'cajero',
                'first_name': 'María',
                'last_name': 'Cajero',
                'email': 'cajero2@restaurant.com',
                'allowed_views': ['payments', 'payment-history'],
                'allowed_api_endpoints': ['payments', 'orders']
            }
        }
    
    @property
    def SIMPLE_USER_MAPPING(self):
        if not hasattr(self, '_simple_user_mapping'):
            self._simple_user_mapping = self._get_simple_user_mapping()
        return self._simple_user_mapping
    
    # Keep backward compatibility with IAM username mapping
    @property
    def ROLE_MAPPING(self):
        if not hasattr(self, '_role_mapping'):
            mapping = self.SIMPLE_USER_MAPPING
            self._role_mapping = {
                'restaurant-admin-system': mapping['admin'],
                'restaurant-mesero-carlos': mapping['mesero1'],
                'restaurant-mesero-ana': mapping['mesero2'],
                'restaurant-cocinero-miguel': mapping['cocinero1'],
                'restaurant-cajero-luis': mapping['cajero1'],
                'restaurant-cajero-maria': mapping['cajero2']
            }
        return self._role_mapping
    
    def __init__(self):
        self.region = getattr(settings, 'AWS_DEFAULT_REGION', 'us-east-1')
        
    def authenticate_with_aws(self, access_key: str, secret_key: str) -> Tuple[bool, Optional[Dict]]:
        """
        Authenticate user credentials against AWS IAM
        Returns (success, user_info)
        """
        try:
            # Create IAM client with provided credentials
            iam_client = boto3.client(
                'iam',
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=self.region
            )
            
            # Try to get current user - this validates credentials
            response = iam_client.get_user()
            username = response['User']['UserName']
            user_arn = response['User']['Arn']
            
            logger.info(f"AWS IAM authentication successful for user: {username}")
            
            # Get user info from our role mapping
            user_info = self.ROLE_MAPPING.get(username)
            if not user_info:
                logger.warning(f"User {username} not found in role mapping")
                return False, None
                
            # Add AWS metadata
            user_info.update({
                'username': username,
                'aws_user_arn': user_arn,
                'aws_access_key': access_key,
                'id': self._generate_user_id(username),
                'is_active': True,
                'last_activity': timezone.now().isoformat(),
                'is_active_session': True
            })
            
            return True, user_info
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code in ['InvalidUserID.NotFound', 'AccessDenied']:
                logger.warning(f"Invalid AWS credentials: {error_code}")
            else:
                logger.error(f"AWS IAM authentication error: {error_code}")
            return False, None
            
        except NoCredentialsError:
            logger.warning("No AWS credentials provided")
            return False, None
            
        except Exception as e:
            logger.error(f"Unexpected AWS authentication error: {str(e)}")
            return False, None
    
    def authenticate_user(self, username: str, password: str) -> Tuple[bool, Optional[Dict]]:
        """
        Main authentication method
        Supports both simple usernames and direct AWS keys
        """
        # Check if username is a simple username
        if username in self.SIMPLE_USER_MAPPING:
            simple_user = self.SIMPLE_USER_MAPPING[username]
            
            # For simple users, password should be 'simple123'
            if password == 'simple123':
                # Use the mapped AWS credentials
                access_key = simple_user['aws_access_key']
                secret_key = simple_user['aws_secret_key']
                
                if not access_key or not secret_key:
                    logger.error(f"Missing AWS credentials for simple user: {username}")
                    return False, None
                
                # Check cache first
                cache_key = f"aws_auth_simple_{hashlib.md5(username.encode()).hexdigest()}"
                cached_result = cache.get(cache_key)
                
                if cached_result:
                    logger.info(f"Using cached simple user authentication for: {username}")
                    return True, cached_result
                
                # Authenticate against AWS with mapped credentials
                success, user_info = self.authenticate_with_aws(access_key, secret_key)
                
                if success and user_info:
                    # Override with simple username for consistency
                    user_info['username'] = username
                    user_info['display_username'] = username
                    user_info.update(simple_user)
                    
                    # Cache successful authentication for 15 minutes
                    cache.set(cache_key, user_info, 900)
                    
                return success, user_info
            else:
                logger.warning(f"Invalid password for simple user: {username}")
                return False, None
        
        # If not a simple username, treat as direct AWS credentials
        access_key = username
        secret_key = password
        
        # Check cache first to avoid unnecessary AWS calls
        cache_key = f"aws_auth_{hashlib.md5(access_key.encode()).hexdigest()}"
        cached_result = cache.get(cache_key)
        
        if cached_result:
            logger.info("Using cached AWS authentication result")
            return True, cached_result
        
        # Authenticate against AWS
        success, user_info = self.authenticate_with_aws(access_key, secret_key)
        
        if success and user_info:
            # Cache successful authentication for 15 minutes
            cache.set(cache_key, user_info, 900)
            
        return success, user_info
    
    def get_or_create_token(self, user_info: Dict) -> str:
        """
        Create authentication token for AWS IAM user
        Uses a hash of AWS access key as consistent token
        """
        # Create a consistent token based on AWS access key
        token_seed = f"{user_info['aws_access_key']}{user_info['username']}"
        token_hash = hashlib.sha256(token_seed.encode()).hexdigest()[:40]
        
        # Store token info in cache
        token_cache_key = f"aws_token_{token_hash}"
        cache.set(token_cache_key, user_info, 3600)  # 1 hour
        
        return token_hash
    
    def validate_token(self, token: str) -> Optional[Dict]:
        """
        Validate authentication token and return user info
        """
        token_cache_key = f"aws_token_{token}"
        user_info = cache.get(token_cache_key)
        
        if user_info:
            # Update last activity
            user_info['last_activity'] = timezone.now().isoformat()
            cache.set(token_cache_key, user_info, 3600)
            
        return user_info
    
    def logout_user(self, token: str) -> bool:
        """
        Logout user by invalidating token
        """
        token_cache_key = f"aws_token_{token}"
        cache.delete(token_cache_key)
        return True
    
    def reset_simple_password(self, username: str, new_password: str = "simple123") -> bool:
        """
        Reset password for simple username
        For AWS IAM, this is just updating the local mapping
        Real AWS credentials remain unchanged for security
        """
        if username not in self.SIMPLE_USER_MAPPING:
            return False
        
        # In a real implementation, you'd update a database
        # For now, we just clear any cached authentication
        cache_key = f"aws_auth_simple_{hashlib.md5(username.encode()).hexdigest()}"
        cache.delete(cache_key)
        
        logger.info(f"Password reset requested for user: {username}")
        return True
    
    def get_password_reset_instructions(self) -> str:
        """
        Return instructions for password reset
        """
        return """
        🔄 INSTRUCCIONES PARA RESETEAR CONTRASEÑA:
        
        Para usuarios simples (admin, mesero1, etc.):
        1. La contraseña siempre es: simple123
        2. Si olvidó su usuario, consulte la pantalla de login
        3. Contacte al administrador si persisten problemas
        
        Para usuarios con credenciales AWS directas:
        1. Vaya a la consola AWS IAM
        2. Seleccione su usuario
        3. Vaya a "Security credentials"
        4. Genere nuevas Access Keys
        5. Elimine las anteriores por seguridad
        
        📞 Soporte técnico: admin@restaurant.com
        """
    
    def _generate_user_id(self, username: str) -> int:
        """
        Generate consistent user ID from username
        """
        return abs(hash(username)) % 10000

# Global authenticator instance
aws_authenticator = AWSIAMAuthenticator()