from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Unit, Zone, Table, RestaurantOperationalConfig
from .serializers import (
    UnitSerializer, ZoneSerializer, 
    TableSerializer, TableDetailSerializer,
    RestaurantOperationalConfigSerializer
)


class UnitViewSet(viewsets.ModelViewSet):
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


class RestaurantOperationalConfigViewSet(viewsets.ModelViewSet):
    queryset = RestaurantOperationalConfig.objects.all().order_by('-created_at')
    serializer_class = RestaurantOperationalConfigSerializer
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Obtener la configuración operativa activa"""
        config = RestaurantOperationalConfig.get_active_config()
        if config:
            serializer = self.get_serializer(config)
            return Response(serializer.data)
        return Response({'message': 'No hay configuración activa'}, 
                       status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activar una configuración específica"""
        config = self.get_object()
        config.is_active = True
        config.save()  # El save() automáticamente desactiva las otras
        serializer = self.get_serializer(config)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def operational_info(self, request):
        """Información operativa actual del restaurante"""
        from django.utils import timezone
        
        config = RestaurantOperationalConfig.get_active_config()
        now = timezone.now()
        local_now = timezone.localtime(now)
        operational_date = RestaurantOperationalConfig.get_operational_date()
        
        data = {
            'current_datetime': now,
            'current_local_datetime': local_now,
            'operational_date': operational_date,
            'has_config': bool(config)
        }
        
        if config:
            data.update({
                'is_currently_open': config.is_currently_open(now),
                'business_hours': config.get_business_hours_text(),
                'opening_time': config.opening_time,
                'closing_time': config.closing_time,
                'operational_cutoff_time': config.operational_cutoff_time
            })
        
        return Response(data)
