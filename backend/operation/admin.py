from django.contrib import admin
from .models import Order, OrderItem, OrderItemIngredient, Payment


class OrderItemIngredientInline(admin.TabularInline):
    model = OrderItemIngredient
    extra = 0
    readonly_fields = ['unit_price', 'total_price']


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 1
    readonly_fields = ['unit_price', 'total_price']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'table', 'status', 'total_amount', 'created_at']
    list_filter = ['status', 'table__zone', 'created_at']
    search_fields = ['table__table_number']
    readonly_fields = ['total_amount', 'created_at', 'served_at', 'paid_at']
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'recipe', 'unit_price', 'total_price', 'status']
    list_filter = ['status', 'recipe']
    search_fields = ['order__id', 'recipe__name']
    readonly_fields = ['unit_price', 'total_price', 'created_at', 'served_at']
    inlines = [OrderItemIngredientInline]


@admin.register(OrderItemIngredient)
class OrderItemIngredientAdmin(admin.ModelAdmin):
    list_display = ['order_item', 'ingredient', 'quantity', 'unit_price', 'total_price']
    list_filter = ['ingredient__category']
    search_fields = ['order_item__order__id', 'ingredient__name']
    readonly_fields = ['unit_price', 'total_price', 'created_at']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['order', 'payment_method', 'amount', 'tax_amount', 'created_at']
    list_filter = ['payment_method', 'created_at']
    search_fields = ['order__id']
    readonly_fields = ['created_at']
