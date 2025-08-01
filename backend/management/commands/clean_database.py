"""
Management command para limpiar completamente la base de datos
Uso: python3 manage.py clean_database
"""
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.apps import apps


class Command(BaseCommand):
    help = 'Limpia completamente la base de datos y reinicia contadores'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirma la eliminación sin preguntar',
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            confirm = input(
                "⚠️  ADVERTENCIA: Esto eliminará TODOS los datos de la base de datos.\n"
                "¿Estás seguro? Escribe 'CONFIRMAR' para continuar: "
            )
            if confirm != 'CONFIRMAR':
                self.stdout.write(self.style.ERROR('❌ Operación cancelada'))
                return

        self.stdout.write("🗑️ Limpiando base de datos...")
        
        with transaction.atomic():
            cursor = connection.cursor()
            
            # Deshabilitar foreign keys
            cursor.execute('PRAGMA foreign_keys=OFF')
            
            # Obtener todas las tablas de la aplicación
            app_tables = [
                # Operación
                'payment_item', 'container_sale', 'payment', 
                'order_item_ingredient', 'order_item', 'order',
                
                # Inventario  
                'recipe_item', 'recipe', 'ingredient', 'group',
                
                # Configuración
                'container', 'waiter', 'table', 'zone', 'unit',
                'restaurant_operational_config',
                
                # Sistema Django (opcional)
                'django_session', 'authtoken_token', 'django_admin_log'
            ]
            
            # Limpiar tablas
            for table in app_tables:
                try:
                    if table in ['table', 'group', 'order']:
                        cursor.execute(f'DELETE FROM "{table}"')
                    else:
                        cursor.execute(f'DELETE FROM {table}')
                    self.stdout.write(f'✅ Limpiado: {table}')
                except Exception as e:
                    self.stdout.write(f'⚠️  Error limpiando {table}: {e}')
            
            # Reiniciar secuencias de SQLite
            try:
                cursor.execute('DELETE FROM sqlite_sequence')
                self.stdout.write('✅ Contadores de ID reiniciados')
            except Exception as e:
                self.stdout.write(f'⚠️  Error reiniciando contadores: {e}')
            
            # Rehabilitar foreign keys
            cursor.execute('PRAGMA foreign_keys=ON')
        
        self.stdout.write(
            self.style.SUCCESS('🎯 ¡Base de datos limpiada completamente!')
        )