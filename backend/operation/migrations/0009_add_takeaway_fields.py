# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('operation', '0008_payment_payer_name_payment_split_group_and_more'),
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