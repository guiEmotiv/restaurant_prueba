from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.utils import timezone
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.apps import apps
from decimal import Decimal
from config.models import Table, Container
from inventory.models import Recipe, Ingredient
import uuid


class Order(models.Model):
    STATUS_CHOICES = [
        ('CREATED', 'Creado'),
        ('PAID', 'Pagado'),
    ]

    table = models.ForeignKey(Table, on_delete=models.PROTECT)
    waiter = models.CharField(max_length=150, blank=True, null=True, verbose_name="Mesero", help_text="Usuario que creó la orden")
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
    
    @property
    def total_payments(self):
        """Calcula total de pagos realizados para esta orden"""
        return self.payments.aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0.00')
    
    @property
    def is_fully_paid(self):
        """Verifica si la orden está completamente pagada"""
        return self.total_payments >= self.total_amount
    
    @property 
    def payment_summary(self):
        """Resumen de pagos por método - Optimizado para dashboard"""
        payments = self.payments.values('payment_method').annotate(
            total=models.Sum('amount')
        )
        return {p['payment_method']: p['total'] for p in payments}


    def calculate_total(self):
        """Calcula el total de items (NO incluye envases - están en container_sales)"""
        if self.pk:
            # Forzar refresh de la relación para evitar cache stale
            self.refresh_from_db()
            
            # Total solo de items de comida
            items_total = sum(item.total_price for item in self.orderitem_set.all())
            
            # total_amount es solo la comida, los envases están separados
            self.total_amount = items_total
            super().save()  # Usar super() para evitar recursión
            return items_total
        return Decimal('0.00')
    
    def get_containers_total(self):
        """Obtiene el total de envases por separado"""
        if self.pk:
            return sum(container.total_price for container in self.container_sales.all())
        return Decimal('0.00')
    
    def get_grand_total(self):
        """Obtiene el total general (comida + envases)"""
        return self.total_amount + self.get_containers_total()

    def consume_ingredients_on_creation(self):
        """Método separado para consumir ingredientes cuando se crea la orden"""
        if self.status == 'CREATED':
            for order_item in self.orderitem_set.all():
                order_item.recipe.consume_ingredients()

    def update_status(self, new_status):
        """Actualiza el estado de la orden y timestamps"""
        self.status = new_status
        now = timezone.now()
        
        if new_status == 'PAID':
            self.paid_at = now
        
        self.save()

    def check_and_update_order_status(self):
        """Las órdenes ya no tienen estado SERVED - solo CREATED y PAID"""
        # No necesitamos actualizar estado automáticamente
        pass
    
    def get_total_paid(self):
        """Obtiene el total pagado de la orden"""
        return self.payments.aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0.00')
    
    def get_pending_amount(self):
        """Obtiene el monto pendiente de pago"""
        return self.get_grand_total() - self.get_total_paid()
    
    def is_fully_paid(self):
        """Verifica si la orden está completamente pagada"""
        return self.get_pending_amount() <= Decimal('0.00')
    
    def delete(self, *args, **kwargs):
        """Override delete para asegurar que el stock se restaure cuando se elimina la orden completa"""
        # Los OrderItems se eliminan automáticamente por CASCADE, y cada uno restaura su stock
        # No necesitamos hacer nada extra aquí, pero documentamos el comportamiento
        super().delete(*args, **kwargs)


