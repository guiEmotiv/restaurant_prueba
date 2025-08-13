# Generated manually to add PREPARING status to OrderItem
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0019_add_paid_status_to_orderitem'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='preparing_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='orderitem',
            name='status',
            field=models.CharField(
                choices=[
                    ('CREATED', 'Creado'),
                    ('PREPARING', 'En Preparación'),
                    ('SERVED', 'Entregado'),
                    ('PAID', 'Pagado')
                ],
                default='CREATED',
                max_length=10
            ),
        ),
    ]