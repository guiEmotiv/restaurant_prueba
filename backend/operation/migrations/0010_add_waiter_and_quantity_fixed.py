# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0009_add_takeaway_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='waiter',
            field=models.CharField(max_length=150, blank=True, null=True, verbose_name="Mesero", help_text="Usuario que creó la orden"),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='quantity',
            field=models.PositiveIntegerField(default=1, verbose_name='Cantidad'),
        ),
    ]