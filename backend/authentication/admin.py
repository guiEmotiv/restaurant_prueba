from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import RestaurantUser


@admin.register(RestaurantUser)
class RestaurantUserAdmin(UserAdmin):
    """Admin interface for RestaurantUser"""
    
    list_display = [
        'username', 'email', 'first_name', 'last_name', 
        'role', 'is_active', 'is_active_session', 'last_activity'
    ]
    
    list_filter = ['role', 'is_active', 'is_active_session', 'last_activity']
    
    search_fields = ['username', 'email', 'first_name', 'last_name']
    
    ordering = ['username']
    
    fieldsets = UserAdmin.fieldsets + (
        ('Restaurant Info', {
            'fields': ('role', 'aws_iam_username', 'is_active_session', 'last_activity')
        }),
    )
    
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Restaurant Info', {
            'fields': ('role', 'aws_iam_username')
        }),
    )
    
    readonly_fields = ['last_activity', 'is_active_session']