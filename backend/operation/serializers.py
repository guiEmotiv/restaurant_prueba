from rest_framework import serializers
from .models import Order, OrderItem, OrderItemIngredient, Payment
from config.serializers import TableSerializer
from inventory.serializers import RecipeSerializer, IngredientSerializer


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
    customizations = OrderItemIngredientSerializer(source='orderitemingredient_set', many=True, read_only=True)
    customizations_count = serializers.SerializerMethodField()
    elapsed_time_minutes = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderItem
        fields = [
            'id', 'recipe', 'recipe_name', 'recipe_preparation_time', 'unit_price', 'total_price',
            'status', 'notes', 'customizations', 'customizations_count',
            'elapsed_time_minutes', 'is_overdue',
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


class OrderSerializer(serializers.ModelSerializer):
    table_number = serializers.CharField(source='table.table_number', read_only=True)
    zone_name = serializers.CharField(source='table.zone.name', read_only=True)
    items_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 'table', 'table_number', 'zone_name', 'status',
            'total_amount', 'items_count', 'created_at',
            'served_at', 'paid_at'
        ]
        read_only_fields = [
            'id', 'total_amount', 'created_at',
            'served_at', 'paid_at'
        ]
    
    def get_items_count(self, obj):
        return obj.orderitem_set.count()


class OrderDetailSerializer(OrderSerializer):
    table_detail = TableSerializer(source='table', read_only=True)
    items = OrderItemSerializer(source='orderitem_set', many=True, read_only=True)
    
    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ['table_detail', 'items']


class OrderItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['order', 'recipe', 'notes']
    
    def validate_recipe(self, value):
        if not value.is_available:
            raise serializers.ValidationError("Esta receta no está disponible")
        
        if not value.check_availability():
            raise serializers.ValidationError("No hay suficiente stock para esta receta")
        
        return value


class OrderItemForCreateSerializer(serializers.ModelSerializer):
    """Serializer para items cuando se crean dentro de una orden nueva"""
    class Meta:
        model = OrderItem
        fields = ['recipe', 'notes']
    
    def validate_recipe(self, value):
        if not value.is_available:
            raise serializers.ValidationError("Esta receta no está disponible")
        
        if not value.check_availability():
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


class PaymentSerializer(serializers.ModelSerializer):
    order_table = serializers.CharField(source='order.table.table_number', read_only=True)
    order_total = serializers.DecimalField(source='order.total_amount', max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id', 'order', 'order_table', 'order_total', 'payment_method',
            'tax_amount', 'amount', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def validate(self, data):
        order = data['order']
        
        # Verificar que la orden no esté ya pagada
        if hasattr(order, 'payment'):
            raise serializers.ValidationError("Esta orden ya tiene un pago registrado")
        
        # Verificar que la orden esté servida
        if order.status != 'SERVED':
            raise serializers.ValidationError("Solo se pueden pagar órdenes entregadas")
        
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