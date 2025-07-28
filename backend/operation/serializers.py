from rest_framework import serializers
from .models import Order, OrderItem, OrderItemIngredient, Payment, PaymentItem
from config.serializers import TableSerializer
from inventory.serializers import RecipeSerializer, IngredientSerializer
from decimal import Decimal
import uuid


class OrderItemIngredientSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source='ingredient.name', read_only=True)
    ingredient_unit = serializers.CharField(source='ingredient.unit.name', read_only=True)
    
    class Meta:
        model = OrderItemIngredient
        fields = [
            'id', 'ingredient', 'ingredient_name', 'ingredient_unit',
            'quantity', 'unit_price', 'total_price', 'created_at'
        ]
        read_only_fields = ['id', 'unit_price', 'total_price', 'created_at']


class OrderItemSerializer(serializers.ModelSerializer):
    recipe_name = serializers.CharField(source='recipe.name', read_only=True)
    recipe_preparation_time = serializers.IntegerField(source='recipe.preparation_time', read_only=True)
    order_zone = serializers.CharField(source='order.table.zone.name', read_only=True)
    order_table = serializers.CharField(source='order.table.table_number', read_only=True)
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    customizations = OrderItemIngredientSerializer(source='orderitemingredient_set', many=True, read_only=True)
    customizations_count = serializers.SerializerMethodField()
    elapsed_time_minutes = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    is_fully_paid = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderItem
        fields = [
            'id', 'recipe', 'recipe_name', 'recipe_preparation_time', 'unit_price', 'total_price',
            'status', 'notes', 'order_zone', 'order_table', 'order_id',
            'customizations', 'customizations_count',
            'elapsed_time_minutes', 'is_overdue',
            'paid_amount', 'pending_amount', 'is_fully_paid',
            'created_at', 'served_at'
        ]
        read_only_fields = [
            'id', 'unit_price', 'total_price', 'created_at', 'served_at'
        ]
    
    def get_customizations_count(self, obj):
        return obj.orderitemingredient_set.count()
    
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


class OrderSerializer(serializers.ModelSerializer):
    table_number = serializers.CharField(source='table.table_number', read_only=True)
    zone_name = serializers.CharField(source='table.zone.name', read_only=True)
    items_count = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    pending_amount = serializers.SerializerMethodField()
    is_fully_paid = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 'table', 'table_number', 'zone_name', 'status',
            'total_amount', 'total_paid', 'pending_amount', 'is_fully_paid',
            'items_count', 'created_at',
            'served_at', 'paid_at', 'operational_date'
        ]
        read_only_fields = [
            'id', 'total_amount', 'created_at',
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


class OrderDetailSerializer(OrderSerializer):
    table_detail = TableSerializer(source='table', read_only=True)
    items = OrderItemSerializer(source='orderitem_set', many=True, read_only=True)
    payments = serializers.SerializerMethodField()
    
    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ['table_detail', 'items', 'payments']
    
    def get_payments(self, obj):
        from .serializers import PaymentSerializer
        return PaymentSerializer(obj.payments.all(), many=True).data


class OrderItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['order', 'recipe', 'notes']
    
    def validate_recipe(self, value):
        if not value.is_active:
            raise serializers.ValidationError("Esta receta no está disponible")
        
        if not value.has_sufficient_stock():
            raise serializers.ValidationError("No hay suficiente stock para esta receta")
        
        return value


class OrderItemForCreateSerializer(serializers.ModelSerializer):
    """Serializer para items cuando se crean dentro de una orden nueva"""
    class Meta:
        model = OrderItem
        fields = ['recipe', 'notes']
    
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
        fields = ['table', 'items']
    
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        
        # Crear orden
        order = Order.objects.create(**validated_data)
        
        # Crear items
        for item_data in items_data:
            OrderItem.objects.create(order=order, **item_data)
        
        # Consumir ingredientes
        order.consume_ingredients_on_creation()
        
        return order


class OrderItemIngredientCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItemIngredient
        fields = ['ingredient', 'quantity']
    
    def validate(self, data):
        order_item = self.context['order_item']
        ingredient = data['ingredient']
        
        # Verificar que el OrderItem se puede modificar
        if not order_item.can_be_modified():
            raise serializers.ValidationError(
                "Solo se pueden agregar ingredientes a items con status CREATED"
            )
        
        # Verificar que no exista ya este ingrediente en el item
        if OrderItemIngredient.objects.filter(order_item=order_item, ingredient=ingredient).exists():
            raise serializers.ValidationError(
                f"El ingrediente {ingredient.name} ya está agregado a este item"
            )
        
        return data


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
            'payment_items', 'created_at', 'operational_date'
        ]
        read_only_fields = ['id', 'created_at', 'operational_date']
    
    def validate(self, data):
        order = data['order']
        
        # Verificar que la orden esté servida
        if order.status != 'SERVED':
            raise serializers.ValidationError("Solo se pueden pagar órdenes entregadas")
        
        # Verificar que no se pague más del total pendiente
        pending = order.get_pending_amount()
        if data['amount'] > pending:
            raise serializers.ValidationError(f"El monto excede el pendiente de pago: {pending}")
        
        return data


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.STATUS_CHOICES)
    
    def validate_status(self, value):
        order = self.context['order']
        
        # Validar transiciones de estado válidas
        valid_transitions = {
            'CREATED': ['SERVED'],
            'SERVED': ['PAID'],
            'PAID': []
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