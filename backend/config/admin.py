from django.contrib import admin
from .models import Unit, Zone, Table


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