class OrderItem(models.Model):
    STATUS_CHOICES = [
        ('CREATED', 'Creado'),
        ('PREPARING', 'En Preparación'),
        ('SERVED', 'Entregado'),
        ('PAID', 'Pagado'),
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
    container = models.ForeignKey(
        'config.Container', 
        on_delete=models.PROTECT, 
        null=True, 
        blank=True,
        related_name='order_items',
        help_text="Envase utilizado para este item"
    )
    container_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Precio del envase al momento de la venta"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    preparing_at = models.DateTimeField(null=True, blank=True)
    served_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'order_item'
        verbose_name = 'Item de Orden'
        verbose_name_plural = 'Items de Orden'

    def __str__(self):
        return f"{self.order} - {self.recipe.name}"

    def save(self, *args, **kwargs):
        # Set unit price if not set
        if not self.unit_price:
            self.unit_price = self.recipe.base_price
        
        # Calculate total_price based on quantity and unit_price
        self.total_price = self.unit_price * self.quantity
        
        # Descontar stock del container si es un nuevo OrderItem para llevar
        is_creating = self.pk is None
        if is_creating and self.container and self.has_taper:
            try:
                # SIEMPRE usar 1 envase por receta (independientemente de quantity)
                container_quantity = 1
                
                # Descontar stock del container
                self.container.update_stock(container_quantity, 'subtract')
                
                # Crear ContainerSale correspondiente para tracking
                # Usar una importación tardía para evitar circular
                ContainerSale = apps.get_model('operation', 'ContainerSale')
                ContainerSale.objects.create(
                    order=self.order,
                    container=self.container,
                    quantity=container_quantity,
                    unit_price=self.container.price,
                    total_price=self.container.price * container_quantity
                )
            except Exception as e:
                # Log del error pero no fallar la creación
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Error descontando stock de container en OrderItem: {e}")
        
        super().save(*args, **kwargs)
        
        # Recalcular total de la orden después de guardar el item
        if self.order_id:
            self.order.calculate_total()

    def calculate_total_price(self):
        """Calcula el precio total del item basado en cantidad (sin guardar)"""
        # Precio base: precio unitario * cantidad
        base_total = self.unit_price * self.quantity
        
        # El precio del envase ya NO se incluye aquí
        # Se maneja por separado para mantener claridad en reportes
        self.total_price = base_total
        
        return self.total_price

    def can_be_modified(self):
        """Verifica si el item puede ser modificado"""
        return self.status == 'CREATED'

    def update_status(self, new_status):
        """Actualiza el estado del item - IDEMPOTENTE para múltiples usuarios"""
        print(f"DEBUG: OrderItem {self.id} update_status called: {self.status} -> {new_status}")
        
        # CRITICAL: Refresh from DB to get latest state (prevent race conditions)
        self.refresh_from_db()
        print(f"DEBUG: After refresh_from_db: {self.status} -> {new_status}")
        
        # ARQUITECTURA IDEMPOTENTE: Si ya está en el estado deseado, es un éxito
        if self.status == new_status:
            print(f"DEBUG: Item already in {new_status} state - idempotent success")
            # Invalidar cache aunque no haya cambio real (para sincronizar vistas)
            from django.core.cache import cache
            cache.delete('kitchen_board_data')
            return  # Éxito idempotente - no hay error
        
        # Validar transiciones válidas solo si hay un cambio real
        valid_transitions = {
            'CREATED': ['PREPARING'],
            'PREPARING': ['SERVED'],
            'SERVED': ['PAID'],
            'PAID': []
        }
        
        print(f"DEBUG: Valid transitions for {self.status}: {valid_transitions.get(self.status, [])}")
        
        if new_status not in valid_transitions.get(self.status, []):
            error_msg = f"No se puede cambiar de {self.status} a {new_status}"
            print(f"DEBUG: Validation error: {error_msg}")
            raise ValidationError(error_msg)
        
        self.status = new_status
        now = timezone.now()
        
        if new_status == 'PREPARING':
            self.preparing_at = now
        elif new_status == 'SERVED':
            self.served_at = now
        elif new_status == 'PAID':
            self.paid_at = now
        
        self.save()
        
        # CRITICAL: Invalidate kitchen_board cache whenever status changes
        from django.core.cache import cache
        cache.delete('kitchen_board_data')
        print(f"DEBUG: Cache invalidated after status change to {new_status}")
        
        # Si el item fue servido, verificar si toda la orden está completa
        if new_status == 'SERVED':
            self._check_and_update_order_status()
    
    def _check_and_update_order_status(self):
        """Las órdenes ya no tienen estado SERVED automático"""
        # Ya no actualizamos estado de orden cuando items se sirven
        pass
    
    def delete(self, *args, **kwargs):
        """Override delete para recalcular el total de la orden"""
        order = self.order
        
        # La restauración de stock se maneja por el signal pre_delete
        # para asegurar que funcione también con eliminaciones CASCADE
        
        super().delete(*args, **kwargs)
        # Recalcular total de la orden después de eliminar el item
        if order and order.pk:  # Verificar que la orden aún existe
            order.calculate_total()
    
    def restore_ingredients_stock(self):
        """Restaura el stock de ingredientes cuando se elimina el order item"""
        for recipe_item in self.recipe.recipeitem_set.all():
            # Restaurar stock multiplicado por la cantidad del order item
            quantity_to_restore = recipe_item.quantity * self.quantity
            recipe_item.ingredient.update_stock(quantity_to_restore, 'add')
    
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
    
    def get_total_with_container(self):
        """Obtiene el precio total incluyendo el envase"""
        item_total = self.total_price
        
        # Primero verificar si tiene container directo (nueva arquitectura)
        if self.container and self.container_price:
            container_total = self.container_price * self.quantity
            return item_total + container_total
        
        # Fallback: buscar en ContainerSale (arquitectura antigua)
        if self.has_taper and self.order:
            # Buscar ContainerSale asociado temporal por timestamp
            container_sale = self.order.container_sales.filter(
                quantity=self.quantity,
                created_at__gte=self.created_at
            ).order_by('created_at').first()
            
            if container_sale:
                return item_total + container_sale.total_price
        
        return item_total



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
        super().save(*args, **kwargs)
        # Verificar si la orden está completamente pagada
        self._check_order_fully_paid()
    
    def _check_order_fully_paid(self):
        """Verifica si la orden está completamente pagada"""
        order_total = self.order.get_grand_total()
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
        
        
        super().save(*args, **kwargs)
        
        # Recalcular total de la orden incluyendo envases
        if self.order:
            self.order.calculate_total()


# ELIMINADO: Modelos Cart y CartItem 
# Sistema de carritos temporales eliminado para simplificar operaciones


# Django Signals para manejo de stock
@receiver(pre_delete, sender=OrderItem)
def restore_stock_signal(sender, instance, **kwargs):
    """
    Signal que se ejecuta antes de eliminar un OrderItem.
    Restaura el stock de ingredientes y containers incluso cuando se elimina por CASCADE.
    """
    try:
        # 1. Restaurar stock de ingredientes
        for recipe_item in instance.recipe.recipeitem_set.all():
            # Restaurar stock multiplicado por la cantidad del order item
            quantity_to_restore = recipe_item.quantity * instance.quantity
            recipe_item.ingredient.update_stock(quantity_to_restore, 'add')
        
        # 2. Restaurar stock de container si el OrderItem lo tiene
        if instance.container:
            # SIEMPRE restaurar 1 envase por receta (independientemente de quantity)
            container_quantity = 1
            instance.container.update_stock(container_quantity, 'add')
    except Exception as e:
        # Log del error pero no fallar la eliminación
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error restaurando stock en eliminación de OrderItem {instance.id}: {e}")


@receiver(pre_delete, sender=ContainerSale)
def restore_container_stock_signal(sender, instance, **kwargs):
    """
    Signal que se ejecuta antes de eliminar un ContainerSale.
    DESHABILITADO: La restauración se maneja desde OrderItem para evitar duplicación.
    """
    # DESHABILITADO: Evitar doble restauración
    # La restauración de stock se maneja desde el signal de OrderItem
    pass
