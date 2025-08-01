from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from django.db import transaction
from backend.cognito_permissions import (
    CognitoAuthenticatedPermission, 
    CognitoAdminPermission, 
    CognitoWaiterOrAdminPermission
)
from .models import Order, OrderItem, OrderItemIngredient, Payment, PaymentItem
from .serializers import (
    OrderSerializer, OrderDetailSerializer, OrderCreateSerializer,
    OrderItemSerializer, OrderItemCreateSerializer,
    OrderItemIngredientSerializer, OrderItemIngredientCreateSerializer,
    PaymentSerializer, OrderStatusUpdateSerializer, SplitPaymentSerializer
)


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all().order_by('-created_at')
    permission_classes = [CognitoWaiterOrAdminPermission]  # Both waiters and admins can manage orders
    
    def get_serializer_class(self):
        if self.action == 'create':
            return OrderCreateSerializer
        elif self.action in ['retrieve', 'update', 'partial_update']:
            return OrderDetailSerializer
        return OrderSerializer
    
    def get_queryset(self):
        queryset = Order.objects.all().order_by('-created_at')
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
            order.update_status(new_status)
            
            response_serializer = OrderDetailSerializer(order)
            return Response(response_serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        """Agregar item a una orden existente"""
        import logging
        logger = logging.getLogger(__name__)
        
        order = self.get_object()
        
        # Debug logging
        logger.error(f"ADD_ITEM DEBUG - Order ID: {order.id}, Status: {order.status}")
        logger.error(f"ADD_ITEM DEBUG - Request data: {request.data}")
        
        if order.status != 'CREATED':
            return Response(
                {'error': 'Solo se pueden agregar items a órdenes con status CREATED'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = OrderItemCreateSerializer(data=request.data, context={'order': order})
        if serializer.is_valid():
            try:
                order_item = serializer.save()
                order.calculate_total()
                
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
        # Solo órdenes CREATED (no canceladas/pagadas) que tienen items CREATED
        orders = Order.objects.filter(
            status='CREATED',
            orderitem__status='CREATED'
        ).distinct().order_by('created_at')
        
        serializer = OrderDetailSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def kitchen_board(self, request):
        """Vista de tablero de cocina - items organizados por receta"""
        from django.db.models import Q
        from collections import defaultdict
        
        # Obtener todos los order items que están pendientes (CREATED)
        order_items = OrderItem.objects.filter(
            status='CREATED',
            order__status='CREATED'
        ).select_related('recipe', 'recipe__group', 'order', 'order__table', 'order__table__zone', 'order__waiter').order_by('created_at')
        
        # Organizar items por receta
        kitchen_board = defaultdict(list)
        for item in order_items:
            recipe_key = item.recipe.name
            
            # Calcular tiempo transcurrido desde la creación
            from django.utils import timezone
            elapsed_minutes = int((timezone.now() - item.created_at).total_seconds() / 60)
            is_overdue = elapsed_minutes > item.recipe.preparation_time
            
            item_data = {
                'id': item.id,
                'order_id': item.order.id,
                'order_table': item.order.table.table_number,
                'order_zone': item.order.table.zone.name,
                'waiter_name': item.order.waiter.name if item.order.waiter else 'Sin mesero',
                'status': item.status,
                'notes': item.notes,
                'is_takeaway': item.is_takeaway,
                'created_at': item.created_at.isoformat(),
                'elapsed_time_minutes': elapsed_minutes,
                'preparation_time': item.recipe.preparation_time,
                'is_overdue': is_overdue,
                'customizations_count': item.orderitemingredient_set.count(),
                'recipe_group_name': item.recipe.group.name if item.recipe.group else 'Sin Grupo',
                'recipe_group_id': item.recipe.group.id if item.recipe.group else None
            }
            kitchen_board[recipe_key].append(item_data)
        
        # Convertir a formato final
        result = []
        for recipe_name, items in kitchen_board.items():
            # Usar el grupo del primer item (todos los items de la misma receta tienen el mismo grupo)
            first_item = items[0] if items else {}
            result.append({
                'recipe_name': recipe_name,
                'recipe_group_name': first_item.get('recipe_group_name', 'Sin Grupo'),
                'recipe_group_id': first_item.get('recipe_group_id'),
                'total_items': len(items),
                'pending_items': len([i for i in items if i['status'] == 'CREATED']),
                'served_items': len([i for i in items if i['status'] == 'SERVED']),
                'overdue_items': len([i for i in items if i['is_overdue']]),
                'items': items
            })
        
        # Ordenar por número de items pendientes (más urgent primero)
        result.sort(key=lambda x: (x['overdue_items'], x['pending_items']), reverse=True)
        
        return Response(result)
    
    @action(detail=False, methods=['get'])
    def served(self, request):
        """Vista para pagos - órdenes servidas listas para pagar"""
        orders = Order.objects.filter(
            status='SERVED'
        ).order_by('-served_at')
        
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
    serializer_class = OrderItemSerializer
    permission_classes = [CognitoWaiterOrAdminPermission]  # Both waiters and admins can manage order items
    
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
            order_item.update_status(new_status)
            serializer = OrderItemSerializer(order_item)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def add_ingredient(self, request, pk=None):
        """Agregar ingrediente personalizado a un item"""
        order_item = self.get_object()
        serializer = OrderItemIngredientCreateSerializer(
            data=request.data,
            context={'order_item': order_item}
        )
        
        if serializer.is_valid():
            ingredient_item = serializer.save(order_item=order_item)
            
            response_serializer = OrderItemIngredientSerializer(ingredient_item)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OrderItemIngredientViewSet(viewsets.ModelViewSet):
    queryset = OrderItemIngredient.objects.all().order_by('-created_at')
    serializer_class = OrderItemIngredientSerializer
    permission_classes = [CognitoWaiterOrAdminPermission]  # Both waiters and admins can manage ingredients
    
    def get_queryset(self):
        queryset = OrderItemIngredient.objects.all().order_by('-created_at')
        order_item = self.request.query_params.get('order_item')
        ingredient = self.request.query_params.get('ingredient')
        
        if order_item:
            queryset = queryset.filter(order_item_id=order_item)
        if ingredient:
            queryset = queryset.filter(ingredient_id=ingredient)
            
        return queryset


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().order_by('-created_at')
    permission_classes = [CognitoWaiterOrAdminPermission]  # Both waiters and admins can manage payments
    serializer_class = PaymentSerializer
    
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
    def operational_summary(self, request):
        """Resumen de pagos por fecha operativa"""
        # Obtener fecha operativa desde parámetro o usar la actual
        date_param = request.query_params.get('date')
        if date_param:
            try:
                from datetime import datetime
                operational_date = datetime.strptime(date_param, '%Y-%m-%d').date()
            except ValueError:
                operational_date = Order.get_operational_date()
        else:
            operational_date = Order.get_operational_date()
        
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
