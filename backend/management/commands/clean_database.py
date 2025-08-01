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
        
        # Verificar qué tablas existen realmente
        cursor = connection.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        existing_tables = [row[0] for row in cursor.fetchall()]
        
        self.stdout.write(f"📋 Tablas encontradas: {', '.join(existing_tables)}")
        
        with transaction.atomic():
            cursor = connection.cursor()
            
            # Deshabilitar foreign keys
            cursor.execute('PRAGMA foreign_keys=OFF')
            
            # Solo limpiar tablas que existen
            tables_cleaned = 0
            for table in existing_tables:
                try:
                    # Saltar tablas del sistema Django
                    if table.startswith(('auth_', 'django_content_type', 'django_migrations')):
                        continue
                        
                    if table in ['table', 'group', 'order']:
                        cursor.execute(f'DELETE FROM "{table}"')
                    else:
                        cursor.execute(f'DELETE FROM {table}')
                    
                    # Verificar cuántos registros se eliminaron
                    cursor.execute(f'SELECT changes()')
                    deleted = cursor.fetchone()[0]
                    
                    if deleted > 0:
                        self.stdout.write(f'✅ {table}: {deleted} registros eliminados')
                        tables_cleaned += 1
                    else:
                        self.stdout.write(f'ℹ️  {table}: ya estaba vacía')
                        
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
            self.style.SUCCESS(f'🎯 ¡Base de datos limpiada! {tables_cleaned} tablas procesadas.')
        )