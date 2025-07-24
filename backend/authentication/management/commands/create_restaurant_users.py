from django.core.management.base import BaseCommand
from django.db import transaction
from authentication.models import RestaurantUser


class Command(BaseCommand):
    help = 'Create restaurant users with different roles for testing and production'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-iam-users',
            action='store_true',
            help='Also create corresponding AWS IAM users (requires AWS CLI configured)',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🏪 Creating Restaurant Users...'))
        
        # Define users to create
        users_data = [
            {
                'username': 'admin',
                'email': 'admin@restaurante.com',
                'first_name': 'Administrador',
                'last_name': 'Sistema',
                'role': 'admin',
                'password': 'Admin123!',
                'is_superuser': True,
                'is_staff': True,
            },
            {
                'username': 'mesero1',
                'email': 'mesero1@restaurante.com',
                'first_name': 'Carlos',
                'last_name': 'Mesero',
                'role': 'mesero',
                'password': 'Mesero123!',
                'aws_iam_username': 'restaurant-mesero-carlos',
            },
            {
                'username': 'mesero2',
                'email': 'mesero2@restaurante.com',
                'first_name': 'Ana',
                'last_name': 'Mesera',
                'role': 'mesero',
                'password': 'Mesero123!',
                'aws_iam_username': 'restaurant-mesero-ana',
            },
            {
                'username': 'cajero1',
                'email': 'cajero1@restaurante.com',
                'first_name': 'Luis',
                'last_name': 'Cajero',
                'role': 'cajero',
                'password': 'Cajero123!',
                'aws_iam_username': 'restaurant-cajero-luis',
            },
            {
                'username': 'cajero2',
                'email': 'cajero2@restaurante.com',
                'first_name': 'Maria',
                'last_name': 'Cajera',
                'role': 'cajero',
                'password': 'Cajero123!',
                'aws_iam_username': 'restaurant-cajero-maria',
            }
        ]
        
        created_users = []
        
        for user_data in users_data:
            username = user_data['username']
            
            # Check if user already exists
            if RestaurantUser.objects.filter(username=username).exists():
                self.stdout.write(
                    self.style.WARNING(f'⚠️  User {username} already exists, skipping...')
                )
                continue
            
            # Create user
            password = user_data.pop('password')
            user = RestaurantUser.objects.create_user(**user_data)
            user.set_password(password)
            user.save()
            
            created_users.append({
                'user': user,
                'password': password
            })
            
            self.stdout.write(
                self.style.SUCCESS(f'✅ Created {user.get_role_display()}: {username}')
            )
        
        # Print summary
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('🎉 Restaurant Users Created Successfully!'))
        self.stdout.write('='*60)
        
        for user_info in created_users:
            user = user_info['user']
            password = user_info['password']
            
            self.stdout.write(f"\n🔐 {user.get_role_display().upper()}: {user.username}")
            self.stdout.write(f"   Password: {password}")
            self.stdout.write(f"   Email: {user.email}")
            self.stdout.write(f"   Role: {user.role}")
            if user.aws_iam_username:
                self.stdout.write(f"   AWS IAM: {user.aws_iam_username}")
            self.stdout.write(f"   Allowed Views: {', '.join(user.allowed_views)}")
        
        # Create IAM users if requested
        if options['create_iam_users']:
            self.create_aws_iam_users(created_users)
        
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('Ready to test role-based authentication! 🚀'))
    
    def create_aws_iam_users(self, created_users):
        """Create AWS IAM users for restaurant staff"""
        import subprocess
        import json
        
        self.stdout.write('\n🔧 Creating AWS IAM Users...')
        
        # Define IAM policies for each role
        iam_policies = {
            'mesero': {
                'PolicyName': 'RestaurantMeseroPolicy',
                'PolicyDocument': {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Action": [
                                "dynamodb:GetItem",
                                "dynamodb:Query",
                                "dynamodb:UpdateItem",
                                "dynamodb:PutItem"
                            ],
                            "Resource": [
                                "arn:aws:dynamodb:*:*:table/restaurant-orders*",
                                "arn:aws:dynamodb:*:*:table/restaurant-recipes*"
                            ]
                        }
                    ]
                }
            },
            'cajero': {
                'PolicyName': 'RestaurantCajeroPolicy',
                'PolicyDocument': {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Action": [
                                "dynamodb:GetItem",
                                "dynamodb:Query",
                                "dynamodb:UpdateItem",
                                "dynamodb:PutItem"
                            ],
                            "Resource": [
                                "arn:aws:dynamodb:*:*:table/restaurant-payments*",
                                "arn:aws:dynamodb:*:*:table/restaurant-orders*"
                            ]
                        }
                    ]
                }
            }
        }
        
        for user_info in created_users:
            user = user_info['user']
            
            if not user.aws_iam_username or user.role == 'admin':
                continue
            
            try:
                # Create IAM user
                self.stdout.write(f"Creating IAM user: {user.aws_iam_username}")
                subprocess.run([
                    'aws', 'iam', 'create-user',
                    '--user-name', user.aws_iam_username,
                    '--tags', f'Key=Role,Value={user.role}',
                    f'Key=RestaurantApp,Value=true'
                ], check=True, capture_output=True)
                
                # Create and attach policy
                if user.role in iam_policies:
                    policy_data = iam_policies[user.role]
                    policy_document = json.dumps(policy_data['PolicyDocument'])
                    
                    # Create policy
                    policy_name = f"{user.aws_iam_username}-policy"
                    subprocess.run([
                        'aws', 'iam', 'create-policy',
                        '--policy-name', policy_name,
                        '--policy-document', policy_document
                    ], check=True, capture_output=True)
                    
                    # Attach policy to user
                    subprocess.run([
                        'aws', 'iam', 'attach-user-policy',
                        '--user-name', user.aws_iam_username,
                        '--policy-arn', f'arn:aws:iam::ACCOUNT:policy/{policy_name}'
                    ], check=True, capture_output=True)
                
                # Create access key
                result = subprocess.run([
                    'aws', 'iam', 'create-access-key',
                    '--user-name', user.aws_iam_username
                ], check=True, capture_output=True, text=True)
                
                access_key_data = json.loads(result.stdout)
                access_key = access_key_data['AccessKey']
                
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Created IAM user: {user.aws_iam_username}')
                )
                self.stdout.write(f"   Access Key: {access_key['AccessKeyId']}")
                self.stdout.write(f"   Secret Key: {access_key['SecretAccessKey']}")
                
            except subprocess.CalledProcessError as e:
                self.stdout.write(
                    self.style.ERROR(f'❌ Failed to create IAM user {user.aws_iam_username}: {e}')
                )
            except FileNotFoundError:
                self.stdout.write(
                    self.style.ERROR('❌ AWS CLI not found. Please install and configure AWS CLI.')
                )
                break