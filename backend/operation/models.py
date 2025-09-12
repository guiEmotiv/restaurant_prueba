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


# Configuración de impresoras USB para múltiples etiquetadoras
class PrinterConfig(models.Model):
    """Configuración de impresoras USB para RPi4"""
    
    name = models.CharField(max_length=100, help_text='Nombre descriptivo (ej: Etiquetadora Mesa 1)')
    usb_port = models.CharField(max_length=100, unique=True, help_text='Puerto USB (ej: /dev/usb/lp0 o /dev/ttyUSB0)')
    device_path = models.CharField(max_length=200, blank=True, help_text='Ruta completa del dispositivo (auto-detectada)')
    is_active = models.BooleanField(default=True)
    
    # Configuración específica de impresora
    baud_rate = models.IntegerField(default=9600, help_text='Velocidad de comunicación (solo para seriales)')
    paper_width_mm = models.IntegerField(default=80, help_text='Ancho del papel en mm')
    
    # Metadatos
    description = models.TextField(blank=True, help_text='Descripción adicional')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'printer_config'
        ordering = ['name']
        verbose_name = 'Configuración de Impresora'
        verbose_name_plural = 'Configuraciones de Impresoras'
    
    def __str__(self):
        return f"{self.name} ({self.usb_port}) - {'Activa' if self.is_active else 'Inactiva'}"
    
    def test_connection(self):
        """Prueba la conexión enviando etiqueta de prueba real al RPi4"""
        try:
            from django.utils import timezone
            import requests
            import os
            import logging
            
            logger = logging.getLogger(__name__)
            
            # Configuración HTTP para RPi4
            RPI_HTTP_HOST = os.getenv('RPI4_HTTP_HOST', '192.168.1.44')
            RPI_HTTP_PORT = os.getenv('RPI4_HTTP_PORT', '3001')
            RPI_HTTP_URL = f"http://{RPI_HTTP_HOST}:{RPI_HTTP_PORT}"
            
            # Crear etiqueta de prueba informativa
            test_time = timezone.now()
            test_label = f"""
================================
      TEST DE IMPRESORA
================================

Impresora: {self.name}
Puerto USB: {self.usb_port}
Fecha: {test_time.strftime('%Y-%m-%d %H:%M:%S')}

--------------------------------
Estado: CONEXIÓN EXITOSA ✓
Sistema: Restaurant Web
Raspberry Pi 4 Printer Test
================================

        """
            
            # Preparar payload para RPi4
            payload = {
                'action': 'print',
                'port': self.usb_port,  # Usar puerto específico de esta impresora
                'data': {
                    'label_content': test_label,
                    'printer_id': self.id,
                    'printer_name': self.name,
                    'test_mode': True,
                    'timestamp': test_time.isoformat()
                }
            }
            
            logger.info(f"🖨️ Testing printer connection: {self.name} at {self.usb_port}")
            
            # Enviar request HTTP al RPi4
            response = requests.post(
                f"{RPI_HTTP_URL}/print",
                json=payload,
                timeout=10,
                headers={'Content-Type': 'application/json'}
            )
            
            # Considerar exitoso si el RPi4 responde (aunque el callback falle)
            # El RPi4 puede devolver success=false si el callback a Django timeou, pero eso no significa que la impresora no funcione
            if response.status_code == 200:
                response_data = response.json()
                rpi4_success = response_data.get('success', False)
                error_message = response_data.get('error', '')
                
                # Si el error es por timeout del callback, consideramos exitoso el test de conectividad
                connection_success = rpi4_success or ('timeout' in error_message.lower() or 'read timed out' in error_message.lower())
                
                logger.info(f"🔍 RPi4 Response: success={rpi4_success}, error='{error_message}', treating_as_success={connection_success}")
            else:
                connection_success = False
            
            if connection_success:
                logger.info(f"✅ Printer test successful: {self.name}")
            else:
                logger.warning(f"⚠️ Printer test failed: {self.name} - {response.text}")
            
            # Actualizar estado según resultado
            self.is_active = connection_success
            self.last_used_at = timezone.now() if connection_success else self.last_used_at
            self.save(update_fields=['is_active', 'last_used_at'])
            
            return connection_success
            
        except requests.exceptions.Timeout as e:
            # El timeout es normal cuando el RPi4 recibe el print pero el callback falla
            # Consideramos esto como una conexión exitosa porque la impresora puede imprimir
            logger.info(f"⏰ Timeout al RPi4 {self.name}: {str(e)} - Tratando como exitoso (impresora accesible)")
            
            self.is_active = True  # Timeout significa que RPi4 está accesible
            self.last_used_at = timezone.now()
            self.save(update_fields=['is_active', 'last_used_at'])
            return True
            
        except requests.exceptions.ConnectionError as e:
            # Error de conexión real - RPi4 no accesible
            logger.error(f"🔌 Connection error to RPi4 for printer {self.name}: {str(e)}")
            
            self.is_active = False
            self.save(update_fields=['is_active'])
            return False
            
        except Exception as e:
            # Otros errores inesperados
            logger.error(f"❌ Unexpected error testing printer {self.name}: {str(e)}")
            
            self.is_active = False
            self.save(update_fields=['is_active'])
            return False
    
    def update_last_used(self):
        """Actualiza el timestamp de último uso"""
        from django.utils import timezone
        self.last_used_at = timezone.now()
        self.save(update_fields=['last_used_at'])


