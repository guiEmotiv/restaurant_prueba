from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()

class Command(BaseCommand):
    help = 'Crea usuarios de prueba para el sistema de restaurante'

    def handle(self, *args, **options):
        with transaction.atomic():
            # Lista de usuarios a crear
            users_data = [
                {
                    'username': 'admin',
                    'password': 'admin123',
                    'email': 'admin@restaurant.com',
                    'first_name': 'Administrador',
                    'last_name': 'Sistema',
                    'role': 'admin'
                },
                {
                    'username': 'mesero1',
                    'password': 'mesero123',
                    'email': 'mesero1@restaurant.com',
                    'first_name': 'Carlos',
                    'last_name': 'Pérez',
                    'role': 'mesero'
                },
                {
                    'username': 'mesero2',
                    'password': 'mesero123',
                    'email': 'mesero2@restaurant.com',
                    'first_name': 'Ana',
                    'last_name': 'García',
                    'role': 'mesero'
                },
                {
                    'username': 'cocinero1',
                    'password': 'cocinero123',
                    'email': 'cocinero1@restaurant.com',
                    'first_name': 'Miguel',
                    'last_name': 'Rodríguez',
                    'role': 'cocinero'
                },
                {
                    'username': 'cocinero2',
                    'password': 'cocinero123',
                    'email': 'cocinero2@restaurant.com',
                    'first_name': 'Laura',
                    'last_name': 'Martínez',
                    'role': 'cocinero'
                }
            ]

            # Crear usuarios
            for user_data in users_data:
                username = user_data.pop('username')
                password = user_data.pop('password')
                
                # Verificar si el usuario ya existe
                if User.objects.filter(username=username).exists():
                    self.stdout.write(
                        self.style.WARNING(f'Usuario {username} ya existe, omitiendo...')
                    )
                    continue
                
                # Crear el usuario
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    **user_data
                )
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✅ Usuario creado: {username} ({user.get_role_display()}) - contraseña: {password}'
                    )
                )

            self.stdout.write(self.style.SUCCESS('\n🎉 Usuarios de prueba creados exitosamente!'))
            self.stdout.write('\nUsuarios disponibles:')
            self.stdout.write('👑 Administrador: admin / admin123')
            self.stdout.write('🍽️  Mesero 1: mesero1 / mesero123')
            self.stdout.write('🍽️  Mesero 2: mesero2 / mesero123')
            self.stdout.write('👨‍🍳 Cocinero 1: cocinero1 / cocinero123')
            self.stdout.write('👨‍🍳 Cocinero 2: cocinero2 / cocinero123')