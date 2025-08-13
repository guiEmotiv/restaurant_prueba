# Generated manually for adding PAID status to OrderItem

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0018_add_container_fields_to_orderitem'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='paid_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='orderitem',
            name='status',
            field=models.CharField(choices=[('CREATED', 'Creado'), ('SERVED', 'Entregado'), ('PAID', 'Pagado')], default='CREATED', max_length=10),
        ),
    ]