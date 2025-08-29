# Generated migration to safely cleanup deprecated tables
from django.db import migrations


def safe_remove_deprecated_tables(apps, schema_editor):
    """
    Safely remove deprecated tables if they exist
    """
    db_alias = schema_editor.connection.alias
    
    # Get database cursor
    cursor = schema_editor.connection.cursor()
    
    # List of tables to check and remove
    tables_to_remove = [
        'operation_cart',
        'operation_cartitem', 
        'operation_orderitemingredient'
    ]
    
    for table_name in tables_to_remove:
        try:
            # Check if table exists
            cursor.execute(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
                [table_name]
            )
            table_exists = cursor.fetchone()[0] > 0
            
            if table_exists:
                print(f"Removing table {table_name}...")
                cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
            else:
                print(f"Table {table_name} already removed or never existed")
                
        except Exception as e:
            print(f"Error checking/removing table {table_name}: {e}")
            # Continue with other tables


class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0034_fix_table_names_in_view'),
    ]

    operations = [
        migrations.RunPython(
            safe_remove_deprecated_tables,
            reverse_code=migrations.RunPython.noop,
        ),
    ]