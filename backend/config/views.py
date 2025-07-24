from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from authentication.permissions import AdminOnlyPermission
from .models import Category, Unit, Zone, Table
from .serializers import (
    CategorySerializer, UnitSerializer, ZoneSerializer, 
    TableSerializer, TableDetailSerializer
)


class CategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [AdminOnlyPermission]
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    
    @action(detail=True, methods=['get'])
    def ingredients(self, request, pk=None):
        """Obtener todos los ingredientes de una categoría"""
        category = self.get_object()
        ingredients = category.ingredient_set.filter(is_active=True)
        from inventory.serializers import IngredientSerializer
        serializer = IngredientSerializer(ingredients, many=True)
        return Response(serializer.data)


class UnitViewSet(viewsets.ModelViewSet):
    permission_classes = [AdminOnlyPermission]
    queryset = Unit.objects.all().order_by('name')
    serializer_class = UnitSerializer
    
    @action(detail=True, methods=['get'])
    def ingredients(self, request, pk=None):
        """Obtener todos los ingredientes de una unidad"""
        unit = self.get_object()
        ingredients = unit.ingredient_set.filter(is_active=True)
        from inventory.serializers import IngredientSerializer
        serializer = IngredientSerializer(ingredients, many=True)
        return Response(serializer.data)


class ZoneViewSet(viewsets.ModelViewSet):
    permission_classes = [AdminOnlyPermission]
    queryset = Zone.objects.all().order_by('name')
    serializer_class = ZoneSerializer
    
    @action(detail=True, methods=['get'])
    def tables(self, request, pk=None):
        """Obtener todas las mesas de una zona"""
        zone = self.get_object()
        tables = zone.table_set.all()
        serializer = TableSerializer(tables, many=True)
        return Response(serializer.data)


class TableViewSet(viewsets.ModelViewSet):
    permission_classes = [AdminOnlyPermission]
    queryset = Table.objects.all().order_by('zone__name', 'table_number')
    
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
