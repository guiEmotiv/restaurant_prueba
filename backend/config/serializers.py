from rest_framework import serializers
from .models import Unit, Zone, Table, RestaurantOperationalConfig, Waiter, Container


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
    
    class Meta:
        model = Table
        fields = ['id', 'zone', 'zone_name', 'table_number', 'created_at']
        read_only_fields = ['id', 'created_at']


class TableDetailSerializer(TableSerializer):
    zone_detail = ZoneSerializer(source='zone', read_only=True)
    
    class Meta(TableSerializer.Meta):
        fields = TableSerializer.Meta.fields + ['zone_detail']


class RestaurantOperationalConfigSerializer(serializers.ModelSerializer):
    business_hours_text = serializers.CharField(source='get_business_hours_text', read_only=True)
    is_currently_open = serializers.SerializerMethodField()
    
    class Meta:
        model = RestaurantOperationalConfig
        fields = [
            'id', 'name', 'opening_time', 'closing_time', 'operational_cutoff_time',
            'is_active', 'business_hours_text', 'is_currently_open',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_is_currently_open(self, obj):
        return obj.is_currently_open()


class WaiterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Waiter
        fields = ['id', 'name', 'phone', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ContainerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Container
        fields = ['id', 'name', 'description', 'price', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']