"""
AWS IAM Dynamic Authentication System
Authenticates users directly against AWS IAM without hardcoded users
Automatically detects users from AWS IAM groups
"""

import boto3
import json
import hashlib
import logging
import os
import re
from typing import Dict, Optional, Tuple, List
from datetime import datetime, timedelta
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework.authtoken.models import Token
from botocore.exceptions import ClientError, NoCredentialsError

logger = logging.getLogger(__name__)

class AWSIAMAuthenticator:
    """
    Dynamic AWS IAM authenticator that discovers users from AWS IAM groups
    No hardcoded users - all configuration is dynamic based on AWS IAM
    """
    
    def __init__(self):
        self.aws_region = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
        self.cache_timeout = 300  # 5 minutes
        self._user_cache = {}
        self._groups_cache = {}
        
    def _get_iam_client(self):
        """Get IAM client for administrative operations"""
        try:
            return boto3.client('iam', region_name=self.aws_region)
        except Exception as e:
            logger.error(f"Failed to create IAM client: {e}")
            return None
    
    def _get_restaurant_groups(self) -> Dict[str, Dict]:
        """Get all restaurant groups from AWS IAM"""
        cache_key = 'restaurant_groups'
        cached_groups = cache.get(cache_key)
        
        if cached_groups:
            return cached_groups
        
        iam_client = self._get_iam_client()
        if not iam_client:
            return {}
        
        restaurant_groups = {}
        
        try:
            # Get all groups with restaurant prefix
            paginator = iam_client.get_paginator('list_groups')
            
            for page in paginator.paginate():
                for group in page['Groups']:
                    group_name = group['GroupName']
                    
                    # Only process restaurant groups
                    if group_name.startswith('restaurant-'):
                        role = self._extract_role_from_group(group_name)
                        restaurant_groups[group_name] = {
                            'role': role,
                            'permissions': self._get_role_permissions(role),
                            'group_path': group.get('Path', '/'),
                            'created_date': group.get('CreateDate')
                        }
            
            # Cache the results
            cache.set(cache_key, restaurant_groups, self.cache_timeout)
            logger.info(f"Found {len(restaurant_groups)} restaurant groups")
            
        except ClientError as e:
            logger.error(f"Error fetching restaurant groups: {e}")
        
        return restaurant_groups
    
    def _extract_role_from_group(self, group_name: str) -> str:
        """Extract role from group name"""
        # restaurant-administrators -> admin
        # restaurant-cocineros -> cocinero
        # restaurant-cajeros -> cajero
        role_mapping = {
            'administrators': 'admin',
            'cocineros': 'cocinero',
            'cajeros': 'cajero',
            'meseros': 'mesero'
        }
        
        for key, role in role_mapping.items():
            if key in group_name:
                return role
        
        # Default role extraction (remove restaurant- prefix)
        return group_name.replace('restaurant-', '').rstrip('s')
    
    def _get_role_permissions(self, role: str) -> Dict:
        """Get permissions for a role"""
        role_permissions = {
            'admin': {
                'allowed_views': [
                    'dashboard', 'categories', 'units', 'zones', 'tables',
                    'groups', 'ingredients', 'recipes', 'orders', 'kitchen',
                    'payments', 'payment-history'
                ],
                'allowed_api_endpoints': ['*'],
                'display_name': 'Administrador'
            },
            'cocinero': {
                'allowed_views': ['kitchen', 'orders', 'recipes', 'ingredients'],
                'allowed_api_endpoints': ['order', 'recipe', 'ingredient'],
                'display_name': 'Cocinero'
            },
            'cajero': {
                'allowed_views': ['orders', 'payments', 'payment-history'],
                'allowed_api_endpoints': ['order', 'payment'],
                'display_name': 'Cajero'
            },
            'mesero': {
                'allowed_views': ['orders', 'tables', 'recipes'],
                'allowed_api_endpoints': ['order', 'table', 'recipe'],
                'display_name': 'Mesero'
            }
        }
        
        return role_permissions.get(role, {
            'allowed_views': ['dashboard'],
            'allowed_api_endpoints': [],
            'display_name': role.title()
        })
    
    def _get_all_restaurant_users(self) -> Dict[str, Dict]:
        """Get all users from restaurant groups"""
        cache_key = 'restaurant_users'
        cached_users = cache.get(cache_key)
        
        if cached_users:
            return cached_users
        
        iam_client = self._get_iam_client()
        if not iam_client:
            return {}
        
        restaurant_users = {}
        restaurant_groups = self._get_restaurant_groups()
        
        try:
            for group_name, group_info in restaurant_groups.items():
                # Get users in this group
                group_users = iam_client.get_group(GroupName=group_name)
                
                for user in group_users['Users']:
                    username = user['UserName']
                    role = group_info['role']
                    permissions = group_info['permissions']
                    
                    # Get user's access keys
                    access_keys = iam_client.list_access_keys(UserName=username)
                    access_key_id = None
                    
                    if access_keys['AccessKeyMetadata']:
                        access_key_id = access_keys['AccessKeyMetadata'][0]['AccessKeyId']
                    
                    restaurant_users[username] = {
                        'username': username,
                        'role': role,
                        'group_name': group_name,
                        'first_name': self._extract_first_name(username),
                        'last_name': permissions.get('display_name', role.title()),
                        'email': f"{username}@restaurant.com",
                        'access_key_id': access_key_id,
                        'allowed_views': permissions.get('allowed_views', []),
                        'allowed_api_endpoints': permissions.get('allowed_api_endpoints', []),
                        'is_active': True,
                        'user_path': user.get('Path', '/'),
                        'created_date': user.get('CreateDate')
                    }
            
            # Cache the results
            cache.set(cache_key, restaurant_users, self.cache_timeout)
            logger.info(f"Found {len(restaurant_users)} restaurant users")
            
        except ClientError as e:
            logger.error(f"Error fetching restaurant users: {e}")
        
        return restaurant_users
    
    def _extract_first_name(self, username: str) -> str:
        """Extract a readable first name from username"""
        # admin -> Admin
        # cocinero1 -> Cocinero 1
        # cajero1 -> Cajero 1
        
        if username == 'admin':
            return 'Administrador'
        
        # Extract role and number
        match = re.match(r'([a-zA-Z]+)(\d*)', username)
        if match:
            role = match.group(1)
            number = match.group(2)
            
            role_names = {
                'cocinero': 'Cocinero',
                'cajero': 'Cajero',
                'mesero': 'Mesero',
                'admin': 'Admin'
            }
            
            base_name = role_names.get(role, role.title())
            if number:
                return f"{base_name} {number}"
            return base_name
        
        return username.title()
    
    def _get_user_credentials_from_env(self, username: str) -> Tuple[Optional[str], Optional[str]]:
        """Get user credentials from environment variables"""
        # Convert username to env var format: admin -> AWS_ACCESS_KEY_ID_ADMIN
        env_username = username.upper()
        
        access_key = os.getenv(f'AWS_ACCESS_KEY_ID_{env_username}')
        secret_key = os.getenv(f'AWS_SECRET_ACCESS_KEY_{env_username}')
        
        return access_key, secret_key
    
    def authenticate_user(self, username: str, password: str) -> Tuple[bool, Optional[Dict]]:
        """
        Authenticate user against AWS IAM
        Supports both direct AWS credentials and username/password lookup
        """
        try:
            # Method 1: Direct AWS credentials (access_key, secret_key)
            if username.startswith('AKIA') and len(username) == 20:
                return self._authenticate_with_aws_credentials(username, password)
            
            # Method 2: Username lookup from environment variables
            access_key, secret_key = self._get_user_credentials_from_env(username)
            if access_key and secret_key == password:
                return self._authenticate_with_aws_credentials(access_key, secret_key)
            
            # Method 3: Try to find user in AWS IAM and match credentials
            restaurant_users = self._get_all_restaurant_users()
            
            if username in restaurant_users:
                user_info = restaurant_users[username]
                access_key_id = user_info.get('access_key_id')
                
                if access_key_id:
                    # Try to authenticate with this access key
                    return self._authenticate_with_aws_credentials(access_key_id, password)
            
            logger.warning(f"Authentication failed for username: {username}")
            return False, None
            
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return False, None
    
    def _authenticate_with_aws_credentials(self, access_key: str, secret_key: str) -> Tuple[bool, Optional[Dict]]:
        """Authenticate using AWS access key and secret key"""
        try:
            # Test AWS credentials by making a simple API call
            session = boto3.Session(
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=self.aws_region
            )
            
            sts_client = session.client('sts')
            caller_identity = sts_client.get_caller_identity()
            
            # Get username from ARN
            arn = caller_identity.get('Arn', '')
            username = arn.split('/')[-1] if '/' in arn else 'unknown'
            
            # Get user info from our restaurant users
            restaurant_users = self._get_all_restaurant_users()
            user_info = restaurant_users.get(username)
            
            if not user_info:
                # Create basic user info if not found in groups
                user_info = {
                    'username': username,
                    'role': 'user',
                    'first_name': self._extract_first_name(username),
                    'last_name': 'Usuario',
                    'email': f"{username}@restaurant.com",
                    'allowed_views': ['dashboard'],
                    'allowed_api_endpoints': [],
                    'is_active': True
                }
            
            # Add runtime info
            user_info.update({
                'id': hashlib.md5(username.encode()).hexdigest()[:8],
                'last_activity': timezone.now().isoformat(),
                'is_active_session': True,
                'aws_access_key_id': access_key
            })
            
            logger.info(f"Successfully authenticated AWS IAM user: {username}")
            return True, user_info
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            if error_code in ['InvalidUserID.NotFound', 'SigninFailure', 'InvalidArgument']:
                logger.warning(f"Invalid AWS credentials provided")
            else:
                logger.error(f"AWS authentication error: {e}")
            return False, None
        except Exception as e:
            logger.error(f"Unexpected authentication error: {e}")
            return False, None
    
    def get_or_create_token(self, user_info: Dict) -> str:
        """Generate or retrieve authentication token for user"""
        username = user_info['username']
        token_data = {
            'username': username,
            'role': user_info['role'],
            'access_key': user_info.get('aws_access_key_id', '')[:8] + '...',  # Partial key for security
            'created_at': timezone.now().isoformat()
        }
        
        # Create a unique token based on user info
        token_string = f"{username}:{user_info['role']}:{timezone.now().timestamp()}"
        token_hash = hashlib.sha256(token_string.encode()).hexdigest()[:32]
        
        # Cache the token with user info
        cache.set(f"aws_token:{token_hash}", user_info, 3600)  # 1 hour
        
        return token_hash
    
    def validate_token(self, token: str) -> Optional[Dict]:
        """Validate and return user info for token"""
        user_info = cache.get(f"aws_token:{token}")
        if user_info:
            # Update last activity
            user_info['last_activity'] = timezone.now().isoformat()
            user_info['is_active_session'] = True
            cache.set(f"aws_token:{token}", user_info, 3600)  # Extend cache
        
        return user_info
    
    def logout_user(self, token: str) -> bool:
        """Logout user by invalidating token"""
        cache.delete(f"aws_token:{token}")
        return True
    
    def get_all_available_users(self) -> List[Dict]:
        """Get all available restaurant users for display"""
        restaurant_users = self._get_all_restaurant_users()
        return list(restaurant_users.values())
    
    def get_password_reset_instructions(self) -> Dict:
        """Get instructions for password reset"""
        return {
            'title': 'Instrucciones para Resetear Contraseña AWS IAM',
            'steps': [
                '1. Accede a la consola de AWS IAM',
                '2. Ve a Users > [tu usuario]',
                '3. En la pestaña "Security credentials"',
                '4. Haz clic en "Create access key"',
                '5. Guarda el Access Key ID y Secret Access Key',
                '6. Usa estas credenciales para hacer login'
            ],
            'note': 'Las credenciales son gestionadas completamente por AWS IAM',
            'contact': 'Contacta al administrador del sistema para ayuda adicional'
        }

# Global authenticator instance
aws_authenticator = AWSIAMAuthenticator()