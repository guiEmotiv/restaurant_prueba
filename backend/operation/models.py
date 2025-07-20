from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal
from config.models import Table
from inventory.models import Recipe, Ingredient


class Order(models.Model):
    STATUS_CHOICES = [
        ('CREATED', 'Creado'),
        ('SERVED', 'Entregado'),
        ('PAID', 'Pagado'),
    ]

    table = models.ForeignKey(Table, on_delete=models.PROTECT)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='CREATED')
    total_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))],
        default=Decimal('0.00')
    )
    created_at = models.DateTimeField(auto_now_add=True)
    served_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'order'
        verbose_name = 'Orden'
        verbose_name_plural = 'Órdenes'

    def __str__(self):
        return f"Orden #{self.id} - Mesa {self.table.table_number}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def calculate_total(self):
        """Calcula el total de la orden"""
        if self.pk:
            total = sum(item.total_price for item in self.orderitem_set.all())
            self.total_amount = total
            super().save()  # Usar super() para evitar recursión
            return total
        return Decimal('0.00')

    def consume_ingredients_on_creation(self):
        """Método separado para consumir ingredientes cuando se crea la orden"""
        if self.status == 'CREATED':
            for order_item in self.orderitem_set.all():
                order_item.recipe.consume_ingredients()

    def update_status(self, new_status):
        """Actualiza el estado de la orden y timestamps"""
        self.status = new_status
        now = timezone.now()
        
        if new_status == 'SERVED':
            self.served_at = now
        elif new_status == 'PAID':
            self.paid_at = now
        
        self.save()

    def check_and_update_order_status(self):
        """Verifica si todos los items están servidos y actualiza el estado de la orden automáticamente"""
        if self.status == 'CREATED':
            # Verificar si todos los items están servidos
            all_items_served = all(
                item.status == 'SERVED' 
                for item in self.orderitem_set.all()
            )
            
            if all_items_served and self.orderitem_set.exists():
                self.update_status('SERVED')


class OrderItem(models.Model):
    STATUS_CHOICES = [
        ('CREATED', 'Creado'),
        ('SERVED', 'Entregado'),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    recipe = models.ForeignKey(Recipe, on_delete=models.PROTECT)
    unit_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    total_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='CREATED')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    served_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'order_item'
        verbose_name = 'Item de Orden'
        verbose_name_plural = 'Items de Orden'

    def __str__(self):
        return f"{self.order} - {self.recipe.name}"

    def save(self, *args, **kwargs):
        if not self.unit_price:
            self.unit_price = self.recipe.base_price
        
        # Calcular precio total inicial (solo precio base)
        if not self.total_price:
            self.total_price = self.unit_price
            
        super().save(*args, **kwargs)
        
        # Después de guardar, recalcular con customizaciones si existen
        if self.pk:
            self.calculate_total_price()
            # Actualizar total de la orden
            self.order.calculate_total()

    def calculate_total_price(self):
        """Calcula el precio total del item incluyendo customizaciones"""
        base_total = self.unit_price
        customization_total = Decimal('0.00')
        
        # Solo buscar customizaciones si el objeto ya está guardado
        if self.pk:
            customization_total = sum(
                item.total_price for item in self.orderitemingredient_set.all()
            )
        
        self.total_price = base_total + customization_total
        
        # Solo guardar si ya existe en la BD para evitar recursión
        if self.pk:
            super().save()

    def can_be_modified(self):
        """Verifica si el item puede ser modificado"""
        return self.status == 'CREATED'

    def update_status(self, new_status):
        """Actualiza el estado del item"""
        # Validar transiciones válidas
        valid_transitions = {
            'CREATED': ['SERVED'],
            'SERVED': []
        }
        
        if new_status not in valid_transitions.get(self.status, []):
            raise ValidationError(f"No se puede cambiar de {self.status} a {new_status}")
        
        self.status = new_status
        now = timezone.now()
        
        if new_status == 'SERVED':
            self.served_at = now
        
        self.save()
        
        # Si el item fue servido, verificar si toda la orden está completa
        if new_status == 'SERVED':
            self._check_and_update_order_status()
    
    def _check_and_update_order_status(self):
        """Verifica si todos los items están servidos y actualiza el estado de la orden"""
        order = self.order
        all_items_served = order.orderitem_set.filter(status='SERVED').count()
        total_items = order.orderitem_set.count()
        
        if all_items_served == total_items and total_items > 0:
            order.update_status('SERVED')
    
    def delete(self, *args, **kwargs):
        """Override delete para recalcular el total de la orden"""
        order = self.order
        super().delete(*args, **kwargs)
        # Recalcular total de la orden después de eliminar el item
        order.calculate_total()


class OrderItemIngredient(models.Model):
    """Ingredientes personalizados en un item de orden"""
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE)
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT)
    quantity = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    unit_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    total_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'order_item_ingredient'
        verbose_name = 'Ingrediente Personalizado'
        verbose_name_plural = 'Ingredientes Personalizados'
        unique_together = ['order_item', 'ingredient']

    def __str__(self):
        return f"{self.order_item} - {self.ingredient.name}"

    def save(self, *args, **kwargs):
        # El precio unitario se toma del ingrediente y no es modificable
        self.unit_price = self.ingredient.unit_price
        self.total_price = self.unit_price * self.quantity
        super().save(*args, **kwargs)
        # Actualizar precio total del order_item
        self.order_item.calculate_total_price()
        self.order_item.save()


class Payment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('CASH', 'Efectivo'),
        ('CARD', 'Tarjeta'),
        ('TRANSFER', 'Transferencia'),
        ('OTHER', 'Otro'),
    ]

    order = models.OneToOneField(Order, on_delete=models.CASCADE)
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHOD_CHOICES)
    tax_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment'
        verbose_name = 'Pago'
        verbose_name_plural = 'Pagos'

    def __str__(self):
        return f"Pago {self.order} - {self.payment_method}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Actualizar estado de la orden a PAID
        self.order.update_status('PAID')
