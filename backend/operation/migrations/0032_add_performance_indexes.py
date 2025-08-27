# Generated migration for performance indexes

from django.db import migrations, models

def create_indexes_safely(apps, schema_editor):
    """Create indexes only if tables exist"""
    db_alias = schema_editor.connection.alias
    cursor = schema_editor.connection.cursor()
    
    # Check and create indexes for each table
    indexes_to_create = [
        # OrderItem indexes
        ("operation_orderitem", "idx_orderitem_status_created_at", "status, created_at"),
        ("operation_orderitem", "idx_orderitem_order_status", "order_id, status"),
        ("operation_orderitem", "idx_orderitem_recipe_status", "recipe_id, status"),
        
        # Order indexes
        ("operation_order", "idx_order_status_created_at", "status, created_at"),
        ("operation_order", "idx_order_table_status", "table_id, status"),
        
        # Payment indexes
        ("operation_payment", "idx_payment_created_at", "created_at"),
        ("operation_payment", "idx_payment_method_created", "payment_method, created_at"),
    ]
    
    for table_name, index_name, columns in indexes_to_create:
        try:
            # Check if table exists
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name=?
            """, [table_name])
            
            if cursor.fetchone():
                # Table exists, create index
                sql = "CREATE INDEX IF NOT EXISTS {} ON {} ({})".format(
                    index_name, table_name, columns
                )
                cursor.execute(sql)
                print("✅ Created index {} on {}".format(index_name, table_name))
            else:
                print("⚠️  Table {} doesn't exist, skipping index {}".format(table_name, index_name))
        except Exception as e:
            print("⚠️  Error creating index {}: {}".format(index_name, e))

def drop_indexes_safely(apps, schema_editor):
    """Drop indexes safely"""
    cursor = schema_editor.connection.cursor()
    
    indexes_to_drop = [
        "idx_orderitem_status_created_at",
        "idx_orderitem_order_status", 
        "idx_orderitem_recipe_status",
        "idx_order_status_created_at",
        "idx_order_table_status",
        "idx_payment_created_at",
        "idx_payment_method_created",
    ]
    
    for index_name in indexes_to_drop:
        try:
            cursor.execute("DROP INDEX IF EXISTS {}".format(index_name))
        except Exception as e:
            print("⚠️  Error dropping index {}: {}".format(index_name, e))

class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0031_final_working_dashboard_view'),
    ]

    operations = [
        migrations.RunPython(
            create_indexes_safely,
            reverse_code=drop_indexes_safely
        ),
    ]