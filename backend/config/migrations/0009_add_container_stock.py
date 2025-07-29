# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('config', '0008_add_container'),
    ]

    operations = [
        migrations.AddField(
            model_name='container',
            name='stock',
            field=models.PositiveIntegerField(default=0, verbose_name='Stock'),
        ),
    ]