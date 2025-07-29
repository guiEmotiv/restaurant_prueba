from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal
from config.models import Table, Waiter, Container
from inventory.models import Recipe, Ingredient


class Order(models.Model):
    STATUS_CHOICES = [
        ('CREATED', 'Creado'),
        ('SERVED', 'Entregado'),
        ('PAID', 'Pagado'),
    ]

    table = models.ForeignKey(Table, on_delete=models.PROTECT)
    waiter = models.ForeignKey(Waiter, on_delete=models.PROTECT, null=True, blank=True, verbose_name="Mesero")
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
    # Fecha operativa: fecha de negocio (ej: si abre 8pm hoy hasta 3am mañana, toda la operación es fecha de hoy)
    operational_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'order'
        verbose_name = 'Orden'
        verbose_name_plural = 'Órdenes'

    def __str__(self):
        return f"Orden #{self.id} - Mesa {self.table.table_number}"

    def save(self, *args, **kwargs):
        # Establecer fecha operativa si no existe
        if not self.operational_date:
            self.operational_date = self.get_operational_date()
        super().save(*args, **kwargs)
    
    @staticmethod
    def get_operational_date():
        """Obtiene la fecha operativa actual basada en configuración del restaurante"""
        from config.models import RestaurantOperationalConfig
        return RestaurantOperationalConfig.get_operational_date()

    def calculate_total(self):
        """Calcula el total de la orden incluyendo items y envases"""
        if self.pk:
            # Total de items de comida
            items_total = sum(item.total_price for item in self.orderitem_set.all())
            
            # Total de envases (separado)
            containers_total = sum(container.total_price for container in self.container_sales.all())
            
            # Total general
            total = items_total + containers_total
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
    
    def get_total_paid(self):
        """Obtiene el total pagado de la orden"""
        return self.payments.aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0.00')
    
    def get_pending_amount(self):
        """Obtiene el monto pendiente de pago"""
        return self.total_amount - self.get_total_paid()
    
    def is_fully_paid(self):
        """Verifica si la orden está completamente pagada"""
        return self.get_pending_amount() <= Decimal('0.00')


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
    quantity = models.PositiveIntegerField(default=1, verbose_name='Cantidad')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='CREATED')
    notes = models.TextField(blank=True)
    is_takeaway = models.BooleanField(default=False, verbose_name='Para llevar')
    has_taper = models.BooleanField(default=False, verbose_name='Con envoltorio')
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
        
        # Calcular precio total inicial (precio base * cantidad)
        if not self.total_price:
            self.total_price = self.unit_price * self.quantity
            
        super().save(*args, **kwargs)
        
        # Después de guardar, recalcular con customizaciones si existen
        if self.pk:
            self.calculate_total_price()
            # Actualizar total de la orden
            self.order.calculate_total()

    def calculate_total_price(self):
        """Calcula el precio total del item incluyendo customizaciones y cantidad"""
        base_total = self.unit_price * self.quantity
        customization_total = Decimal('0.00')
        
        # Solo buscar customizaciones si el objeto ya está guardado
        if self.pk:
            customization_total = sum(
                item.total_price for item in self.orderitemingredient_set.all()
            )
        
        # Nota: Los envases (taper) ahora se manejan por separado en ContainerSale
        # Ya no se incluyen en el cálculo del precio del item
        
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
    
    def get_paid_amount(self):
        """Obtiene el monto pagado de este item"""
        from django.db.models import Sum
        return PaymentItem.objects.filter(
            order_item=self
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    
    def get_pending_amount(self):
        """Obtiene el monto pendiente de pago de este item"""
        return self.total_price - self.get_paid_amount()
    
    def is_fully_paid(self):
        """Verifica si el item está completamente pagado"""
        return self.get_pending_amount() <= Decimal('0.00')


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
        ('YAPE_PLIN', 'Yape/Plin'),
        ('OTHER', 'Otro'),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHOD_CHOICES)
    tax_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.00'))],
        default=Decimal('0.00')
    )
    amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Fecha operativa heredada de la orden
    operational_date = models.DateField(null=True, blank=True)
    # Identificador para agrupar pagos del mismo split
    split_group = models.CharField(max_length=36, null=True, blank=True)
    # Persona responsable del pago (opcional)
    payer_name = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'payment'
        verbose_name = 'Pago'
        verbose_name_plural = 'Pagos'

    def __str__(self):
        return f"Pago {self.order} - {self.payment_method} - {self.amount}"

    def save(self, *args, **kwargs):
        # Heredar fecha operativa de la orden
        if not self.operational_date and self.order:
            self.operational_date = self.order.operational_date
        super().save(*args, **kwargs)
        # Verificar si la orden está completamente pagada
        self._check_order_fully_paid()
    
    def _check_order_fully_paid(self):
        """Verifica si la orden está completamente pagada"""
        order_total = self.order.total_amount
        total_paid = self.order.payments.aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0.00')
        
        if total_paid >= order_total:
            self.order.update_status('PAID')


class PaymentItem(models.Model):
    """Asocia items específicos con un pago (para splits)"""
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name='payment_items')
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE)
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'payment_item'
        verbose_name = 'Item de Pago'
        verbose_name_plural = 'Items de Pago'
        unique_together = ['payment', 'order_item']
    
    def __str__(self):
        return f"{self.payment} - {self.order_item}"


class ContainerSale(models.Model):
    """Venta de envases asociada a un pedido (separada del costo de los alimentos)"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='container_sales', verbose_name="Pedido")
    container = models.ForeignKey(Container, on_delete=models.PROTECT, verbose_name="Envase")
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)], verbose_name="Cantidad")
    unit_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Precio unitario"
    )
    total_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name="Total"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    operational_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'container_sale'
        verbose_name = 'Venta de Envase'
        verbose_name_plural = 'Ventas de Envases'
        ordering = ['-created_at']

    def __str__(self):
        return f"Envase {self.container.name} x{self.quantity} - Pedido #{self.order.id}"

    def save(self, *args, **kwargs):
        # Establecer precio unitario del envase si no está definido
        if not self.unit_price:
            self.unit_price = self.container.price
        
        # Calcular precio total
        self.total_price = self.unit_price * self.quantity
        
        # Heredar fecha operativa de la orden
        if not self.operational_date and self.order:
            self.operational_date = self.order.operational_date
        
        super().save(*args, **kwargs)
        
        # Recalcular total de la orden incluyendo envases
        if self.order:
            self.order.calculate_total()
