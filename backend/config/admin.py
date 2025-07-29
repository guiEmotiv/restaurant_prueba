from django.contrib import admin
from .models import Unit, Zone, Table, RestaurantOperationalConfig, Waiter, Container


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name']
    readonly_fields = ['created_at']


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name']
    readonly_fields = ['created_at']


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ['table_number', 'zone', 'created_at']
    list_filter = ['zone']
    search_fields = ['table_number']
    readonly_fields = ['created_at']


@admin.register(RestaurantOperationalConfig)
class RestaurantOperationalConfigAdmin(admin.ModelAdmin):
    list_display = ['name', 'opening_time', 'closing_time', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Información General', {
            'fields': ('name', 'is_active')
        }),
        ('Horarios Operativos', {
            'fields': ('opening_time', 'closing_time', 'operational_cutoff_time'),
            'description': 'Defina los horarios de operación del restaurante'
        }),
        ('Fechas', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(Waiter)
class WaiterAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'phone']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Container)
class ContainerAdmin(admin.ModelAdmin):
    list_display = ['name', 'price', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Información General', {
            'fields': ('name', 'description', 'is_active')
        }),
        ('Precio', {
            'fields': ('price',)
        }),
        ('Fechas', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
