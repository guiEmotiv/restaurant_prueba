#!/usr/bin/env python3
"""
Comando para verificar que la base de datos esté completamente vacía
después de una operación de limpieza.

Uso:
    python manage.py verify_empty_db
"""

from django.core.management.base import BaseCommand
from django.apps import apps
from django.db import connection


class Command(BaseCommand):
    help = 'Verifica que la base de datos esté completamente vacía'

    def handle(self, *args, **options):
        self.stdout.write("🔍 Verificando estado de la base de datos...")
        
        # Verificar tablas vacías
        empty_tables, non_empty_tables = self.check_tables()
        
        # Verificar contadores reiniciados
        reset_counters, non_reset_counters = self.check_id_counters()
        
        # Mostrar resultados
        self.show_results(empty_tables, non_empty_tables, reset_counters, non_reset_counters)
        
        # Conclusión
        if non_empty_tables or non_reset_counters:
            self.stdout.write(
                self.style.ERROR(
                    "\n❌ La base de datos NO está completamente limpia"
                )
            )
            return False
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    "\n✅ La base de datos está completamente vacía y limpia"
                )
            )
            return True

    def check_tables(self):
        """Verificar que todas las tablas estén vacías"""
        empty_tables = []
        non_empty_tables = []
        
        # Obtener todos los modelos de nuestras apps
        our_apps = ['config', 'inventory', 'operation']
        
        for app_name in our_apps:
            try:
                app = apps.get_app_config(app_name)
                for model in app.get_models():
                    count = model.objects.count()
                    table_info = {
                        'model': model.__name__,
                        'table': model._meta.db_table,
                        'count': count,
                        'app': app_name
                    }
                    
                    if count == 0:
                        empty_tables.append(table_info)
                    else:
                        non_empty_tables.append(table_info)
                        
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"❌ Error verificando app {app_name}: {str(e)}")
                )
        
        return empty_tables, non_empty_tables

    def check_id_counters(self):
        """Verificar que los contadores de ID estén reiniciados"""
        reset_counters = []
        non_reset_counters = []
        
        with connection.cursor() as cursor:
            try:
                # Obtener información de sqlite_sequence
                cursor.execute("SELECT name, seq FROM sqlite_sequence;")
                sequences = cursor.fetchall()
                
                for table_name, seq_value in sequences:
                    counter_info = {
                        'table': table_name,
                        'sequence': seq_value
                    }
                    
                    if seq_value == 0:
                        reset_counters.append(counter_info)
                    else:
                        non_reset_counters.append(counter_info)
                        
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f"⚠️  Error verificando secuencias: {str(e)}")
                )
        
        return reset_counters, non_reset_counters

    def show_results(self, empty_tables, non_empty_tables, reset_counters, non_reset_counters):
        """Mostrar resultados de la verificación"""
        
        # Mostrar tablas vacías
        if empty_tables:
            self.stdout.write(
                self.style.SUCCESS(f"\n✅ Tablas vacías ({len(empty_tables)}):")
            )
            for table in empty_tables:
                self.stdout.write(f"   ✓ {table['app']}.{table['model']} ({table['table']})")
        
        # Mostrar tablas con datos
        if non_empty_tables:
            self.stdout.write(
                self.style.ERROR(f"\n❌ Tablas con datos ({len(non_empty_tables)}):")
            )
            for table in non_empty_tables:
                self.stdout.write(
                    f"   ✗ {table['app']}.{table['model']} ({table['table']}): {table['count']} registros"
                )
        
        # Mostrar contadores reiniciados
        if reset_counters:
            self.stdout.write(
                self.style.SUCCESS(f"\n✅ Contadores reiniciados ({len(reset_counters)}):")
            )
            for counter in reset_counters:
                self.stdout.write(f"   ✓ {counter['table']}: {counter['sequence']}")
        
        # Mostrar contadores no reiniciados
        if non_reset_counters:
            self.stdout.write(
                self.style.ERROR(f"\n❌ Contadores NO reiniciados ({len(non_reset_counters)}):")
            )
            for counter in non_reset_counters:
                self.stdout.write(f"   ✗ {counter['table']}: {counter['sequence']}")

    def get_database_size(self):
        """Obtener el tamaño de la base de datos"""
        from django.conf import settings
        import os
        
        try:
            db_path = settings.DATABASES['default']['NAME']
            if os.path.exists(db_path):
                size_bytes = os.path.getsize(db_path)
                size_mb = size_bytes / (1024 * 1024)
                return size_mb
            else:
                return 0
        except Exception:
            return None