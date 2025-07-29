# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0007_add_operational_date'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='is_takeaway',
            field=models.BooleanField(default=False, verbose_name='Para llevar'),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='has_taper',
            field=models.BooleanField(default=False, verbose_name='Con envoltorio'),
        ),
    ]