from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache
from django.core.exceptions import ValidationError
from backend.cognito_permissions import (
    CognitoAdminOnlyPermission, 
    CognitoWaiterAndAdminPermission, 
    CognitoOrderStatusPermission,
    CognitoPaymentPermission
)
# Rate limiting moved to Nginx - no longer using Django decorators
from .models import Order, OrderItem, Payment, PaymentItem, ContainerSale
from .serializers import (
    OrderSerializer, OrderDetailSerializer, OrderCreateSerializer,
    OrderItemSerializer, OrderItemCreateSerializer,
    # OrderItemIngredient serializers removed - functionality deprecated
    PaymentSerializer, OrderStatusUpdateSerializer, SplitPaymentSerializer,
    ContainerSaleSerializer
)


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related('table__zone').prefetch_related(
        'orderitem_set__recipe__group',
        'container_sales__container',
        'payments'
    ).order_by('-created_at')
    pagination_class = None  # Deshabilitar paginación para órdenes
    
    def get_serializer_class(self):
        if self.action == 'create':
            return OrderCreateSerializer
        elif self.action in ['retrieve', 'update', 'partial_update']:
            return OrderDetailSerializer
        return OrderSerializer
    
    def get_queryset(self):
        # Base queryset with common optimizations
        queryset = Order.objects.select_related('table__zone').prefetch_related(
            'orderitem_set__recipe__group',
            'container_sales__container',
            'payments'
        ).order_by('-created_at')
        
        # Further optimize if using detail serializer (retrieve, update)
        if self.action in ['retrieve', 'update', 'partial_update']:
            queryset = OrderDetailSerializer.setup_eager_loading(queryset)
        
        status_filter = self.request.query_params.get('status')
        table = self.request.query_params.get('table')
        zone = self.request.query_params.get('zone')
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if table:
            queryset = queryset.filter(table_id=table)
        if zone:
            queryset = queryset.filter(table__zone_id=zone)
            
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Override create to return full order details after creation"""
        # Buscar pedido activo existente para la mesa
        table_id = request.data.get('table')
        if table_id:
            active_order = Order.objects.filter(
                table_id=table_id, 
                status__in=['CREATED', 'SERVED']
            ).first()
            
            if active_order:
                # Si ya existe un pedido activo, agregar items a ese pedido
                items = request.data.get('items', [])
                if not items:
                    return Response(
                        {'error': 'La orden debe tener al menos un item'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Actualizar información del cliente si se proporciona
                customer_name = request.data.get('customer_name')
                party_size = request.data.get('party_size')
                
                if customer_name:
                    active_order.customer_name = customer_name
                if party_size:
                    active_order.party_size = party_size
                active_order.save()
                
                # Agregar items al pedido existente
                for item_data in items:
                    OrderItem.objects.create(
                        order=active_order,
                        recipe_id=item_data.get('recipe'),
                        quantity=item_data.get('quantity', 1),
                        notes=item_data.get('notes', ''),
                        is_takeaway=item_data.get('is_takeaway', False),
                        has_taper=item_data.get('has_taper', False),
                        container_id=item_data.get('selected_container')
                    )
                
                # Recalcular total del pedido
                active_order.calculate_total()
                
                # Devolver el pedido actualizado con detalles completos
                serializer = OrderDetailSerializer(active_order, context={'request': request})
                return Response(serializer.data, status=status.HTTP_200_OK)
        
        # Si no hay pedido activo, crear uno nuevo
        # Validación adicional antes del serializer
        items = request.data.get('items', [])
        if not items:
            return Response(
                {'error': 'La orden debe tener al menos un item'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        
        # Optimize the query for OrderDetailSerializer
        optimized_order = OrderDetailSerializer.setup_eager_loading(
            Order.objects.filter(id=order.id)
        ).first()
        
        # Return the order with full details using OrderDetailSerializer
        response_serializer = OrderDetailSerializer(optimized_order)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Actualizar estado de una orden"""
        order = self.get_object()
        serializer = OrderStatusUpdateSerializer(
            data=request.data,
            context={'order': order}
        )
        
        if serializer.is_valid():
            new_status = serializer.validated_data['status']
            cancellation_reason = request.data.get('cancellation_reason', '')
            order.update_status(new_status, cancellation_reason=cancellation_reason)
            
            response_serializer = OrderDetailSerializer(order)
            return Response(response_serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancelar una orden completa"""
        order = self.get_object()
        
        # Verificar que el pedido puede ser cancelado
        if order.status in ['PAID', 'CANCELED']:
            return Response(
                {'error': f'No se puede cancelar un pedido con estado {order.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        cancellation_reason = request.data.get('cancellation_reason', '')
        if not cancellation_reason:
            return Response(
                {'error': 'El motivo de cancelación es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Cancelar el pedido y todos sus items
        order.update_status('CANCELED', cancellation_reason=cancellation_reason)
        
        # Cancelar todos los items del pedido
        for item in order.orderitem_set.all():
            if item.status not in ['PAID', 'CANCELED']:
                item.status = 'CANCELED'
                item.cancellation_reason = cancellation_reason
                item.canceled_at = timezone.now()
                item.save()
        
        response_serializer = OrderDetailSerializer(order)
        return Response(response_serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        """Agregar item a una orden existente"""
        import logging
        logger = logging.getLogger(__name__)
        
        order = self.get_object()
        
        # Debug logging
        logger.error(f"ADD_ITEM DEBUG - Order ID: {order.id}, Status: {order.status}")
        logger.error(f"ADD_ITEM DEBUG - Request data: {request.data}")
        
        if order.status not in ['CREATED', 'PREPARING']:
            return Response(
                {'error': 'Solo se pueden agregar items a órdenes con status CREATED o PREPARING'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = OrderItemCreateSerializer(data=request.data, context={'order': order})
        if serializer.is_valid():
            try:
                order_item = serializer.save()
                order.calculate_total()
                
                # Si el pedido estaba en PREPARING, regresarlo a CREATED para que aparezca en cocina
                if order.status == 'PREPARING':
                    order.status = 'CREATED'
                    order.save()
                    logger.error(f"ADD_ITEM DEBUG - Order {order.id} status changed from PREPARING to CREATED")
                
                response_serializer = OrderItemSerializer(order_item)
                return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"ADD_ITEM DEBUG - Exception during save: {str(e)}")
                return Response({
                    'error': 'Error interno al crear el item',
                    'details': str(e)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Debug logging para errores
        logger.error(f"ADD_ITEM DEBUG - Serializer errors: {serializer.errors}")
        return Response({
            'error': 'Datos inválidos',
            'details': serializer.errors,
            'received_data': request.data
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Obtener todas las órdenes activas (no pagadas ni canceladas)"""
        orders = Order.objects.filter(
            status__in=['CREATED', 'SERVED']
        ).order_by('-created_at')
        
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def kitchen(self, request):
        """Vista para la cocina - órdenes activas con items pendientes"""
        # Cache por 5 segundos
        cache_key = 'kitchen_view_orders'
        cached_data = cache.get(cache_key)
        
        if cached_data is not None:
            return Response(cached_data)
        
        # Solo órdenes CREATED (no canceladas/pagadas) que tienen items CREATED
        orders = Order.objects.filter(
            status='CREATED',
            orderitem__status='CREATED'
        ).select_related('table__zone').prefetch_related(
            'orderitem_set__recipe__group'
        ).distinct().order_by('created_at')[:50]  # Limitar resultados
        
        serializer = OrderDetailSerializer(orders, many=True)
        data = serializer.data
        
        # Cache por 5 segundos
        cache.set(cache_key, data, 5)
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def kitchen_board(self, request):
        """Vista de tablero de cocina - cada OrderItem individual como entrada separada"""
        # Cache por 2 segundos para mejor sincronización multi-usuario
        cache_key = 'kitchen_board_data'
        cached_data = cache.get(cache_key)
        
        if cached_data is not None:
            return Response(cached_data)
        from django.db.models import Q
        
        # Obtener todos los order items que están pendientes (CREATED, PREPARING, SERVED)
        # Incluir SERVED para que se vean tachados en la vista de cocina
        order_items = OrderItem.objects.filter(
            status__in=['CREATED', 'PREPARING', 'SERVED']
        ).exclude(
            order__status='PAID'  # Excluir solo órdenes ya pagadas
        ).select_related('recipe', 'recipe__group', 'order', 'order__table', 'order__table__zone').order_by('created_at')
        
        # Crear entrada separada para cada OrderItem individual
        result = []
        for item in order_items:
            # Calcular tiempo transcurrido desde la creación
            from django.utils import timezone
            elapsed_minutes = int((timezone.now() - item.created_at).total_seconds() / 60)
            is_overdue = elapsed_minutes > item.recipe.preparation_time
            
            item_data = {
                'id': item.id,
                'order_id': item.order.id,
                'order_table': item.order.table.table_number,
                'order_zone': item.order.table.zone.name,
                'waiter_name': item.order.waiter if item.order.waiter else 'Sin mesero',
                'status': item.status,
                'notes': item.notes,
                'is_takeaway': item.is_takeaway,
                'created_at': item.created_at.isoformat(),
                'preparing_at': item.preparing_at.isoformat() if item.preparing_at else None,
                'elapsed_time_minutes': elapsed_minutes,
                'preparation_time': item.recipe.preparation_time,
                'is_overdue': is_overdue,
                'customizations_count': 0,  # OrderItemIngredient fue eliminado
                'recipe_group_name': item.recipe.group.name if item.recipe.group else 'Sin Grupo',
                'recipe_group_id': item.recipe.group.id if item.recipe.group else None
            }
            
            # Cada OrderItem se convierte en una entrada separada con un solo item
            result.append({
                'recipe_name': item.recipe.name,
                'recipe_group_name': item.recipe.group.name if item.recipe.group else 'Sin Grupo',
                'recipe_group_id': item.recipe.group.id if item.recipe.group else None,
                'total_items': 1,  # Siempre 1 porque cada entrada es un item individual
                'pending_items': 1 if item.status == 'CREATED' else 0,
                'served_items': 1 if item.status == 'SERVED' else 0,
                'overdue_items': 1 if is_overdue else 0,
                'items': [item_data]  # Array con un solo item
            })
        
        # Ordenar por urgencia: primero los retrasados, luego por tiempo de creación
        result.sort(key=lambda x: (
            -x['overdue_items'],  # Retrasados primero (orden descendente)
            x['items'][0]['created_at']  # Luego por tiempo de creación (más antiguos primero)
        ))
        
        # Cache por 2 segundos para mejor sincronización multi-usuario
        cache.set(cache_key, result, 2)
        return Response(result)
    
    @action(detail=True, methods=['post'])
    def process_payment(self, request, pk=None):
        """Procesar pago completo de una orden"""
        from django.db import transaction
        
        order = self.get_object()
        
        # Verificar que la orden puede ser pagada
        if order.status == 'PAID':
            return Response({'error': 'La orden ya está pagada'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Verificar que todos los items estén servidos
        if not order.orderitem_set.filter(status='CREATED').count() == 0:
            return Response(
                {'error': 'No se puede procesar pago: hay items pendientes de entrega'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        payment_data = request.data
        required_fields = ['payment_method', 'amount']
        
        for field in required_fields:
            if field not in payment_data:
                return Response({'error': f'Campo requerido: {field}'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                # Crear el pago
                from .models import Payment
                payment = Payment.objects.create(
                    order=order,
                    payment_method=payment_data['payment_method'],
                    amount=float(payment_data['amount']),
                    tax_amount=float(payment_data.get('tax_amount', 0)),
                    payer_name=payment_data.get('payer_name', ''),
                    notes=payment_data.get('notes', '')
                )
                
                # Actualizar estado de la orden
                order.status = 'PAID'
                order.save()
                
                # Serializar respuesta
                response_serializer = OrderDetailSerializer(order)
                return Response({
                    'message': 'Pago procesado exitosamente',
                    'payment_id': payment.id,
                    'order': response_serializer.data
                }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response({'error': f'Error procesando pago: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def process_split_payment(self, request, pk=None):
        """Procesar pago dividido de una orden"""
        from django.db import transaction
        
        order = self.get_object()
        split_data = request.data
        
        # Verificar que la orden puede ser pagada
        if order.status == 'PAID':
            return Response({'error': 'La orden ya está pagada'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                from .models import Payment, PaymentItem
                
                # Crear el pago principal
                payment = Payment.objects.create(
                    order=order,
                    payment_method=split_data['payment_method'],
                    amount=float(split_data['total_amount']),
                    payer_name=split_data.get('payer_name', ''),
                    split_group=split_data.get('split_group', ''),
                    notes=split_data.get('notes', ''),
                    is_split=True
                )
                
                # Crear PaymentItems para los items seleccionados
                total_paid = 0
                for item_data in split_data.get('items', []):
                    order_item = order.orderitem_set.get(id=item_data['item_id'])
                    PaymentItem.objects.create(
                        payment=payment,
                        order_item=order_item,
                        amount_paid=float(item_data['amount'])
                    )
                    total_paid += float(item_data['amount'])
                
                # Verificar si la orden está completamente pagada - OPTIMIZADO
                if order.is_fully_paid:
                    order.status = 'PAID'
                    order.save()
                
                response_serializer = OrderDetailSerializer(order)
                return Response({
                    'message': 'Pago dividido procesado exitosamente',
                    'payment_id': payment.id,
                    'order': response_serializer.data
                }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response({'error': f'Error procesando pago dividido: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], permission_classes=[CognitoAdminOnlyPermission])
    def reset_all(self, request):
        """Reiniciar todos los pedidos (solo para desarrollo/admin)"""
        try:
            from django.db import connection
            
            # Eliminar todos los datos relacionados con pedidos
            PaymentItem.objects.all().delete()
            Payment.objects.all().delete()
            ContainerSale.objects.all().delete()
            OrderItem.objects.all().delete()
            Order.objects.all().delete()
            
            # Reiniciar el contador de autoincremento en SQLite
            with connection.cursor() as cursor:
                cursor.execute('DELETE FROM sqlite_sequence WHERE name="operation_order"')
                cursor.execute('DELETE FROM sqlite_sequence WHERE name="operation_orderitem"')
                cursor.execute('DELETE FROM sqlite_sequence WHERE name="operation_payment"')
                cursor.execute('DELETE FROM sqlite_sequence WHERE name="operation_containersale"')
            
            return Response({
                'message': '✅ Todos los pedidos han sido eliminados y contadores reiniciados',
                'status': 'success'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': f'Error al reiniciar pedidos: {str(e)}',
                'status': 'error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def served(self, request):
        """Vista para pagos - órdenes que pueden ser pagadas (SERVED o con items PREPARING/SERVED)"""
        # Mostrar órdenes que tienen items listos para pagar:
        # 1. Órdenes en estado SERVED (cerradas por mesero)
        # 2. Órdenes que tienen items en estado PREPARING o SERVED (pueden pagarse directamente)
        from django.db.models import Q
        orders = Order.objects.filter(
            Q(status='SERVED') |  # Órdenes cerradas
            Q(orderitem__status__in=['PREPARING', 'SERVED'])  # O con items procesables
        ).distinct().order_by('-created_at')
        
        serializer = OrderDetailSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def split_payment(self, request, pk=None):
        """Crear pagos divididos para una orden"""
        order = self.get_object()
        
        # Verificar que todos los items estén servidos
        all_items_served = order.orderitem_set.exists() and order.orderitem_set.filter(status='CREATED').count() == 0
        if not all_items_served:
            return Response(
                {'error': 'Solo se pueden pagar órdenes cuando todos los items han sido entregados'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar que no esté completamente pagada
        if order.is_fully_paid():
            return Response(
                {'error': 'Esta orden ya está completamente pagada'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = SplitPaymentSerializer(
            data=request.data,
            context={'order': order}
        )
        
        if serializer.is_valid():
            with transaction.atomic():
                payments = serializer.save()
                
            # Retornar la orden actualizada con pagos
            response_serializer = OrderDetailSerializer(order)
            return Response(response_serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OrderItemViewSet(viewsets.ModelViewSet):
    queryset = OrderItem.objects.all().order_by('-created_at')
    pagination_class = None  # Deshabilitar paginación para order items
    serializer_class = OrderItemSerializer
    permission_classes = [AllowAny]  # Acceso completo en desarrollo
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return OrderItemCreateSerializer
        return OrderItemSerializer
    
    def get_queryset(self):
        queryset = OrderItem.objects.all().order_by('-created_at')
        order = self.request.query_params.get('order')
        status_filter = self.request.query_params.get('status')
        recipe = self.request.query_params.get('recipe')
        
        if order:
            queryset = queryset.filter(order_id=order)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if recipe:
            queryset = queryset.filter(recipe_id=recipe)
            
        return queryset
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancelar un item de orden"""
        order_item = self.get_object()
        
        # Verificar que el item puede ser cancelado
        if order_item.status in ['PAID', 'CANCELED']:
            return Response(
                {'error': f'No se puede cancelar un item con estado {order_item.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        cancellation_reason = request.data.get('cancellation_reason', '')
        if not cancellation_reason:
            return Response(
                {'error': 'El motivo de cancelación es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Cancelar el item
        order_item.status = 'CANCELED'
        order_item.cancellation_reason = cancellation_reason
        order_item.canceled_at = timezone.now()
        order_item.save()
        
        # Invalidar cache
        cache.delete('kitchen_board_data')
        
        serializer = OrderItemSerializer(order_item)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Actualizar estado de un item de orden"""
        order_item = self.get_object()
        new_status = request.data.get('status')
        
        
        if not new_status:
            return Response(
                {'error': 'Se requiere el status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            if new_status == 'CANCELED':
                cancellation_reason = request.data.get('cancellation_reason', '')
                if not cancellation_reason:
                    return Response(
                        {'error': 'El motivo de cancelación es requerido para cancelar'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                order_item.cancellation_reason = cancellation_reason
                order_item.canceled_at = timezone.now()
            
            order_item.update_status(new_status)
            
            # CRITICAL: Invalidate kitchen_board cache immediately after status update
            cache.delete('kitchen_board_data')
            
            serializer = OrderItemSerializer(order_item)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to check if item can be deleted"""
        order_item = self.get_object()
        
        # Solo permitir eliminación si el item está en estado CREATED
        if not order_item.can_be_modified():
            return Response(
                {'error': 'No se puede eliminar un item que ya está en preparación o servido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Si es válido, proceder con la eliminación normal
        return super().destroy(request, *args, **kwargs)
    
    # add_ingredient method removed - OrderItemIngredient functionality deprecated
    
    @action(detail=True, methods=['post'])
    def process_payment(self, request, pk=None):
        """Procesar pago individual de un OrderItem"""
        order_item = self.get_object()
        
        # Verificar que el item está en estado SERVED
        if order_item.status != 'SERVED':
            return Response(
                {'error': 'Solo se pueden pagar items que han sido entregados'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar que el item no esté ya pagado
        if order_item.is_fully_paid():
            return Response(
                {'error': 'Este item ya está completamente pagado'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        payment_data = request.data
        required_fields = ['payment_method']
        
        for field in required_fields:
            if field not in payment_data:
                return Response(
                    {'error': f'Campo requerido: {field}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        try:
            with transaction.atomic():
                # Crear el pago para este item específico
                payment_amount = order_item.get_pending_amount()
                
                payment = Payment.objects.create(
                    order=order_item.order,
                    payment_method=payment_data['payment_method'],
                    amount=payment_amount,
                    payer_name=payment_data.get('payer_name', ''),
                    notes=payment_data.get('notes', '')
                )
                
                # Crear PaymentItem para asociar el pago con este item específico
                PaymentItem.objects.create(
                    payment=payment,
                    order_item=order_item,
                    amount=payment_amount
                )
                
                # Actualizar estado del item a PAID
                order_item.update_status('PAID')
                
                # Verificar si todos los items de la orden están pagados
                order = order_item.order
                all_items_paid = not order.orderitem_set.exclude(status='PAID').exists()
                
                if all_items_paid:
                    order.update_status('PAID')
                
                # Serializar respuesta
                response_serializer = OrderItemSerializer(order_item)
                return Response({
                    'message': 'Pago procesado exitosamente',
                    'payment_id': payment.id,
                    'order_item': response_serializer.data,
                    'order_fully_paid': all_items_paid
                }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response(
                {'error': f'Error procesando pago: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# OrderItemIngredientViewSet removed - functionality deprecated


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().order_by('-created_at')
    permission_classes = [CognitoPaymentPermission]  # Solo administradores pueden procesar pagos
    serializer_class = PaymentSerializer
    
    def create(self, request, *args, **kwargs):
        """Override create para actualizar estados de OrderItems según el tipo de pago"""
        from django.db import transaction
        
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            with transaction.atomic():
                payment = serializer.save()
                order = payment.order
                
                
                # Si tiene split_group, es un pago parcial
                if hasattr(payment, 'split_group') and payment.split_group:
                    # Para pagos parciales, necesitamos identificar qué items se están pagando
                    selected_items = request.data.get('selected_items', [])
                    
                    if selected_items:
                        # Primero cerrar la orden si tiene items PREPARING (esto los mueve a SERVED automáticamente)
                        has_preparing_items = order.orderitem_set.filter(status='PREPARING').exists()
                        if has_preparing_items and order.status != 'SERVED':
                            order.update_status('SERVED')
                        
                        # Ahora actualizar solo los items seleccionados a PAID
                        for item_id in selected_items:
                            try:
                                order_item = order.orderitem_set.get(id=item_id)
                                # Solo cambiar a PAID si está en SERVED (ya debería estar después del cierre)
                                if order_item.status == 'SERVED':
                                    order_item.update_status('PAID')
                            except OrderItem.DoesNotExist:
                                continue
                    
                    # Verificar si todos los items están pagados para cambiar el estado del order
                    all_items_paid = all(
                        item.status == 'PAID' or item.status == 'CANCELED'
                        for item in order.orderitem_set.all()
                    )
                    if all_items_paid:
                        order.status = 'PAID'
                        order.save()
                        
                else:
                    # Pago completo - actualizar todos los items a PAID
                    # Primero cerrar la orden si tiene items PREPARING (esto los mueve a SERVED automáticamente)
                    has_preparing_items = order.orderitem_set.filter(status='PREPARING').exists()
                    if has_preparing_items and order.status != 'SERVED':
                        order.update_status('SERVED')
                    
                    # Luego actualizar todos los items SERVED a PAID
                    for order_item in order.orderitem_set.filter(status='SERVED'):
                        order_item.update_status('PAID')
                    
                    # Actualizar estado de la orden
                    order.status = 'PAID'
                    order.save()
                
                headers = self.get_success_headers(serializer.data)
                return Response(
                    {**serializer.data, 'order_status': order.status},
                    status=status.HTTP_201_CREATED,
                    headers=headers
                )
                
        except Exception as e:
            return Response(
                {'error': f'Error procesando pago: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get_queryset(self):
        queryset = Payment.objects.all().order_by('-created_at')
        payment_method = self.request.query_params.get('payment_method')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if payment_method:
            queryset = queryset.filter(payment_method=payment_method)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
            
        return queryset
    
    @action(detail=False, methods=['get'])
    def daily_summary(self, request):
        """Resumen de pagos del día"""
        today = timezone.now().date()
        payments = Payment.objects.filter(created_at__date=today)
        
        total_cash = sum(p.amount for p in payments.filter(payment_method='CASH'))
        total_card = sum(p.amount for p in payments.filter(payment_method='CARD'))
        total_amount = total_cash + total_card
        total_orders = payments.count()
        
        return Response({
            'date': today,
            'total_orders': total_orders,
            'total_amount': total_amount,
            'total_cash': total_cash,
            'total_card': total_card,
            'payments': PaymentSerializer(payments, many=True).data
        })
    
    @action(detail=False, methods=['get'])
    def dashboard_data(self, request):
        """Datos completos para el dashboard operacional"""
        from django.db.models import Sum, Count, Q, F
        from datetime import datetime, date
        
        # Obtener fecha del parámetro o usar hoy
        date_param = request.query_params.get('date')
        if date_param:
            try:
                selected_date = datetime.strptime(date_param, '%Y-%m-%d').date()
            except ValueError:
                selected_date = timezone.now().date()
        else:
            selected_date = timezone.now().date()
        
        # No necesitamos las variables de timezone aquí, solo filtramos por fecha
        
        # Filtrar órdenes PAID sin importar la fecha - solo mostrar los que están pagados
        paid_orders = Order.objects.filter(
            status='PAID'
        ).select_related('table__zone').prefetch_related('orderitem_set__recipe__group')
        
        # Métricas básicas
        total_orders = paid_orders.count()
        total_revenue = paid_orders.aggregate(total=Sum('total_amount'))['total'] or 0
        average_ticket = total_revenue / total_orders if total_orders > 0 else 0
        
        # Distribución por categoría
        category_revenue = {}
        dish_sales = {}
        waiter_stats = {}
        zone_stats = {}
        table_revenue = {}
        
        for order in paid_orders:
            # Stats por mesero
            waiter_id = order.waiter or 'Sin Asignar'
            if waiter_id not in waiter_stats:
                waiter_stats[waiter_id] = {'orders': 0, 'revenue': 0}
            waiter_stats[waiter_id]['orders'] += 1
            waiter_stats[waiter_id]['revenue'] += float(order.total_amount)
            
            # Stats por zona
            zone_name = order.table.zone.name if order.table and order.table.zone else 'Sin Zona'
            if zone_name not in zone_stats:
                zone_stats[zone_name] = {'orders': 0, 'revenue': 0, 'tables': set()}
            zone_stats[zone_name]['orders'] += 1
            zone_stats[zone_name]['revenue'] += float(order.total_amount)
            if order.table:
                zone_stats[zone_name]['tables'].add(order.table.number)
            
            # Stats por mesa
            table_num = order.table.number if order.table else 'Sin Mesa'
            if table_num not in table_revenue:
                table_revenue[table_num] = 0
            table_revenue[table_num] += float(order.total_amount)
            
            # Stats por categoría y platos
            for item in order.orderitem_set.all():
                if item.recipe:
                    category = item.recipe.group.name if item.recipe.group else 'Sin Categoría'
                    category_revenue[category] = category_revenue.get(category, 0) + float(item.total_price)
                    
                    recipe_name = item.recipe.name
                    if recipe_name not in dish_sales:
                        dish_sales[recipe_name] = {
                            'quantity': 0,
                            'revenue': 0,
                            'category': category,
                            'price': float(item.unit_price)
                        }
                    dish_sales[recipe_name]['quantity'] += item.quantity
                    dish_sales[recipe_name]['revenue'] += float(item.total_price)
        
        # Calcular tiempo promedio de servicio
        service_times = []
        for order in paid_orders:
            if order.created_at and order.paid_at:
                service_time = (order.paid_at - order.created_at).total_seconds() / 60
                service_times.append(service_time)
        
        average_service_time = sum(service_times) / len(service_times) if service_times else 0
        
        # Ocupación actual de mesas (órdenes activas hoy)
        today = timezone.now().date()
        active_orders = Order.objects.filter(
            created_at__date=today,
            status__in=['CREATED']
        )
        active_tables = active_orders.values_list('table', flat=True).distinct().count()
        
        # Métodos de pago de todas las órdenes pagadas
        payments_today = Payment.objects.all()
        payment_methods = payments_today.values('payment_method').annotate(
            total=Sum('amount')
        )
        
        # Formatear respuesta
        return Response({
            'date': selected_date.isoformat(),
            'summary': {
                'total_revenue': float(total_revenue),
                'total_orders': total_orders,
                'average_ticket': float(average_ticket),
                'average_service_time': round(average_service_time),
                'active_orders': active_orders.count(),
                'active_tables': active_tables,
                'customer_count': total_orders * 2.5  # Estimado
            },
            'revenue_by_category': [
                {
                    'category': cat,
                    'revenue': rev,
                    'percentage': (rev / float(total_revenue) * 100) if total_revenue > 0 else 0
                }
                for cat, rev in sorted(category_revenue.items(), key=lambda x: x[1], reverse=True)
            ],
            'top_dishes': [
                {
                    'name': name,
                    'quantity': data['quantity'],
                    'revenue': data['revenue'],
                    'category': data['category'],
                    'price': data['price']
                }
                for name, data in sorted(dish_sales.items(), key=lambda x: x[1]['quantity'], reverse=True)[:10]
            ],
            'waiter_performance': [
                {
                    'waiter': waiter,
                    'orders': stats['orders'],
                    'revenue': stats['revenue'],
                    'avg_ticket': stats['revenue'] / stats['orders'] if stats['orders'] > 0 else 0
                }
                for waiter, stats in sorted(waiter_stats.items(), key=lambda x: x[1]['revenue'], reverse=True)[:5]
            ],
            'zone_performance': [
                {
                    'zone': zone,
                    'orders': stats['orders'],
                    'revenue': stats['revenue'],
                    'tables_used': len(stats['tables']),
                    'avg_per_table': stats['revenue'] / len(stats['tables']) if stats['tables'] else 0
                }
                for zone, stats in sorted(zone_stats.items(), key=lambda x: x[1]['revenue'], reverse=True)
            ],
            'top_tables': [
                {'table': table, 'revenue': revenue}
                for table, revenue in sorted(table_revenue.items(), key=lambda x: x[1], reverse=True)[:5]
            ],
            'payment_methods': [
                {
                    'method': pm['payment_method'],
                    'amount': float(pm['total'] or 0),
                    'percentage': (float(pm['total'] or 0) / float(total_revenue) * 100) if total_revenue > 0 else 0
                }
                for pm in payment_methods
            ]
        })
    
    @action(detail=False, methods=['get'])
    def operational_summary(self, request):
        """Resumen de pagos por fecha operativa"""
        # Obtener fecha operativa desde parámetro o usar la actual
        date_param = request.query_params.get('date')
        if date_param:
            try:
                from datetime import datetime
                operational_date = datetime.strptime(date_param, '%Y-%m-%d').date()
            except ValueError:
                operational_date = timezone.now().date()
        else:
            operational_date = timezone.now().date()
        
        # Filtrar pagos por fecha operativa
        payments = Payment.objects.filter(operational_date=operational_date)
        
        # Calcular totales por método de pago
        from django.db.models import Sum, Count
        
        summary_by_method = payments.values('payment_method').annotate(
            count=Count('id'),
            total=Sum('amount')
        )
        
        # Totales generales
        total_amount = payments.aggregate(Sum('amount'))['amount__sum'] or 0
        total_orders = payments.count()
        
        # Desglose por método
        method_totals = {
            'CASH': 0,
            'CARD': 0,
            'TRANSFER': 0,
            'YAPE_PLIN': 0,
            'OTHER': 0
        }
        
        for item in summary_by_method:
            method_totals[item['payment_method']] = float(item['total'] or 0)
        
        return Response({
            'operational_date': operational_date,
            'system_date': timezone.now().date(),
            'total_orders': total_orders,
            'total_amount': float(total_amount),
            'method_breakdown': method_totals,
            'payments': PaymentSerializer(payments, many=True).data
        })


class ContainerSaleViewSet(viewsets.ModelViewSet):
    queryset = ContainerSale.objects.all().order_by('-created_at')
    serializer_class = ContainerSaleSerializer
    permission_classes = [AllowAny]  # Acceso completo en desarrollo
    pagination_class = None  # Deshabilitar paginación


# ===== CART API ELIMINADO =====
# Sistema Cart eliminado para simplificar operaciones