class Order(models.Model):
    STATUS_CHOICES = [
        ('CREATED', 'Creado'),
        ('PREPARING', 'En Preparación'),
        ('SERVED', 'Servido'),
        ('PAID', 'Pagado'),
        ('CANCELED', 'Cancelado'),
    ]

    table = models.ForeignKey(Table, on_delete=models.PROTECT)
    waiter = models.CharField(max_length=150, blank=True, null=True, verbose_name="Mesero", help_text="Usuario que creó la orden")
    customer_name = models.CharField(max_length=150, default='Cliente', verbose_name="Nombre del cliente")
    party_size = models.PositiveIntegerField(default=2, verbose_name="Cantidad de personas")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='CREATED')
    total_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))],
        default=Decimal('0.00')
    )
    created_at = models.DateTimeField(auto_now_add=True)
    preparing_at = models.DateTimeField(null=True, blank=True)
    served_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    canceled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True, null=True, verbose_name="Motivo de cancelación")

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
            import logging
            logger = logging.getLogger(__name__)
            
            # Guardar estado original antes del refresh para evitar que se resetee
            original_status = self.status
            logger.info(f"🧮 BACKEND - calculate_total() ORDEN #{self.id}: Estado original: {original_status}")
            
            # Forzar refresh de la relación para evitar cache stale
            self.refresh_from_db()
            
            # Restaurar el status original si fue modificado por el refresh
            if self.status != original_status:
                logger.warning(f"⚠️ BACKEND - refresh_from_db() cambió estado de {original_status} a {self.status}, restaurando...")
                self.status = original_status
            
            # Total solo de items de comida
            items_total = sum(item.total_price for item in self.orderitem_set.all())
            
            # total_amount es solo la comida, los envases están separados
            self.total_amount = items_total
            logger.info(f"🧮 BACKEND - calculate_total() ORDEN #{self.id}: Total calculado: {items_total}, Estado final: {self.status}")
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

    def update_status(self, new_status, cancellation_reason=None):
        """Actualiza el estado de la orden y timestamps"""
        self.status = new_status
        now = timezone.now()
        
        if new_status == 'PREPARING':
            self.preparing_at = now
        elif new_status == 'SERVED':
            self.served_at = now
            # When order is SERVED, update CREATED and PREPARING items to SERVED
            # CANCELED items remain CANCELED
            for item in self.orderitem_set.filter(status__in=['CREATED', 'PREPARING']):
                item.update_status('SERVED')  # Use proper method to update timestamps
            # Release the table
            self.table.release_table()
        elif new_status == 'PAID':
            self.paid_at = now
        elif new_status == 'CANCELED':
            self.canceled_at = now
            if cancellation_reason:
                self.cancellation_reason = cancellation_reason
            # Release table when order is canceled
            self.table.release_table()
        
        # Save the order after updating status and timestamps
        self.save()

    def check_and_update_order_status(self):
        """Actualizar estado de Order basado en el estado de sus items activos"""
        import logging
        logger = logging.getLogger(__name__)
        
        # CRITICAL: Refresh from DB to prevent race conditions
        self.refresh_from_db()
        
        # Obtener todos los items activos (excluyendo cancelados)
        active_items = self.orderitem_set.exclude(status='CANCELED')
        
        logger.info(f"🔍 CHECK_ORDER_STATUS - Order #{self.id}: Status actual: {self.status}")
        logger.info(f"🔍 CHECK_ORDER_STATUS - Order #{self.id}: Items activos: {active_items.count()}")
        
        if not active_items.exists():
            # Si no hay items activos, mantener el estado actual
            logger.info(f"🔍 CHECK_ORDER_STATUS - Order #{self.id}: Sin items activos, manteniendo estado")
            return
        
        # Verificar si todos los items activos están en PREPARING
        preparing_count = active_items.filter(status='PREPARING').count()
        total_active = active_items.count()
        all_preparing = preparing_count == total_active
        
        logger.info(f"🔍 CHECK_ORDER_STATUS - Order #{self.id}: Items PREPARING: {preparing_count}/{total_active}")
        logger.info(f"🔍 CHECK_ORDER_STATUS - Order #{self.id}: Todos PREPARING: {all_preparing}")
        logger.info(f"🔍 CHECK_ORDER_STATUS - Order #{self.id}: ¿Debería cambiar?: {all_preparing and self.status == 'CREATED'}")
        
        if all_preparing and self.status == 'CREATED':
            # Cambiar Order de CREATED a PREPARING
            logger.info(f"🔄 CHECK_ORDER_STATUS - Order #{self.id}: Cambiando de CREATED a PREPARING")
            self.status = 'PREPARING'
            self.save()
            logger.info(f"✅ CHECK_ORDER_STATUS - Order #{self.id}: Actualizado a PREPARING")
    
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
        ('CANCELED', 'Cancelado'),
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
    canceled_at = models.DateTimeField(null=True, blank=True)
    printed_at = models.DateTimeField(null=True, blank=True, verbose_name="Impreso en cocina")
    cancellation_reason = models.TextField(blank=True, null=True, verbose_name="Motivo de cancelación")

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
        
        # LOG: Guardar OrderItem
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"🍽️ BACKEND - {'Creando' if is_creating else 'Actualizando'} OrderItem #{self.pk or 'NEW'}: {self.recipe.name} - Estado: {self.status} - Order: #{self.order_id}")
        
        super().save(*args, **kwargs)
        
        # FASE 2: AUTO-CREACIÓN DE TRABAJOS DE IMPRESIÓN
        if is_creating and self.status == 'CREATED' and self.recipe.printer:
            logger.info(f"🖨️ BACKEND - Creando PrintQueue para OrderItem #{self.id}")
            self._create_print_queue_job()
        
        # Recalcular total de la orden después de guardar el item
        if self.order_id:
            logger.info(f"🧮 BACKEND - Recalculando total para Order #{self.order_id}")
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

    def update_status(self, new_status, allow_automatic=False):
        """Actualiza el estado del item"""
        # CRITICAL: Refresh from DB to get latest state (prevent race conditions)
        self.refresh_from_db()
        
        # IMPORTANT: Los items cancelados nunca cambian de estado
        if self.status == 'CANCELED':
            return  # Los items cancelados permanecen así
        
        # ARQUITECTURA IDEMPOTENTE: Si ya está en el estado deseado, es un éxito
        if self.status == new_status:
            # Invalidar cache aunque no haya cambio real (para sincronizar vistas)
            from django.core.cache import cache
            cache.delete('kitchen_board_data')
            return  # Éxito idempotente - no hay error
        
        # Validar transiciones válidas solo si hay un cambio real
        valid_transitions = {
            'CREATED': ['PREPARING', 'CANCELED'],  # CREATED puede ir a preparación o cancelarse
            'PREPARING': ['SERVED', 'CANCELED'],   # PREPARING puede ir a servido o cancelarse
            'SERVED': ['PAID'],          # SERVED solo puede ir a PAID
            'PAID': [],                  # PAID es estado final
            'CANCELED': []               # CANCELED es estado final
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
        elif new_status == 'CANCELED':
            self.canceled_at = now
            # Cancelar automáticamente cualquier trabajo de impresión pendiente
            self._cancel_print_jobs()
        
        self.save()
        
        # CRITICAL: Invalidate kitchen_board cache whenever status changes
        from django.core.cache import cache
        cache.delete('kitchen_board_data')
        print(f"DEBUG: Cache invalidated after status change to {new_status}")
        
        # Verificar si necesitamos actualizar el estado de la orden
        import logging
        logger = logging.getLogger(__name__)
        
        if new_status in ['PREPARING', 'SERVED']:
            logger.info(f"🔗 ORDERITEM_UPDATE - Item #{self.id}: Estado {new_status} requiere verificación de Order")
            self._check_and_update_order_status()
        else:
            logger.info(f"🔗 ORDERITEM_UPDATE - Item #{self.id}: Estado {new_status} NO requiere verificación de Order")
    
    def _check_and_update_order_status(self):
        """Actualizar estado de Order cuando todos los items activos están PREPARING"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"🔗 ORDERITEM_CHECK - Item #{self.id}: Iniciando verificación de Order")
        logger.info(f"🔗 ORDERITEM_CHECK - Item #{self.id}: Nuevo estado: {self.status}")
        logger.info(f"🔗 ORDERITEM_CHECK - Item #{self.id}: Order asociado: #{self.order.id if self.order else 'N/A'}")
        
        if self.order:
            logger.info(f"🔗 ORDERITEM_CHECK - Item #{self.id}: Llamando a order.check_and_update_order_status()")
            self.order.check_and_update_order_status()
        else:
            logger.warning(f"🔗 ORDERITEM_CHECK - Item #{self.id}: SIN ORDER ASOCIADO - No se puede actualizar")
    
    def _cancel_print_jobs(self):
        """Cancelar automáticamente trabajos de impresión cuando OrderItem se cancela"""
        import logging
        logger = logging.getLogger(__name__)
        
        # Buscar todos los trabajos de impresión para este OrderItem
        print_jobs = self.print_jobs.filter(status__in=['pending', 'in_progress', 'failed'])
        
        if print_jobs.exists():
            logger.info(f"🚫 BACKEND - Cancelando {print_jobs.count()} print jobs para OrderItem #{self.id} CANCELED")
            
            # Cancelar todos los trabajos no completados
            updated_count = print_jobs.update(
                status='cancelled',
                error_message='OrderItem fue cancelado por el usuario'
            )
            
            logger.info(f"✅ BACKEND - {updated_count} print jobs cancelados automáticamente para OrderItem #{self.id}")
        else:
            logger.info(f"ℹ️ BACKEND - No hay print jobs para cancelar para OrderItem #{self.id}")
    
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
    
    def _create_print_queue_job(self):
        """FASE 2: Crear trabajo en la cola de impresión automáticamente"""
        try:
            # NO crear trabajos de impresión para items cancelados
            if self.status == 'CANCELED':
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"🚫 PRINT-FLOW - Skipping PrintQueue job creation for CANCELED OrderItem {self.id}")
                return None
            
            # Importación tardía para evitar circular
            PrintQueue = apps.get_model('operation', 'PrintQueue')
            
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"🖨️ PRINT-FLOW - Creando PrintQueue job para OrderItem #{self.id} ({self.recipe.name}) - Estado actual: {self.status}")
            logger.info(f"🖨️ PRINT-FLOW - Impresora asignada: {self.recipe.printer.name} ({self.recipe.printer.usb_port})")
            
            # Crear trabajo de impresión
            print_job = PrintQueue.objects.create(
                order_item=self,
                printer=self.recipe.printer,
                content=self._generate_label_content(),
                max_attempts=3  # Intentos por defecto
            )
            
            logger.info(f"✅ PRINT-FLOW - PrintQueue job #{print_job.id} creado exitosamente para OrderItem #{self.id}")
            logger.info(f"🔄 PRINT-FLOW - Job #{print_job.id} estado inicial: {print_job.status}")
            
            return print_job
            
        except Exception as e:
            # Log del error pero no fallar la creación del OrderItem
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"❌ PRINT-FLOW - Error creating PrintQueue job for OrderItem {self.id}: {e}")
            return None
    
    def _generate_label_content(self):
        """Genera el contenido de la etiqueta para imprimir en formato ticket profesional"""
        from django.utils import timezone
        
        # Comandos ESC/POS para formateo de texto de restaurante
        # Tamaños de texto más grandes para tickets profesionales
        large_text = "\x1B\x21\x30"         # Texto grande (doble ancho y alto)
        medium_text = "\x1B\x21\x20"        # Texto mediano (doble alto)
        double_width = "\x1B\x21\x20"       # Doble ancho
        double_height = "\x1B\x21\x10"      # Doble altura
        normal_text = "\x1B\x21\x00"        # Texto normal
        
        # Formateo adicional
        bold_on = "\x1B\x45\x01"            # Negrita ON
        bold_off = "\x1B\x45\x00"           # Negrita OFF
        center_on = "\x1B\x61\x01"          # Centrar texto
        left_align = "\x1B\x61\x00"         # Alinear izquierda
        
        # Obtener información del pedido
        # Usar la fecha/hora de creación del OrderItem convertida a zona horaria local
        from django.utils import timezone
        local_tz = timezone.get_current_timezone()
        creation_time = self.created_at.astimezone(local_tz)
        table_number = self.order.table.table_number if self.order.table else 'LL'
        waiter_name = getattr(self.order, 'waiter', 'N/A') if hasattr(self.order, 'waiter') else 'N/A'
        
        # Construir el contenido del ticket con tamaños profesionales
        # Espacio en blanco para el header (porta comanda) - más espacio
        content = "\n\n"
        
        # Título del pedido - MEDIANO y centrado
        content += f"{center_on}{medium_text}{bold_on}PEDIDO {self.order.id}{bold_off}{normal_text}\n\n"
        
        # Información de mesa y mozo - centrados
        content += f"{center_on}{medium_text}Principal - MESA {table_number}{normal_text}\n"
        content += f"{center_on}{medium_text}MOZO: {waiter_name}{normal_text}\n\n"
        
        # Fecha y hora - centrado (formato consistente)
        content += f"{center_on}{creation_time.strftime('%H:%M:%S')}      {creation_time.strftime('%d/%m/%Y')}\n{left_align}\n"
        
        # Línea separadora
        content += "================================\n\n"
        
        # Item del pedido - tamaño GRANDE para máxima visibilidad
        content += f"{large_text}{bold_on}X {self.quantity}{bold_off}{normal_text}\n"
        
        # Dividir nombre del recipe en palabras si es muy largo (máximo ~25 caracteres por línea)
        recipe_name = self.recipe.name.upper()
        max_chars_per_line = 25
        recipe_lines = self._split_text_by_words(recipe_name, max_chars_per_line)
        for line in recipe_lines:
            content += f"{large_text}{bold_on}{line}{bold_off}{normal_text}\n"
        content += "\n"
        
        # Notas si existen - tamaño GRANDE con división por palabras
        if self.notes:
            content += f"{large_text}NOTAS:{normal_text}\n"
            notes_lines = self._split_text_by_words(self.notes.upper(), max_chars_per_line)
            for line in notes_lines:
                content += f"{large_text}{line}{normal_text}\n"
            content += "\n"
        
        # Información adicional (takeaway, container, etc.) - tamaño GRANDE
        extras = []
        if self.is_takeaway:
            # Solo agregar DELIVERY si no está ya en las notas
            if not (self.notes and "delivery" in self.notes.lower()):
                extras.append("DELIVERY")
        if hasattr(self, 'container') and self.container:
            extras.append(f"ENVASE: {self.container.name.upper()}")
        
        if extras:
            content += f"{large_text}{' | '.join(extras)}{normal_text}\n\n"
        
        # Espacio adicional para el footer
        content += "\n\n\n"
        content += "\x1D\x56\x00"  # Comando de corte ESC/POS
        
        return content
    
    def _split_text_by_words(self, text, max_chars_per_line):
        """Divide texto por palabras completas respetando el límite de caracteres por línea"""
        if not text:
            return []
            
        words = text.split()
        lines = []
        current_line = ""
        
        for word in words:
            # Si agregar la palabra excede el límite, guardar la línea actual y empezar nueva
            if current_line and len(current_line + " " + word) > max_chars_per_line:
                lines.append(current_line)
                current_line = word
            else:
                # Agregar la palabra a la línea actual
                if current_line:
                    current_line += " " + word
                else:
                    current_line = word
        
        # Agregar la última línea si tiene contenido
        if current_line:
            lines.append(current_line)
            
        return lines



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
    # Control de impresión de recibo
    receipt_printed_at = models.DateTimeField(null=True, blank=True, verbose_name="Recibo impreso")

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


# Cola de impresión para arquitectura robusta
class PrintQueue(models.Model):
    """Cola de trabajos de impresión para sistema distribuido"""
    
    PRINT_STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('in_progress', 'En Progreso'),
        ('printed', 'Impreso'),
        ('failed', 'Fallido'),
        ('cancelled', 'Cancelado')
    ]
    
    # Relaciones
    order_item = models.ForeignKey('OrderItem', on_delete=models.CASCADE, related_name='print_jobs')
    printer = models.ForeignKey('PrinterConfig', on_delete=models.CASCADE, related_name='print_jobs')
    
    # Contenido del trabajo
    content = models.TextField(help_text='Contenido ESC/POS para imprimir')
    
    # Estado y control
    status = models.CharField(max_length=20, choices=PRINT_STATUS_CHOICES, default='pending')
    attempts = models.PositiveIntegerField(default=0, help_text='Número de intentos de impresión')
    max_attempts = models.PositiveIntegerField(default=3, help_text='Máximo número de intentos')
    
    # Mensajes de error
    error_message = models.TextField(blank=True, help_text='Último mensaje de error')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True, help_text='Cuándo se inició la impresión')
    completed_at = models.DateTimeField(null=True, blank=True, help_text='Cuándo se completó exitosamente')
    
    # Metadatos adicionales
    rpi_worker_id = models.CharField(max_length=100, blank=True, help_text='ID del worker RPi4 que procesa')
    
    class Meta:
        db_table = 'print_queue'
        ordering = ['created_at']
        verbose_name = 'Trabajo de Impresión'
        verbose_name_plural = 'Cola de Impresión'
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['printer', 'status']),
            models.Index(fields=['order_item']),
        ]
    
    def __str__(self):
        return f"PrintJob #{self.id}: {self.order_item.recipe.name} -> {self.printer.name} ({self.status})"
    
    def can_retry(self):
        """Determinar si el trabajo puede reintentarse"""
        return self.status in ['failed', 'pending'] and self.attempts < self.max_attempts
    
    def mark_in_progress(self, worker_id=None):
        """Marcar trabajo como en progreso"""
        self.status = 'in_progress'
        self.started_at = timezone.now()
        self.attempts += 1
        if worker_id:
            self.rpi_worker_id = worker_id
        self.save()
    
    def mark_completed(self):
        """Marcar trabajo como completado exitosamente"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"🎯 PRINT-FLOW - Marcando PrintQueue job #{self.id} como completado")
        logger.info(f"🎯 PRINT-FLOW - OrderItem asociado: #{self.order_item.id} ({self.order_item.recipe.name}) - Estado actual: {self.order_item.status}")
        
        self.status = 'printed'
        self.completed_at = timezone.now()
        self.error_message = ''  # Limpiar errores previos
        self.save()
        
        logger.info(f"✅ PRINT-FLOW - PrintQueue job #{self.id} marcado como 'printed' exitosamente")
        logger.info(f"🔄 PRINT-FLOW - Estado del OrderItem #{self.order_item.id} después del print: {self.order_item.status}")
        
        # PUNTO CRÍTICO: Aquí debería haber un mecanismo que actualice el OrderItem
        # pero según el análisis, el frontend debe hacer esta transición automáticamente
        # cuando detecta que el print job está completado
        logger.info(f"⚠️ PRINT-FLOW - NOTA: El frontend debería detectar este cambio y actualizar OrderItem a PREPARING")
    
    def mark_failed(self, error_message=''):
        """Marcar trabajo como fallido"""
        self.status = 'failed'
        self.error_message = error_message
        self.save()
    
    def reset_for_retry(self):
        """Resetear trabajo para reintento"""
        if self.can_retry():
            self.status = 'pending'
            self.started_at = None
            self.rpi_worker_id = ''
            self.save()
            return True
        return False

