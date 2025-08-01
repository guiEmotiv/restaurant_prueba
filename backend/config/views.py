from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from backend.cognito_permissions import (
    CognitoAdminOnlyPermission, 
    CognitoWaiterAndAdminPermission, 
    CognitoReadOnlyForNonAdmins
)
from .models import Unit, Zone, Table, Container
from .serializers import (
    UnitSerializer, ZoneSerializer, 
    TableSerializer, TableDetailSerializer, ContainerSerializer
)


class UnitViewSet(viewsets.ModelViewSet):
    queryset = Unit.objects.all().order_by('name')
    serializer_class = UnitSerializer
    permission_classes = []  # Acceso completo para todos los usuarios autenticados
    
    @action(detail=True, methods=['get'])
    def ingredients(self, request, pk=None):
        """Obtener todos los ingredientes de una unidad"""
        unit = self.get_object()
        ingredients = unit.ingredient_set.filter(is_active=True)
        from inventory.serializers import IngredientSerializer
        serializer = IngredientSerializer(ingredients, many=True)
        return Response(serializer.data)


class ZoneViewSet(viewsets.ModelViewSet):
    queryset = Zone.objects.all().order_by('name')
    serializer_class = ZoneSerializer
    permission_classes = []  # Acceso completo para todos los usuarios autenticados
    
    @action(detail=True, methods=['get'])
    def tables(self, request, pk=None):
        """Obtener todas las mesas de una zona"""
        zone = self.get_object()
        tables = zone.table_set.all()
        serializer = TableSerializer(tables, many=True)
        return Response(serializer.data)


class TableViewSet(viewsets.ModelViewSet):
    queryset = Table.objects.all().order_by('zone__name', 'table_number')
    permission_classes = []  # Acceso completo para todos los usuarios autenticados
    
    def get_serializer_class(self):
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return TableDetailSerializer
        return TableSerializer
    
    @action(detail=True, methods=['get'])
    def orders(self, request, pk=None):
        """Obtener todas las órdenes de una mesa"""
        table = self.get_object()
        orders = table.order_set.all().order_by('-created_at')
        from operation.serializers import OrderSerializer
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def current_order(self, request, pk=None):
        """Obtener la orden actual de una mesa (no pagada)"""
        table = self.get_object()
        order = table.order_set.filter(status__in=['CREATED', 'READY', 'SERVED']).first()
        if order:
            from operation.serializers import OrderDetailSerializer
            serializer = OrderDetailSerializer(order)
            return Response(serializer.data)
        return Response({'message': 'No hay orden activa para esta mesa'}, 
                       status=status.HTTP_404_NOT_FOUND)




class ContainerViewSet(viewsets.ModelViewSet):
    serializer_class = ContainerSerializer
    pagination_class = None  # Disable pagination
    permission_classes = []  # Acceso completo para todos los usuarios autenticados
    
    def get_queryset(self):
        queryset = Container.objects.all().order_by('name')
        # Filtrar por activos si se especifica
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            is_active_bool = is_active.lower() in ('true', '1', 'yes')
            queryset = queryset.filter(is_active=is_active_bool)
        return queryset
