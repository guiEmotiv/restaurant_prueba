#!/usr/bin/env python3
"""
Comando para limpiar completamente la base de datos de producción
y reiniciar todos los contadores de ID.

ADVERTENCIA: Este comando elimina TODOS los datos de la base de datos.
Solo usar en ambiente de producción con extrema precaución.

Uso:
    python manage.py reset_production_db --confirm

El flag --confirm es obligatorio para prevenir ejecución accidental.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.apps import apps
import os
import sys


class Command(BaseCommand):
    help = 'Elimina todos los datos de la BD de producción y reinicia contadores'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirmar que se desea eliminar TODOS los datos',
        )
        parser.add_argument(
            '--backup',
            action='store_true', 
            help='Crear backup antes de limpiar (recomendado)',
        )

    def handle(self, *args, **options):
        # Verificación de seguridad
        if not options['confirm']:
            raise CommandError(
                "⚠️  PELIGRO: Este comando elimina TODOS los datos.\n"
                "Use --confirm para confirmar la acción.\n"
                "Ejemplo: python manage.py reset_production_db --confirm"
            )

        # Verificar que estamos en producción
        debug_mode = os.getenv('DEBUG', '0').lower() in ('1', 'true', 'yes', 'on')
        if debug_mode:
            self.stdout.write(
                self.style.WARNING(
                    "⚠️  Parece que DEBUG=True. ¿Estás seguro de que estás en producción?"
                )
            )
            confirm = input("Escriba 'CONFIRMAR' para continuar: ")
            if confirm != 'CONFIRMAR':
                self.stdout.write(self.style.ERROR("❌ Operación cancelada"))
                return

        # Backup opcional
        if options['backup']:
            self.create_backup()

        # Confirmación final
        self.stdout.write(
            self.style.ERROR(
                "\n🚨 ÚLTIMA ADVERTENCIA 🚨\n"
                "Esto eliminará TODOS los datos de la base de datos:\n"
                "- Todas las mesas, zonas, unidades\n"
                "- Todos los ingredientes, recetas, grupos\n" 
                "- Todas las órdenes, pagos, items\n"
                "- Toda la configuración del restaurante\n"
                "- TODOS los datos históricos\n"
            )
        )
        
        final_confirm = input("\nEscriba 'ELIMINAR TODO' para proceder: ")
        if final_confirm != 'ELIMINAR TODO':
            self.stdout.write(self.style.ERROR("❌ Operación cancelada"))
            return

        try:
            self.reset_database()
            self.stdout.write(
                self.style.SUCCESS(
                    "\n✅ Base de datos limpiada exitosamente\n"
                    "✅ Contadores de ID reiniciados\n"
                    "ℹ️  La base de datos está ahora completamente vacía"
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Error durante la limpieza: {str(e)}")
            )
            raise

    def create_backup(self):
        """Crear backup de la base de datos SQLite"""
        from django.conf import settings
        import shutil
        from datetime import datetime
        
        db_path = settings.DATABASES['default']['NAME']
        backup_name = f"backup_before_reset_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sqlite3"
        backup_path = db_path.parent / backup_name
        
        try:
            shutil.copy2(db_path, backup_path)
            self.stdout.write(
                self.style.SUCCESS(f"✅ Backup creado: {backup_path}")
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Error creando backup: {str(e)}")
            )
            raise

    @transaction.atomic
    def reset_database(self):
        """Eliminar todos los datos y reiniciar contadores"""
        
        self.stdout.write("🔄 Iniciando limpieza de base de datos...")
        
        # Obtener todos los modelos en orden inverso de dependencias
        all_models = self.get_models_in_dependency_order()
        
        with connection.cursor() as cursor:
            # Deshabilitar restricciones de foreign key temporalmente
            cursor.execute("PRAGMA foreign_keys = OFF;")
            
            try:
                # 1. Eliminar todos los datos de todas las tablas
                self.stdout.write("🗑️  Eliminando datos de todas las tablas...")
                for model in all_models:
                    table_name = model._meta.db_table
                    # Escapar nombres de tabla que son palabras reservadas
                    escaped_table_name = f'"{table_name}"'
                    cursor.execute(f"DELETE FROM {escaped_table_name};")
                    self.stdout.write(f"   ✓ {table_name}")

                # 2. Reiniciar secuencias de SQLite (contadores de ID)
                self.stdout.write("🔄 Reiniciando contadores de ID...")
                cursor.execute("""
                    DELETE FROM sqlite_sequence 
                    WHERE name IN (
                        SELECT name FROM sqlite_master 
                        WHERE type='table' AND name != 'sqlite_sequence'
                    );
                """)
                
                # 3. Vacuum para limpiar y optimizar la base de datos (fuera de transacción)
                self.stdout.write("🧹 Preparando optimización...")
                
            finally:
                # Rehabilitar restricciones de foreign key
                cursor.execute("PRAGMA foreign_keys = ON;")

        # 4. Vacuum fuera de la transacción
        self.stdout.write("🧹 Optimizando base de datos...")
        with connection.cursor() as cursor:
            cursor.execute("VACUUM;")

        self.stdout.write("✅ Limpieza completada")

    def get_models_in_dependency_order(self):
        """Obtener modelos en orden de dependencias (más dependientes primero)"""
        from django.apps import apps
        
        # Obtener todos los modelos de nuestras apps
        our_apps = ['config', 'inventory', 'operation']
        all_models = []
        
        for app_name in our_apps:
            try:
                app = apps.get_app_config(app_name)
                models = list(app.get_models())
                all_models.extend(models)
            except LookupError:
                self.stdout.write(
                    self.style.WARNING(f"⚠️  App '{app_name}' no encontrada")
                )
        
        # Ordenar por dependencias (aproximación simple)
        # Los modelos con más foreign keys van primero
        def dependency_count(model):
            fk_count = len([
                field for field in model._meta.get_fields()
                if hasattr(field, 'related_model') and field.related_model
            ])
            return -fk_count  # Negativo para orden descendente
        
        all_models.sort(key=dependency_count)
        
        return all_models

    def verify_empty_database(self):
        """Verificar que la base de datos esté realmente vacía"""
        from django.apps import apps
        
        total_objects = 0
        for app_name in ['config', 'inventory', 'operation']:
            try:
                app = apps.get_app_config(app_name)
                for model in app.get_models():
                    count = model.objects.count()
                    total_objects += count
                    if count > 0:
                        self.stdout.write(
                            self.style.WARNING(
                                f"⚠️  {model.__name__} aún tiene {count} objetos"
                            )
                        )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"❌ Error verificando {app_name}: {str(e)}")
                )
        
        if total_objects == 0:
            self.stdout.write(
                self.style.SUCCESS("✅ Verificación: Base de datos completamente vacía")
            )
        else:
            self.stdout.write(
                self.style.ERROR(f"❌ Quedan {total_objects} objetos en la BD")
            )
        
        return total_objects == 0