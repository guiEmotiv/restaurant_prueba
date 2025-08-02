# Generated manually

from django.db import migrations, models
import django.db.models.deletion
import django.core.validators
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('config', '0008_add_container'),
        ('operation', '0010_add_waiter_and_quantity_fixed'),
    ]

    operations = [
        migrations.CreateModel(
            name='ContainerSale',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.PositiveIntegerField(default=1, validators=[django.core.validators.MinValueValidator(1)], verbose_name='Cantidad')),
                ('unit_price', models.DecimalField(decimal_places=2, max_digits=10, validators=[django.core.validators.MinValueValidator(Decimal('0.00'))], verbose_name='Precio unitario')),
                ('total_price', models.DecimalField(decimal_places=2, max_digits=10, validators=[django.core.validators.MinValueValidator(Decimal('0.00'))], verbose_name='Total')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('operational_date', models.DateField(blank=True, null=True)),
                ('container', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='config.container', verbose_name='Envase')),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='container_sales', to='operation.order', verbose_name='Pedido')),
            ],
            options={
                'verbose_name': 'Venta de Envase',
                'verbose_name_plural': 'Ventas de Envases',
                'db_table': 'container_sale',
                'ordering': ['-created_at'],
            },
        ),
    ]