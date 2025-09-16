from rest_framework import serializers
from django.db import transaction
from .models import Order, OrderItem, Payment, PaymentItem, ContainerSale
from config.serializers import TableSerializer, ContainerSerializer
from inventory.serializers import RecipeSerializer, IngredientSerializer
from decimal import Decimal
import uuid


# OrderItemIngredientSerializer removed - functionality deprecated

class OrderItemSerializer(serializers.ModelSerializer):
    recipe_name = serializers.CharField(source='recipe.name', read_only=True)
    recipe_preparation_time = serializers.IntegerField(source='recipe.preparation_time', read_only=True)
    order_zone = serializers.CharField(source='order.table.zone.name', read_only=True)
    order_table = serializers.CharField(source='order.table.table_number', read_only=True)
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    # customizations removed - OrderItemIngredient functionality deprecated
    elapsed_time_minutes = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    is_fully_paid = serializers.SerializerMethodField()
    container_info = serializers.SerializerMethodField()
    total_with_container = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderItem
        fields = [
            'id', 'recipe', 'recipe_name', 'recipe_preparation_time', 'unit_price', 'total_price',
            'status', 'notes', 'quantity', 'is_takeaway', 'has_taper', 'order_zone', 'order_table', 'order_id',
            'elapsed_time_minutes', 'is_overdue',
            'paid_amount', 'pending_amount', 'is_fully_paid',
            'container_info', 'total_with_container', 'created_at', 'preparing_at', 'served_at', 'canceled_at', 'printed_at',
            'print_confirmed'
        ]
        read_only_fields = [
            'id', 'unit_price', 'total_price', 'created_at', 'preparing_at', 'served_at', 'canceled_at', 'printed_at', 'print_confirmed'
        ]
    
    # get_customizations_count removed - OrderItemIngredient functionality deprecated
    
    def get_elapsed_time_minutes(self, obj):
        from django.utils import timezone
        from operation.models import OrderItem
        
        now = timezone.now()
        
        # Buscar el item más antiguo que aún está CREATED (globalmente)
        oldest_pending_item = OrderItem.objects.filter(
            status='CREATED'
        ).order_by('created_at').first()
        
        # Solo el item más antiguo debe contar tiempo
        if oldest_pending_item and oldest_pending_item.id == obj.id:
            elapsed = now - obj.created_at
            return int(elapsed.total_seconds() / 60)
        
        # Todos los otros items no cuentan tiempo
        return 0
    
    def get_is_overdue(self, obj):
        if obj.status == 'SERVED':
            return False
        elapsed = self.get_elapsed_time_minutes(obj)
        return elapsed > obj.recipe.preparation_time
    
    def get_paid_amount(self, obj):
        return obj.get_paid_amount()
    
    def get_pending_amount(self, obj):
        return obj.get_pending_amount()
    
    def get_is_fully_paid(self, obj):
        return obj.is_fully_paid()
    
    def get_container_info(self, obj):
        """
        Obtiene información del contenedor asociado a este item
        """
        # Primero verificar si tiene container directo (nueva arquitectura)
        if obj.container:
            return {
                'container_id': obj.container.id,
                'container_name': obj.container.name,
                'unit_price': float(obj.container_price or obj.container.price),
                'total_price': float((obj.container_price or obj.container.price) * obj.quantity)
            }
        
        # Fallback: buscar en ContainerSale (arquitectura antigua)
        if obj.has_taper and obj.order:
            container_sale = obj.order.container_sales.filter(
                quantity=obj.quantity,
                created_at__gte=obj.created_at
            ).order_by('created_at').first()
            
            if container_sale:
                return {
                    'container_id': container_sale.container.id,
                    'container_name': container_sale.container.name,
                    'unit_price': float(container_sale.unit_price),
                    'total_price': float(container_sale.total_price)
                }
        
        return None
    
    def get_total_with_container(self, obj):
        """
        Obtiene el precio total del item incluyendo el envase
        """
        return float(obj.get_total_with_container())


