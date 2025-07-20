from django.db import models
from django.core.exceptions import ValidationError


class Category(models.Model):
    """Categorías para ingredientes"""
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'category'
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'

    def __str__(self):
        return self.name

    def delete(self, *args, **kwargs):
        if self.ingredient_set.exists():
            raise ValidationError("No se puede eliminar una categoría que tiene ingredientes asociados")
        super().delete(*args, **kwargs)


class Unit(models.Model):
    """Unidades de medida para ingredientes"""
    name = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'unit'
        verbose_name = 'Unidad'
        verbose_name_plural = 'Unidades'

    def __str__(self):
        return self.name

    def delete(self, *args, **kwargs):
        if self.ingredient_set.exists():
            raise ValidationError("No se puede eliminar una unidad que tiene ingredientes asociados")
        super().delete(*args, **kwargs)


class Zone(models.Model):
    """Zonas del restaurante"""
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'zone'
        verbose_name = 'Zona'
        verbose_name_plural = 'Zonas'

    def __str__(self):
        return self.name

    def delete(self, *args, **kwargs):
        if self.table_set.exists():
            raise ValidationError("No se puede eliminar una zona que tiene mesas asociadas")
        super().delete(*args, **kwargs)


class Table(models.Model):
    """Mesas del restaurante"""
    zone = models.ForeignKey(Zone, on_delete=models.PROTECT)
    table_number = models.CharField(max_length=20, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'table'
        verbose_name = 'Mesa'
        verbose_name_plural = 'Mesas'

    def __str__(self):
        return f"Mesa {self.table_number} - {self.zone.name}"

    def delete(self, *args, **kwargs):
        if self.order_set.exists():
            raise ValidationError("No se puede eliminar una mesa que tiene órdenes asociadas")
        super().delete(*args, **kwargs)
