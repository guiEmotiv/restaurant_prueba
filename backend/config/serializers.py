from rest_framework import serializers
from .models import Unit, Zone, Table, Container


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ['id', 'name', 'created_at']
        read_only_fields = ['id', 'created_at']


class ZoneSerializer(serializers.ModelSerializer):
    tables_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Zone
        fields = ['id', 'name', 'created_at', 'tables_count']
        read_only_fields = ['id', 'created_at']
    
    def get_tables_count(self, obj):
        return obj.table_set.count()


class TableSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source='zone.name', read_only=True)
    zone_detail = serializers.SerializerMethodField()  # Include zone object for compatibility 
    active_orders_count = serializers.SerializerMethodField()
    has_active_orders = serializers.SerializerMethodField()
    name = serializers.CharField(source='table_number', read_only=True)  # Alias para compatibilidad
    
    class Meta:
        model = Table
        fields = ['id', 'zone', 'zone_detail', 'zone_name', 'table_number', 'name', 'created_at', 
                  'active_orders_count', 'has_active_orders']
        read_only_fields = ['id', 'created_at']
    
    def get_zone_detail(self, obj):
        """Return zone object for frontend compatibility"""
        if obj.zone:
            return {
                'id': obj.zone.id,
                'name': obj.zone.name
            }
        return None
    
    def get_active_orders_count(self, obj):
        return obj.order_set.filter(status__in=['CREATED', 'PREPARING']).count()
    
    def get_has_active_orders(self, obj):
        return obj.order_set.filter(status__in=['CREATED', 'PREPARING']).exists()


class TableDetailSerializer(TableSerializer):
    zone_detail = ZoneSerializer(source='zone', read_only=True)
    
    class Meta(TableSerializer.Meta):
        fields = TableSerializer.Meta.fields + ['zone_detail']




class ContainerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Container
        fields = ['id', 'name', 'description', 'price', 'stock', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']