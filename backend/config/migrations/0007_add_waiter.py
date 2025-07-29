# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('config', '0003_restaurantoperationalconfig'),
    ]

    operations = [
        migrations.CreateModel(
            name='Waiter',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Nombre')),
                ('phone', models.CharField(blank=True, max_length=20, verbose_name='Teléfono')),
                ('is_active', models.BooleanField(default=True, verbose_name='Activo')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Mesero',
                'verbose_name_plural': 'Meseros',
                'db_table': 'waiter',
                'ordering': ['name'],
            },
        ),
    ]