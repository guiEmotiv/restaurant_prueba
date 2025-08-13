#!/usr/bin/env python3
"""
Comando para limpiar SOLO los datos operacionales, conservando la configuración base.

Este comando elimina órdenes, pagos e items, pero conserva:
- Unidades, zonas, mesas, contenedores
- Grupos, ingredientes, recetas

Uso:
    python manage.py reset_operational_data --confirm
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.apps import apps
import os
from datetime import datetime


class Command(BaseCommand):
    help = 'Elimina solo los datos operacionales, conservando configuración base'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirmar que se desea eliminar datos operacionales',
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
                "⚠️  Este comando elimina datos operacionales.\n"
                "Use --confirm para confirmar la acción.\n"
                "Ejemplo: python manage.py reset_operational_data --confirm"
            )

        # Backup opcional
        if options['backup']:
            self.create_backup()

        # Mostrar qué se va a hacer
        self.stdout.write(
            self.style.WARNING(
                "\n📋 LIMPIEZA SELECTIVA DE DATOS:\n\n"
                "✅ SE CONSERVARÁN:\n"
                "   • Unidades de medida (config_unit)\n"
                "   • Zonas del restaurante (config_zone)\n" 
                "   • Configuración de mesas (config_table)\n"
                "   • Envases/contenedores (config_container)\n"
                "   • Grupos de recetas (inventory_group)\n"
                "   • Ingredientes (inventory_ingredient)\n"
                "   • Recetas del menú (inventory_recipe)\n\n"
                "❌ SE ELIMINARÁN:\n"
                "   • Todas las órdenes/pedidos (operation_order)\n"
                "   • Items de pedidos (operation_orderitem)\n"
                "   • Historial de pagos (operation_payment)\n"
                "   • Ventas de contenedores (operation_containersale)\n"
                "   • Sesiones de usuarios\n"
            )
        )
        
        final_confirm = input("\n¿Continuar con la limpieza? Escriba 'LIMPIAR': ")
        if final_confirm != 'LIMPIAR':
            self.stdout.write(self.style.ERROR("❌ Operación cancelada"))
            return

        try:
            self.reset_operational_data()
            self.stdout.write(
                self.style.SUCCESS(
                    "\n✅ Limpieza operacional completada exitosamente\n"
                    "✅ Configuración del restaurante preservada\n"
                    "✅ Menú y recetas intactas\n"
                    "ℹ️  Sistema listo para nuevas órdenes"
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
        
        db_path = settings.DATABASES['default']['NAME']
        backup_name = f"backup_operational_reset_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sqlite3"
        
        # Si db_path es una cadena, convertir a Path
        if isinstance(db_path, str):
            from pathlib import Path
            db_path = Path(db_path)
            backup_path = db_path.parent / backup_name
        else:
            backup_path = db_path.parent / backup_name
        
        try:
            shutil.copy2(str(db_path), str(backup_path))
            self.stdout.write(
                self.style.SUCCESS(f"✅ Backup creado: {backup_path}")
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Error creando backup: {str(e)}")
            )
            raise

    @transaction.atomic
    def reset_operational_data(self):
        """Eliminar solo datos operacionales, conservando configuración"""
        
        self.stdout.write("🔄 Iniciando limpieza de datos operacionales...")
        
        # Definir qué tablas limpiar (solo operacionales)
        operational_tables = [
            # Tablas de operaciones (orden de dependencias: más dependientes primero)
            'operation_payment',           # Pagos (depende de order)
            'operation_containersale',     # Ventas de contenedores (depende de order) 
            'operation_orderitem',         # Items de pedidos (depende de order)
            'operation_order',             # Órdenes principales
            
            # Tablas del sistema Django (opcional - cuidado con auth)
            'django_session',              # Sesiones de usuarios
        ]
        
        # Definir qué secuencias reiniciar (solo operacionales)
        operational_sequences = [
            'operation_order',
            'operation_orderitem', 
            'operation_payment',
            'operation_containersale',
        ]
        
        with connection.cursor() as cursor:
            # Deshabilitar restricciones de foreign key temporalmente
            cursor.execute("PRAGMA foreign_keys = OFF;")
            
            try:
                # 1. Eliminar datos de tablas operacionales
                self.stdout.write("🗑️  Eliminando datos operacionales...")
                
                for table_name in operational_tables:
                    try:
                        # Verificar si la tabla existe
                        cursor.execute("""
                            SELECT name FROM sqlite_master 
                            WHERE type='table' AND name=?;
                        """, [table_name])
                        
                        if cursor.fetchone():
                            # Escapar nombres de tabla que son palabras reservadas
                            escaped_table_name = f'"{table_name}"'
                            cursor.execute(f"DELETE FROM {escaped_table_name};")
                            
                            # Contar filas eliminadas
                            rows_affected = cursor.rowcount
                            if rows_affected > 0:
                                self.stdout.write(f"   ✓ {table_name} - {rows_affected} registros eliminados")
                            else:
                                self.stdout.write(f"   - {table_name} - ya estaba vacía")
                        else:
                            self.stdout.write(f"   ⚠ {table_name} - tabla no encontrada")
                    except Exception as e:
                        self.stdout.write(f"   ❌ Error en {table_name}: {str(e)}")

                # 2. Reiniciar solo secuencias operacionales
                self.stdout.write("🔄 Reiniciando contadores de ID operacionales...")
                
                for seq_name in operational_sequences:
                    try:
                        cursor.execute(
                            "DELETE FROM sqlite_sequence WHERE name = ?;",
                            [seq_name]
                        )
                        self.stdout.write(f"   ✓ Contador reiniciado: {seq_name}")
                    except Exception as e:
                        self.stdout.write(f"   ⚠ Error reiniciando {seq_name}: {str(e)}")
                
            finally:
                # Rehabilitar restricciones de foreign key
                cursor.execute("PRAGMA foreign_keys = ON;")

        # 3. Verificar configuración conservada
        self.verify_configuration_preserved()

        self.stdout.write("✅ Limpieza operacional completada")

    def verify_configuration_preserved(self):
        """Verificar que la configuración base se haya conservado"""
        
        preserved_models = {
            'config': ['Unit', 'Zone', 'Table', 'Container'],
            'inventory': ['Group', 'Ingredient', 'Recipe'],
        }
        
        self.stdout.write("\n🔍 Verificando configuración preservada:")
        
        total_preserved = 0
        
        for app_name, model_names in preserved_models.items():
            try:
                app = apps.get_app_config(app_name)
                for model_name in model_names:
                    try:
                        model = app.get_model(model_name)
                        count = model.objects.count()
                        total_preserved += count
                        
                        if count > 0:
                            self.stdout.write(f"   ✅ {model_name}: {count} registros")
                        else:
                            self.stdout.write(f"   ⚠️ {model_name}: 0 registros (¿esperado?)")
                            
                    except Exception as e:
                        self.stdout.write(f"   ❌ Error verificando {model_name}: {str(e)}")
                        
            except Exception as e:
                self.stdout.write(f"   ❌ Error verificando app {app_name}: {str(e)}")
        
        # Verificar datos operacionales eliminados
        self.stdout.write("\n🔍 Verificando datos operacionales eliminados:")
        
        operational_models = {
            'operation': ['Order', 'OrderItem', 'Payment', 'ContainerSale']
        }
        
        total_operational = 0
        
        for app_name, model_names in operational_models.items():
            try:
                app = apps.get_app_config(app_name)
                for model_name in model_names:
                    try:
                        model = app.get_model(model_name)
                        count = model.objects.count()
                        total_operational += count
                        
                        if count == 0:
                            self.stdout.write(f"   ✅ {model_name}: eliminado correctamente")
                        else:
                            self.stdout.write(f"   ⚠️ {model_name}: aún tiene {count} registros")
                            
                    except Exception as e:
                        self.stdout.write(f"   ❌ Error verificando {model_name}: {str(e)}")
                        
            except Exception as e:
                self.stdout.write(f"   ❌ Error verificando app {app_name}: {str(e)}")
        
        # Resumen
        self.stdout.write(f"\n📊 RESUMEN:")
        self.stdout.write(f"   ✅ Configuración preservada: {total_preserved} registros")
        self.stdout.write(f"   🗑️ Datos operacionales: {total_operational} registros restantes")
        
        if total_operational == 0:
            self.stdout.write("   ✅ Limpieza operacional completada correctamente")
        else:
            self.stdout.write("   ⚠️ Algunos datos operacionales no se eliminaron completamente")