class OrderSerializer(serializers.ModelSerializer):
    table_number = serializers.CharField(source='table.table_number', read_only=True)
    zone_name = serializers.CharField(source='table.zone.name', read_only=True)
    waiter_name = serializers.CharField(source='waiter', read_only=True)
    items = OrderItemSerializer(source='orderitem_set', many=True, read_only=True)
    items_count = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    is_fully_paid = serializers.SerializerMethodField()
    containers_total = serializers.SerializerMethodField()
    grand_total = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 'table', 'table_number', 'zone_name', 'waiter', 'waiter_name', 'status',
            'customer_name', 'party_size',
            'total_amount', 'containers_total', 'grand_total', 'total_paid', 'pending_amount', 'is_fully_paid',
            'items', 'items_count', 'created_at',
            'served_at', 'paid_at'
        ]
        read_only_fields = [
            'id', 'total_amount', 'containers_total', 'grand_total', 'created_at',
            'served_at', 'paid_at'
        ]
    
    def get_items_count(self, obj):
        return obj.orderitem_set.count()
    
    def get_total_paid(self, obj):
        return obj.get_total_paid()
    
    def get_pending_amount(self, obj):
        return obj.get_pending_amount()
    
    def get_is_fully_paid(self, obj):
        return obj.is_fully_paid()
    
    def get_containers_total(self, obj):
        return obj.get_containers_total()
    
    def get_grand_total(self, obj):
        return obj.get_grand_total()


class ContainerSaleSerializer(serializers.ModelSerializer):
    container_name = serializers.CharField(source='container.name', read_only=True)
    
    class Meta:
        model = ContainerSale
        fields = [
            'id', 'order', 'container', 'container_name', 'quantity', 
            'unit_price', 'total_price', 'created_at'
        ]
        read_only_fields = ['id', 'unit_price', 'total_price', 'created_at']


class OrderDetailSerializerV1(OrderSerializer):
    """Legacy OrderDetailSerializer - renamed to avoid conflict"""
    table_detail = TableSerializer(source='table', read_only=True)
    items = OrderItemSerializer(source='orderitem_set', many=True, read_only=True)
    container_sales = ContainerSaleSerializer(many=True, read_only=True)
    payments = serializers.SerializerMethodField()

    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ['table_detail', 'items', 'container_sales', 'payments']

    def get_payments(self, obj):
        from .serializers import PaymentSerializer
        # Use prefetched payments to avoid N+1 queries
        return PaymentSerializer(obj.payments.all(), many=True).data

    @classmethod
    def setup_eager_loading(cls, queryset):
        """
        Optimize queries for OrderDetailSerializer to prevent N+1 problems
        """
        return queryset.select_related(
            'table',
            'table__zone'
        ).prefetch_related(
            'orderitem_set__recipe',
            'orderitem_set__recipe__group',
            'container_sales__container',
            'payments__payment_items__order_item'
        )


