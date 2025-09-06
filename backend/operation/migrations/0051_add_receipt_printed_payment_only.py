# Generated manually for receipt_printed_at field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0049_add_printed_at_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='payment',
            name='receipt_printed_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Recibo impreso'),
        ),
    ]