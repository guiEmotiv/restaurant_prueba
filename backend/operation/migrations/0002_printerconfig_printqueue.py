# Generated manually to add printer models
# Created by Assistant on 2025-09-10

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0002_initial'),
        ('operation', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PrinterConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='Nombre descriptivo (ej: Etiquetadora Mesa 1)', max_length=100)),
                ('usb_port', models.CharField(help_text='Puerto USB (ej: /dev/usb/lp0 o /dev/ttyUSB0)', max_length=100, unique=True)),
                ('device_path', models.CharField(blank=True, help_text='Ruta completa del dispositivo (auto-detectada)', max_length=200)),
                ('is_active', models.BooleanField(default=True)),
                ('max_retry_attempts', models.PositiveIntegerField(default=3, help_text='Intentos máximos de reimpresión')),
                ('timeout_seconds', models.PositiveIntegerField(default=10, help_text='Timeout de conexión en segundos')),
                ('baud_rate', models.IntegerField(default=9600, help_text='Velocidad de comunicación (solo para seriales)')),
                ('paper_width_mm', models.IntegerField(default=80, help_text='Ancho del papel en mm')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('last_used_at', models.DateTimeField(blank=True, null=True)),
                ('description', models.TextField(blank=True, help_text='Descripción adicional')),
            ],
            options={
                'verbose_name': 'Configuración de Impresora',
                'verbose_name_plural': 'Configuraciones de Impresoras',
                'db_table': 'printer_config',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='PrintQueue',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('job_id', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('status', models.CharField(choices=[('pending', 'Pendiente'), ('printing', 'Imprimiendo'), ('completed', 'Completado'), ('failed', 'Fallido'), ('cancelled', 'Cancelado')], default='pending', max_length=20)),
                ('content', models.TextField(help_text='Contenido a imprimir (ESC/POS commands o texto)')),
                ('priority', models.IntegerField(default=1, help_text='1=Baja, 2=Normal, 3=Alta, 4=Urgente')),
                ('current_attempts', models.PositiveIntegerField(default=0)),
                ('max_attempts', models.PositiveIntegerField(default=3)),
                ('error_message', models.TextField(blank=True, help_text='Último error registrado')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('printed_at', models.DateTimeField(blank=True, null=True)),
                ('cancelled_at', models.DateTimeField(blank=True, null=True)),
                ('cancellation_reason', models.TextField(blank=True)),
                ('order_item', models.ForeignKey(blank=True, help_text='OrderItem que generó esta impresión (si aplica)', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='print_jobs', to='operation.orderitem')),
                ('printer', models.ForeignKey(help_text='Impresora asignada', on_delete=django.db.models.deletion.CASCADE, related_name='print_jobs', to='operation.printerconfig')),
            ],
            options={
                'verbose_name': 'Trabajo de Impresión',
                'verbose_name_plural': 'Cola de Impresión',
                'db_table': 'print_queue',
                'ordering': ['-priority', 'created_at'],
            },
        ),
    ]