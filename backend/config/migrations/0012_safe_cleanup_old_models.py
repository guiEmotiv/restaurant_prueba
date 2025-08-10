# Generated manually to safely clean up old models

from django.db import migrations, connection


def safe_delete_table_if_exists(table_name):
    """Eliminar tabla solo si existe"""
    with connection.cursor() as cursor:
        try:
            # Usar DROP TABLE IF EXISTS directamente - es más simple y seguro
            cursor.execute(f'DROP TABLE IF EXISTS "{table_name}"')
            print(f"✅ Tabla {table_name} eliminada (si existía)")
        except Exception as e:
            print(f"ℹ️  Error eliminando tabla {table_name}: {e} - continuando...")


def forward_migration(apps, schema_editor):
    """Migración hacia adelante: eliminar tablas obsoletas de forma segura"""
    safe_delete_table_if_exists('restaurant_operational_config')
    safe_delete_table_if_exists('waiter')


def reverse_migration(apps, schema_editor):
    """Migración hacia atrás: no hacer nada"""
    print("ℹ️  Migración reversa: no se requiere acción")
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('config', '0011_create_cart_models'),
    ]

    operations = [
        migrations.RunPython(
            forward_migration,
            reverse_migration,
            atomic=False  # No ejecutar en transacción para manejar errores mejor
        ),
    ]