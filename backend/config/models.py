from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone



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


class RestaurantOperationalConfig(models.Model):
    """Configuración operativa del restaurante"""
    name = models.CharField(max_length=100, default="Configuración Principal")
    opening_time = models.TimeField(help_text="Hora de apertura del restaurante")
    closing_time = models.TimeField(help_text="Hora de cierre del restaurante")
    operational_cutoff_time = models.TimeField(
        default="05:00", 
        help_text="Hora de corte para fecha operativa (por defecto 5:00 AM)"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'restaurant_operational_config'
        verbose_name = 'Configuración Operativa'
        verbose_name_plural = 'Configuraciones Operativas'

    def __str__(self):
        return f"{self.name} ({self.opening_time} - {self.closing_time})"

    def save(self, *args, **kwargs):
        # Solo permitir una configuración activa
        if self.is_active:
            RestaurantOperationalConfig.objects.filter(is_active=True).exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)

    @classmethod
    def get_active_config(cls):
        """Obtiene la configuración operativa activa"""
        return cls.objects.filter(is_active=True).first()

    @classmethod
    def get_operational_date(cls, dt=None):
        """
        Obtiene la fecha operativa basada en la configuración del restaurante
        Args:
            dt: datetime opcional, si no se proporciona usa timezone.now()
        Returns:
            date: La fecha operativa del negocio
        """
        if dt is None:
            dt = timezone.now()
        
        config = cls.get_active_config()
        if not config:
            # Fallback al método anterior si no hay configuración
            cutoff_hour = 5
        else:
            cutoff_hour = config.operational_cutoff_time.hour

        # Si es después del corte operativo, usar fecha actual
        if dt.hour >= cutoff_hour:
            return dt.date()
        # Si es antes del corte operativo, usar fecha del día anterior
        else:
            import datetime
            return (dt - datetime.timedelta(days=1)).date()

    def is_currently_open(self, dt=None):
        """
        Verifica si el restaurante está abierto en el momento dado
        """
        if dt is None:
            dt = timezone.now()
        
        # Convertir a hora local para comparar con horarios configurados
        local_dt = timezone.localtime(dt)
        current_time = local_dt.time()
        
        # Caso normal: apertura y cierre el mismo día
        if self.opening_time <= self.closing_time:
            return self.opening_time <= current_time <= self.closing_time
        
        # Caso especial: cierre al día siguiente (ej: 20:00 - 03:00)
        else:
            return current_time >= self.opening_time or current_time <= self.closing_time

    def get_business_hours_text(self):
        """Retorna texto descriptivo de los horarios"""
        if self.opening_time <= self.closing_time:
            return f"{self.opening_time.strftime('%H:%M')} - {self.closing_time.strftime('%H:%M')}"
        else:
            return f"{self.opening_time.strftime('%H:%M')} - {self.closing_time.strftime('%H:%M')} (+1 día)"


class Waiter(models.Model):
    """Meseros del restaurante"""
    name = models.CharField(max_length=100, verbose_name="Nombre")
    phone = models.CharField(max_length=20, blank=True, verbose_name="Teléfono")
    is_active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'waiter'
        verbose_name = 'Mesero'
        verbose_name_plural = 'Meseros'
        ordering = ['name']

    def __str__(self):
        return self.name

    def delete(self, *args, **kwargs):
        # Soft delete - solo marcamos como inactivo si tiene órdenes asociadas
        if hasattr(self, 'order_set') and self.order_set.exists():
            self.is_active = False
            self.save()
        else:
            super().delete(*args, **kwargs)
