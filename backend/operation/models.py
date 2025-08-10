from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.utils import timezone
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


    def calculate_total(self):
        """Calcula el total de items (NO incluye envases - están en container_sales)"""
        if self.pk:
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
        # Precio base: precio unitario * cantidad
        base_total = self.unit_price * self.quantity
        
        # Agregar customizaciones si existen
        customization_total = Decimal('0.00')
        if self.pk:
            customization_total = sum(
                item.total_price for item in self.orderitemingredient_set.all()
            )
        
        # NO incluir precio de envases aquí - los envases se manejan por separado en ContainerSale
        # Esto evita la distribución proporcional que causa cambios en precios
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
        """Las órdenes ya no tienen estado SERVED automático"""
        # Ya no actualizamos estado de orden cuando items se sirven
        pass
    
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


class Cart(models.Model):
    """
    Carrito de compras temporal para gestionar items antes de crear la orden.
    Separa claramente el estado temporal (carrito) del persistente (orden).
    """
    # Identificador único del carrito por sesión/mesa
    session_id = models.CharField(
        max_length=100, 
        unique=True,
        help_text="Identificador único para la sesión del carrito"
    )
    table = models.ForeignKey(
        Table, 
        on_delete=models.CASCADE,
        help_text="Mesa asociada al carrito"
    )
    user = models.CharField(
        max_length=150, 
        blank=True,
        help_text="Usuario/mesero que maneja el carrito"
    )
    # Metadatos para gestión de sesión
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="Fecha de expiración del carrito (opcional)"
    )

    class Meta:
        db_table = 'cart'
        verbose_name = 'Carrito'
        verbose_name_plural = 'Carritos'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['session_id']),
            models.Index(fields=['table', 'updated_at']),
        ]

    def __str__(self):
        return f"Carrito {self.session_id} - Mesa {self.table.table_number}"

    @classmethod
    def get_or_create_for_session(cls, session_id, table, user=None):
        """
        Obtiene o crea un carrito para una sesión específica.
        """
        cart, created = cls.objects.get_or_create(
            session_id=session_id,
            defaults={
                'table': table,
                'user': user or '',
            }
        )
        
        # Actualizar usuario si cambió
        if not created and user and cart.user != user:
            cart.user = user
            cart.save(update_fields=['user', 'updated_at'])
        
        return cart

    def get_total_items(self):
        """Obtiene el total de items en el carrito"""
        return self.cartitem_set.aggregate(
            total=models.Sum('quantity')
        )['total'] or 0

    def get_subtotal(self):
        """Obtiene el subtotal de comida (sin envases)"""
        return self.cartitem_set.aggregate(
            total=models.Sum(
                models.F('unit_price') * models.F('quantity')
            )
        )['total'] or Decimal('0.00')

    def get_containers_total(self):
        """Obtiene el total de envases"""
        return self.cartitem_set.filter(
            has_taper=True,
            container__isnull=False
        ).aggregate(
            total=models.Sum(
                models.F('container__price') * models.F('quantity')
            )
        )['total'] or Decimal('0.00')

    def get_grand_total(self):
        """Obtiene el total general (comida + envases)"""
        return self.get_subtotal() + self.get_containers_total()

    def clear(self):
        """Limpia todos los items del carrito"""
        self.cartitem_set.all().delete()

    def convert_to_order(self):
        """
        Convierte el carrito en una orden confirmada.
        Retorna la orden creada o None si el carrito está vacío.
        """
        if not self.cartitem_set.exists():
            return None

        # Crear la orden
        order = Order.objects.create(
            table=self.table,
            waiter=self.user,
        )

        # Convertir CartItems a OrderItems
        for cart_item in self.cartitem_set.all():
            order_item = OrderItem.objects.create(
                order=order,
                recipe=cart_item.recipe,
                quantity=cart_item.quantity,
                unit_price=cart_item.unit_price,
                notes=cart_item.notes,
                is_takeaway=cart_item.is_takeaway,
                has_taper=cart_item.has_taper,
            )

            # Crear ContainerSale si aplica
            if cart_item.has_taper and cart_item.container:
                ContainerSale.objects.create(
                    order=order,
                    container=cart_item.container,
                    quantity=cart_item.quantity,
                    unit_price=cart_item.container.price,
                    total_price=cart_item.container.price * cart_item.quantity
                )

        # Consumir ingredientes
        order.consume_ingredients_on_creation()

        # Limpiar el carrito
        self.clear()

        return order


class CartItem(models.Model):
    """
    Item individual del carrito temporal.
    Mantiene toda la información necesaria para convertirse en OrderItem.
    """
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE)
    recipe = models.ForeignKey(Recipe, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        verbose_name='Cantidad'
    )
    unit_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Precio unitario al momento de agregar al carrito"
    )
    notes = models.TextField(blank=True, verbose_name="Notas especiales")
    is_takeaway = models.BooleanField(default=False, verbose_name='Para llevar')
    has_taper = models.BooleanField(default=False, verbose_name='Con envoltorio')
    container = models.ForeignKey(
        Container, 
        null=True, 
        blank=True, 
        on_delete=models.PROTECT,
        help_text="Envase seleccionado si has_taper=True"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cart_item'
        verbose_name = 'Item de Carrito'
        verbose_name_plural = 'Items de Carrito'
        ordering = ['created_at']
        # Evitar duplicados exactos en el mismo carrito
        # Permitir múltiples items de la misma receta con diferentes cantidades
        # unique_together = ['cart', 'recipe']  # Comentado para permitir duplicados

    def __str__(self):
        return f"{self.cart} - {self.recipe.name} x{self.quantity}"

    def save(self, *args, **kwargs):
        # Establecer precio unitario si no está definido
        if not self.unit_price:
            self.unit_price = self.recipe.base_price
        
        # Validar container si has_taper
        if self.has_taper and not self.container:
            # Buscar container por defecto de la receta
            if self.recipe.container:
                self.container = self.recipe.container
        
        super().save(*args, **kwargs)

    def get_food_total(self):
        """Obtiene el total de comida (precio base * cantidad)"""
        return self.unit_price * self.quantity

    def get_container_total(self):
        """Obtiene el total de envase"""
        if self.has_taper and self.container:
            return self.container.price * self.quantity
        return Decimal('0.00')

    def get_item_total(self):
        """Obtiene el total del item (comida + envase)"""
        return self.get_food_total() + self.get_container_total()

    def can_merge_with(self, other_item_data):
        """
        Verifica si este item puede fusionarse con datos de otro item.
        Usado para agrupar items idénticos.
        """
        return (
            self.recipe_id == other_item_data.get('recipe') and
            self.notes == other_item_data.get('notes', '') and
            self.is_takeaway == other_item_data.get('is_takeaway', False) and
            self.has_taper == other_item_data.get('has_taper', False) and
            self.container_id == other_item_data.get('container')
        )
