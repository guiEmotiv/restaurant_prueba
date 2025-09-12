"""
Management command to create restaurant staff users
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group


class Command(BaseCommand):
    help = 'Create restaurant staff users with predefined credentials'

    def handle(self, *args, **options):
        """
        Create restaurant staff users with their specific roles
        """
        
        # Define restaurant staff users
        restaurant_users = [
            {
                'username': 'fernando',
                'password': 'Theboss01@!',
                'email': 'fernando@restaurant.com',
                'first_name': 'Fernando',
                'last_name': '',
                'role': 'Administradores',
                'is_staff': True,
                'is_superuser': True,
                'description': 'Administrador principal del restaurante'
            },
            {
                'username': 'brayan',
                'password': 'Mesero010@!',
                'email': 'brayan@restaurant.com',
                'first_name': 'Brayan',
                'last_name': '',
                'role': 'Meseros',
                'is_staff': False,
                'is_superuser': False,
                'description': 'Mesero - Atención al cliente y gestión de mesas'
            },
            {
                'username': 'keyla',
                'password': 'Mesero012@!',
                'email': 'keyla@restaurant.com',
                'first_name': 'Keyla',
                'last_name': '',
                'role': 'Meseros',
                'is_staff': False,
                'is_superuser': False,
                'description': 'Mesero - Atención al cliente y gestión de mesas'
            },
            {
                'username': 'enrique',
                'password': 'Mesero013@!',
                'email': 'enrique@restaurant.com',
                'first_name': 'Enrique',
                'last_name': '',
                'role': 'Meseros',
                'is_staff': False,
                'is_superuser': False,
                'description': 'Mesero - Atención al cliente y gestión de mesas'
            },
            {
                'username': 'andy',
                'password': 'Mesero014@!',
                'email': 'andy@restaurant.com',
                'first_name': 'Andy',
                'last_name': '',
                'role': 'Meseros',
                'is_staff': False,
                'is_superuser': False,
                'description': 'Mesero - Atención al cliente y gestión de mesas'
            },
            {
                'username': 'rodrigo',
                'password': 'Cusicusa02@!',
                'email': 'rodrigo@restaurant.com',
                'first_name': 'Rodrigo',
                'last_name': '',
                'role': 'Cocineros',
                'is_staff': False,
                'is_superuser': False,
                'description': 'Cocinero - Preparación de alimentos y gestión de cocina'
            }
        ]

        created_users = 0
        existing_users = 0

        for user_data in restaurant_users:
            username = user_data['username']
            
            # Check if user already exists
            if User.objects.filter(username=username).exists():
                existing_users += 1
                self.stdout.write(
                    self.style.WARNING(f'⚠️  Usuario ya existe: {username}')
                )
                continue

            # Create the user
            user = User.objects.create_user(
                username=username,
                email=user_data['email'],
                password=user_data['password'],
                first_name=user_data['first_name'],
                last_name=user_data['last_name']
            )

            # Set staff and superuser status
            user.is_staff = user_data['is_staff']
            user.is_superuser = user_data['is_superuser']
            user.save()

            # Add to the appropriate group
            try:
                group = Group.objects.get(name=user_data['role'])
                user.groups.add(group)
                
                created_users += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✅ Usuario creado: {username} ({user_data["role"]})'
                    )
                )
                self.stdout.write(f'   📧 Email: {user_data["email"]}')
                self.stdout.write(f'   🔑 Contraseña: {user_data["password"]}')
                self.stdout.write(f'   📝 {user_data["description"]}')
                self.stdout.write('')
                
            except Group.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(
                        f'❌ Grupo no encontrado: {user_data["role"]} para usuario {username}'
                    )
                )
                user.delete()  # Remove user if group doesn't exist

        # Summary
        self.stdout.write(
            self.style.SUCCESS(
                f'\n🎉 Usuarios del restaurante configurados!'
            )
        )
        self.stdout.write(f'   ➕ Creados: {created_users} usuarios')
        self.stdout.write(f'   ℹ️  Existentes: {existing_users} usuarios')
        self.stdout.write(f'   📊 Total: {User.objects.count()} usuarios en el sistema')
        
        # Show login instructions
        self.stdout.write(
            self.style.HTTP_INFO(
                f'\n🔐 Instrucciones de Login:'
            )
        )
        self.stdout.write('   🌐 Frontend: http://localhost:5173')
        self.stdout.write('   🛠️  Admin Panel: http://localhost:8000/admin')
        self.stdout.write('')
        self.stdout.write('   👥 Usuarios creados:')
        for user_data in restaurant_users:
            role_emoji = {
                'Administradores': '🔧',
                'Meseros': '🍽️',
                'Cocineros': '👨‍🍳',
                'Cajeros': '💰',
                'Gerentes': '👔'
            }.get(user_data['role'], '👤')
            
            self.stdout.write(
                f'      {role_emoji} {user_data["username"]} / {user_data["password"]} ({user_data["role"]})'
            )
        
        self.stdout.write(
            self.style.WARNING(
                f'\n⚠️  Nota: En producción, cambiar todas las contraseñas por seguridad!'
            )
        )