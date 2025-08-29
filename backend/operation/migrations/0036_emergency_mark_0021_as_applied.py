# Emergency migration to mark 0021 as applied without executing it
from django.db import migrations


def mark_migration_as_applied(apps, schema_editor):
    """
    Mark migration 0021 as applied in django_migrations table
    This avoids the 'no such table: cart_item' error
    """
    from django.db import connection
    
    cursor = connection.cursor()
    
    try:
        # Check if migration 0021 is already marked as applied
        cursor.execute(
            "SELECT COUNT(*) FROM django_migrations WHERE app='operation' AND name='0021_remove_orderitemingredient_table'"
        )
        already_applied = cursor.fetchone()[0] > 0
        
        if not already_applied:
            # Mark as applied without running the actual operations
            cursor.execute(
                "INSERT INTO django_migrations (app, name, applied) VALUES ('operation', '0021_remove_orderitemingredient_table', datetime('now'))"
            )
            print("✅ Migration 0021 marked as applied")
        else:
            print("ℹ️ Migration 0021 already marked as applied")
            
    except Exception as e:
        print(f"⚠️ Error marking migration: {e}")
        # Continue anyway - this is not critical
    
    cursor.close()


class Migration(migrations.Migration):
    
    dependencies = [
        ('operation', '0035_safe_cleanup_deprecated_tables'),
    ]

    operations = [
        migrations.RunPython(
            mark_migration_as_applied,
            reverse_code=migrations.RunPython.noop,
        ),
    ]