class OrderItemCreateSerializer(serializers.ModelSerializer):
    selected_container = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = OrderItem
        fields = ['recipe', 'notes', 'quantity', 'is_takeaway', 'has_taper', 'selected_container']
    
    def validate(self, data):
        # Si has_taper es True pero no hay selected_container, buscar el primer container disponible
        if data.get('has_taper', False) and not data.get('selected_container'):
            from config.models import Container
            default_container = Container.objects.filter(is_active=True, stock__gt=0).first()
            if default_container:
                data['selected_container'] = default_container.id
            else:
                raise serializers.ValidationError("No hay envases disponibles en stock")
        
        # Validar stock del container seleccionado
        if data.get('selected_container'):
            from config.models import Container
            try:
                container = Container.objects.get(id=data['selected_container'], is_active=True)
                if container.stock <= 0:
                    raise serializers.ValidationError(f"El envase {container.name} no tiene stock disponible")
            except Container.DoesNotExist:
                raise serializers.ValidationError("El envase seleccionado no existe o no está disponible")
        
        return data
    
    def validate_recipe(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Esta receta no está disponible")
        
        if not value.has_sufficient_stock():
            raise serializers.ValidationError("No hay suficiente stock para esta receta")
        
        return value
    
    @transaction.atomic
    def create(self, validated_data):
        """
        Crear UN OrderItem con la quantity original especificada.
        Mantiene la quantity como está en el frontend (1 item con quantity=N).
        """
        print(f"🔧 OrderItemCreateSerializer.create() INICIADO")
        print(f"🔧 validated_data recibido: {validated_data}")
        
        selected_container_id = validated_data.pop('selected_container', None)
        quantity = validated_data.pop('quantity', 1)  # Remover quantity del validated_data
        
        print(f"🔧 quantity extraído: {quantity}")
        print(f"🔧 selected_container_id extraído: {selected_container_id}")
        
        # Obtener order del contexto
        order = self.context.get('order')
        if not order:
            raise serializers.ValidationError("Order not found in context")
        
        # Pre-validar stock de container si aplica
        container = None
        container_price = None
        if validated_data.get('has_taper', False) and selected_container_id:
            from config.models import Container
            try:
                container = Container.objects.select_for_update().get(
                    id=selected_container_id, is_active=True
                )
                if container.stock < quantity:
                    raise serializers.ValidationError(
                        f"Stock insuficiente de {container.name}. "
                        f"Disponible: {container.stock}, Requerido: {quantity}"
                    )
                container_price = container.price
            except Container.DoesNotExist:
                raise serializers.ValidationError(
                    "El envase seleccionado no existe o no está disponible"
                )
        
        # Crear OrderItems individuales para cada cantidad solicitada
        print(f"🔧 CREANDO {quantity} OrderItems individuales para recipe={validated_data.get('recipe', 'Unknown')}")
        print(f"🔧 Order: {order}, Container: {container}, Container_price: {container_price}")
        
        created_items = []
        for i in range(quantity):
            order_item = OrderItem.objects.create(
                order=order,
                container=container,
                container_price=container_price,
                quantity=1,  # Cada OrderItem tiene quantity=1
                **validated_data
            )
            created_items.append(order_item)
            print(f"🔧 OrderItem {i+1}/{quantity} creado: ID={order_item.id}, quantity={order_item.quantity}")
            
            # Calcular el precio total para este item
            order_item.calculate_total_price()
            
            # Consumir ingredientes para este item
            validated_data['recipe'].consume_ingredients()
        
        print(f"🔧 OrderItemCreateSerializer.create() COMPLETADO - Creados {len(created_items)} OrderItems")
        # Retornar el primer item (aunque se crearon varios)
        return created_items[0] if created_items else None


class OrderItemForCreateSerializer(serializers.ModelSerializer):
    """Serializer para items cuando se crean dentro de una orden nueva"""
    selected_container = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = OrderItem
        fields = ['recipe', 'notes', 'quantity', 'is_takeaway', 'has_taper', 'selected_container']
    
    def validate_recipe(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Esta receta no está disponible")
        
        if not value.has_sufficient_stock():
            raise serializers.ValidationError("No hay suficiente stock para esta receta")
        
        return value


class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemForCreateSerializer(many=True, write_only=True)
    
    class Meta:
        model = Order
        fields = ['table', 'waiter', 'customer_name', 'party_size', 'items']
    
    def validate_customer_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("El nombre del cliente es obligatorio")
        return value.strip()
    
    def validate_party_size(self, value):
        if not value or value < 1:
            raise serializers.ValidationError("La cantidad de personas debe ser mayor a 0")
        if value > 100:
            raise serializers.ValidationError("La cantidad de personas no puede ser mayor a 100")
        return value
    
    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("La orden debe tener al menos un item")
        return value
    
    @transaction.atomic
    def create(self, validated_data):
        """
        Crear orden con transacción atómica para garantizar consistencia.
        Si cualquier operación falla, toda la transacción se revierte.
        """
        items_data = validated_data.pop('items')
        
        # DEBUG: Log before creating order
        print(f"🔍 DEBUG ORDER CREATE - validated_data: {validated_data}")
        print(f"🔍 DEBUG ORDER CREATE - items count: {len(items_data)}")
        
        # Crear orden
        order = Order.objects.create(**validated_data)
        
        # DEBUG: Log after creating order
        print(f"🔍 DEBUG ORDER CREATED - Order ID: {order.id}, Status: {order.status}, Table: {order.table_id}")
        
        # Pre-validar stock de containers antes de crear items
        containers_to_reduce = []
        for item_data in items_data:
            selected_container_id = item_data.get('selected_container')
            quantity = item_data.get('quantity', 1)
            has_taper = item_data.get('has_taper', False)
            
            if has_taper and selected_container_id:
                from config.models import Container
                try:
                    container = Container.objects.select_for_update().get(
                        id=selected_container_id, is_active=True
                    )
                    if container.stock < quantity:
                        raise serializers.ValidationError(
                            f"Stock insuficiente de {container.name}. "
                            f"Disponible: {container.stock}, Requerido: {quantity}"
                        )
                    containers_to_reduce.append((container, quantity))
                except Container.DoesNotExist:
                    raise serializers.ValidationError(
                        f"El envase seleccionado no existe o no está disponible"
                    )
        
        # Crear items y containers (ya validado el stock)
        for item_data in items_data:
            selected_container_id = item_data.pop('selected_container', None)
            quantity = item_data.pop('quantity', 1)  # Remover quantity del item_data
            
            # Obtener información del container para este item
            container = None
            container_price = None
            if selected_container_id:
                # Buscar container usando Django ORM
                try:
                    from config.models import Container
                    container = Container.objects.get(id=selected_container_id, is_active=True)
                    container_price = container.price
                except Container.DoesNotExist:
                    container = None
                    container_price = None
            
            # Crear OrderItems individuales (uno por cada cantidad)
            created_items = []
            for i in range(quantity):
                order_item = OrderItem.objects.create(
                    order=order, 
                    container=container,
                    container_price=container_price,
                    quantity=1,  # Cada OrderItem tiene quantity=1
                    **item_data
                )
                created_items.append(order_item)
            
            # Crear ContainerSale si aplica (usar el primer item como referencia)
            first_item = created_items[0] if created_items else None
            if first_item and first_item.has_taper and selected_container_id:
                container = next(
                    (c for c, q in containers_to_reduce if c.id == selected_container_id), 
                    None
                )
                # DESHABILITADO: El descuento de stock y ContainerSale ahora se maneja automáticamente en OrderItem.save()
                pass
        
        # Consumir ingredientes
        order.consume_ingredients_on_creation()
        
        return order


class OrderDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para GET y UPDATE de órdenes"""
    table = TableSerializer(read_only=True)
    items = serializers.SerializerMethodField()
    container_sales = ContainerSaleSerializer(many=True, read_only=True)
    payments = serializers.SerializerMethodField()
    
    # Para actualización
    items_data = OrderItemForCreateSerializer(many=True, write_only=True, required=False)
    container_sales_data = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )
    
    # Campos calculados
    total_paid = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    is_fully_paid = serializers.SerializerMethodField()
    containers_total = serializers.SerializerMethodField()
    grand_total = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 'table', 'waiter', 'customer_name', 'party_size', 'status', 'total_amount', 'items', 'container_sales', 'payments',
            'items_data', 'container_sales_data',
            'total_paid', 'pending_amount', 'is_fully_paid', 'containers_total', 'grand_total',
            'created_at', 'preparing_at', 'served_at', 'paid_at'
        ]
        read_only_fields = ['id', 'created_at', 'preparing_at', 'served_at', 'paid_at']
    
    def get_items(self, obj):
        return OrderItemSerializer(obj.orderitem_set.all(), many=True).data
    
    def get_payments(self, obj):
        # Retornar datos básicos de payments sin usar PaymentSerializer
        return [
            {
                'id': payment.id,
                'payment_method': payment.payment_method,
                'amount': payment.amount,
                'created_at': payment.created_at,
                'payer_name': payment.payer_name
            }
            for payment in obj.payments.all()
        ]
    
    def get_total_paid(self, obj):
        return obj.get_total_paid()
    
    def get_pending_amount(self, obj):
        return obj.get_pending_amount()
    
    def get_is_fully_paid(self, obj):
        return obj.is_fully_paid()
    
    def get_containers_total(self, obj):
        return obj.get_containers_total()
    
    def get_grand_total(self, obj):
        return obj.get_grand_total()
    
    @staticmethod
    def setup_eager_loading(queryset):
        return queryset.select_related('table__zone').prefetch_related(
            'orderitem_set__recipe__group',
            'container_sales__container',
            'payments__payment_items__order_item__recipe'
        )
    
    @transaction.atomic
    def update(self, instance, validated_data):
        """Actualizar orden con nuevos items y container sales"""
        # Update order processing
        
        items_data = validated_data.pop('items_data', None)
        container_sales_data = validated_data.pop('container_sales_data', None)
        
# Debug: Items data processing
# Debug: Container sales data processing
        
        # Actualizar campos básicos
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if items_data is not None:
            # Eliminar items existentes
            instance.orderitem_set.all().delete()
            instance.container_sales.all().delete()
            
            # Crear nuevos items
            for item_data in items_data:
                selected_container_id = item_data.pop('selected_container', None)
                quantity = item_data.get('quantity', 1)
                
                try:
                    # Crear OrderItem
                    order_item = OrderItem.objects.create(order=instance, **item_data)
                    
                    # DESHABILITADO: ContainerSale se crea automáticamente en OrderItem.save()
                    # No crear ContainerSale aquí para evitar duplicación
                            
                except Exception as e:
                    raise
            
            # DESHABILITADO: ContainerSales se crean automáticamente en OrderItem.save()
            # No crear ContainerSales adicionales aquí para evitar duplicación
        
        # Recalcular totales
        instance.calculate_total()
        
        return instance


# OrderItemIngredientCreateSerializer removed - functionality deprecated


class PaymentItemSerializer(serializers.ModelSerializer):
    order_item_name = serializers.CharField(source='order_item.recipe.name', read_only=True)
    order_item_price = serializers.DecimalField(source='order_item.total_price', max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = PaymentItem
        fields = [
            'id', 'payment', 'order_item', 'order_item_name', 
            'order_item_price', 'amount', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class PaymentSerializer(serializers.ModelSerializer):
    order_table = serializers.CharField(source='order.table.table_number', read_only=True)
    order_total = serializers.DecimalField(source='order.total_amount', max_digits=10, decimal_places=2, read_only=True)
    payment_items = PaymentItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id', 'order', 'order_table', 'order_total', 'payment_method',
            'tax_amount', 'amount', 'payer_name', 'split_group', 'notes', 
            'payment_items', 'created_at', 'receipt_printed_at'
        ]
        read_only_fields = ['id', 'created_at', 'receipt_printed_at']
    
    def validate(self, data):
        order = data['order']
        
        # Verificar que el order esté en estado SERVED (permite pagos parciales de items servidos)
        if order.status != 'SERVED':
            raise serializers.ValidationError("Solo se pueden procesar pagos para órdenes en estado SERVED")
        
        # Verificar que no se pague más del total pendiente
        pending = order.get_pending_amount()
        if data['amount'] > pending:
            raise serializers.ValidationError(f"El monto excede el pendiente de pago: {pending}")
        
        return data


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.STATUS_CHOICES)
    
    def validate_status(self, value):
        order = self.context['order']
        
        # Validar transiciones de estado válidas para ORDER (no OrderItem)
        # Nota: Las órdenes SÍ pueden ir de CREATED → SERVED (cuando el mesero cierra todo)
        # pero los OrderItems individuales NO pueden (deben pasar por PREPARING)
        valid_transitions = {
            'CREATED': ['PREPARING', 'SERVED', 'PAID', 'CANCELED'],  # Order puede saltarse PREPARING
            'PREPARING': ['SERVED', 'PAID', 'CANCELED'],
            'SERVED': ['PAID', 'CANCELED'],
            'PAID': [],
            'CANCELED': []
        }
        
        if value not in valid_transitions.get(order.status, []):
            raise serializers.ValidationError(
                f"No se puede cambiar de {order.status} a {value}"
            )
        
        return value


class SplitPaymentSerializer(serializers.Serializer):
    """Serializer para manejar pagos divididos"""
    splits = serializers.ListField(
        child=serializers.DictField(),
        write_only=True
    )
    
    def validate_splits(self, value):
        """
        Valida que los splits tengan el formato correcto:
        [
            {
                "items": [1, 2, 3],  # IDs de OrderItems
                "payment_method": "CASH",
                "amount": 50.00,
                "payer_name": "Juan",
                "notes": "Paga por sus platos"
            },
            ...
        ]
        """
        if not value:
            raise serializers.ValidationError("Debe incluir al menos un split de pago")
        
        for split in value:
            if 'items' not in split or not split['items']:
                raise serializers.ValidationError("Cada split debe incluir items")
            if 'payment_method' not in split:
                raise serializers.ValidationError("Cada split debe incluir payment_method")
            if 'amount' not in split:
                raise serializers.ValidationError("Cada split debe incluir amount")
        
        return value
    
    def create(self, validated_data):
        order = self.context['order']
        splits = validated_data['splits']
        split_group = str(uuid.uuid4())
        
        payments = []
        for split_data in splits:
            # Crear el pago
            payment = Payment.objects.create(
                order=order,
                payment_method=split_data['payment_method'],
                amount=Decimal(str(split_data['amount'])),
                payer_name=split_data.get('payer_name', ''),
                notes=split_data.get('notes', ''),
                split_group=split_group,
                tax_amount=Decimal('0.00')  # Se puede calcular proporcionalmente si es necesario
            )
            
            # Asociar items al pago
            for item_id in split_data['items']:
                try:
                    order_item = OrderItem.objects.get(id=item_id, order=order)
                    # Calcular proporción del item
                    item_amount = order_item.total_price / len([s for s in splits if item_id in s.get('items', [])])
                    
                    PaymentItem.objects.create(
                        payment=payment,
                        order_item=order_item,
                        amount=item_amount
                    )
                except OrderItem.DoesNotExist:
                    pass
            
            payments.append(payment)
        
        return payments


# ===== CART SERIALIZERS ELIMINADOS =====
# Sistema Cart eliminado para simplificar operaciones
