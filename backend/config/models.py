from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from django.core.validators import MinValueValidator



class Unit(models.Model):
    """Unidades de medida para ingredientes"""
    name = models.CharField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'unit'
        verbose_name = 'Unidad'
        verbose_name_plural = 'Unidades'
        ordering = ['-id']

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
        ordering = ['-id']

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
        ordering = ['-id']

    def __str__(self):
        return f"Mesa {self.table_number} - {self.zone.name}"

    def release_table(self):
        """Releases the table when order is SERVED"""
        # For now, just mark as available
        # In the future, we might want to add a 'status' field to Table model
        pass
    
    def delete(self, *args, **kwargs):
        if self.order_set.exists():
            raise ValidationError("No se puede eliminar una mesa que tiene órdenes asociadas")
        super().delete(*args, **kwargs)




class Container(models.Model):
    """Envases para comida para llevar"""
    name = models.CharField(max_length=100, unique=True, verbose_name="Nombre")
    description = models.TextField(blank=True, verbose_name="Descripción")
    price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Precio"
    )
    stock = models.PositiveIntegerField(default=0, verbose_name="Stock")
    is_active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'container'
        verbose_name = 'Envase'
        verbose_name_plural = 'Envases'
        ordering = ['-id']

    def __str__(self):
        return f"{self.name} - {self.price}"

    def update_stock(self, quantity, operation='subtract'):
        """Actualiza el stock del envase"""
        if operation == 'subtract':
            if self.stock < quantity:
                raise ValidationError(f"Stock insuficiente. Stock actual: {self.stock}")
            self.stock -= quantity
        elif operation == 'add':
            self.stock += quantity
        
        self.save()

    def delete(self, *args, **kwargs):
        # Soft delete - solo marcamos como inactivo si tiene ventas asociadas
        if hasattr(self, 'containersale_set') and self.containersale_set.exists():
            self.is_active = False
            self.save()
        else:
            super().delete(*args, **kwargs)
