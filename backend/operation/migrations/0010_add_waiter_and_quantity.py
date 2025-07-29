# Generated manually

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('config', '0007_add_waiter'),
        ('operation', '0009_add_takeaway_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='waiter',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to='config.waiter', verbose_name='Mesero'),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='quantity',
            field=models.PositiveIntegerField(default=1, verbose_name='Cantidad'),
        ),
    ]