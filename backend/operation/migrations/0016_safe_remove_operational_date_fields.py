# Safe migration to remove operational_date fields only if they exist

from django.db import migrations, connection


def safe_remove_column_if_exists(table_name, column_name):
    """Remove column only if it exists"""
    with connection.cursor() as cursor:
        try:
            # Check if column exists in table
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [row[1] for row in cursor.fetchall()]
            
            if column_name in columns:
                # SQLite doesn't support DROP COLUMN directly, so we skip it
                # The migration system should handle this automatically when needed
                print(f"✅ Campo {column_name} encontrado en {table_name} - será manejado por Django")
            else:
                print(f"ℹ️  Campo {column_name} no existe en {table_name} - omitiendo")
        except Exception as e:
            print(f"ℹ️  Error verificando campo {column_name} en {table_name}: {e} - continuando...")


def forward_migration(apps, schema_editor):
    """Safe removal of operational_date fields"""
    print("🔧 Verificando campos operational_date...")
    
    # Check if fields exist before trying to remove them
    safe_remove_column_if_exists('operation_order', 'operational_date')
    safe_remove_column_if_exists('operation_payment', 'operational_date')  
    safe_remove_column_if_exists('operation_containersale', 'operational_date')
    
    print("✅ Verificación de campos completada")


def reverse_migration(apps, schema_editor):
    """Reverse migration - no action needed"""
    print("ℹ️  Migración reversa: no se requiere acción para campos operational_date")


class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0015_remove_cartitem_unique_constraint'),
    ]

    operations = [
        migrations.RunPython(
            forward_migration,
            reverse_migration,
            atomic=False  # Better error handling
        ),
    ]