# Generated manually to add printed_at field to OrderItem

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0048_fix_dashboard_view_table_references'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='printed_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Impreso en cocina'),
        ),
    ]