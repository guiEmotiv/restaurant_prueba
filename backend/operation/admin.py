from django.contrib import admin
from .models import Order, OrderItem, OrderItemIngredient, Payment, PaymentItem, ContainerSale


class OrderItemIngredientInline(admin.TabularInline):
    model = OrderItemIngredient
    extra = 0
    readonly_fields = ['unit_price', 'total_price']


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 1
    readonly_fields = ['unit_price', 'total_price']


class ContainerSaleInline(admin.TabularInline):
    model = ContainerSale
    extra = 0
    readonly_fields = ['unit_price', 'total_price', 'created_at']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'table', 'status', 'total_amount', 'created_at']
    list_filter = ['status', 'table__zone', 'created_at']
    search_fields = ['table__table_number']
    readonly_fields = ['total_amount', 'created_at', 'served_at', 'paid_at']
    inlines = [OrderItemInline, ContainerSaleInline]


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
    list_filter = []
    search_fields = ['order_item__order__id', 'ingredient__name']
    readonly_fields = ['unit_price', 'total_price', 'created_at']


class PaymentItemInline(admin.TabularInline):
    model = PaymentItem
    extra = 0
    readonly_fields = ['created_at']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['order', 'payment_method', 'amount', 'tax_amount', 'payer_name', 'split_group', 'created_at']
    list_filter = ['payment_method', 'created_at', 'split_group']
    search_fields = ['order__id', 'payer_name']
    readonly_fields = ['created_at']
    inlines = [PaymentItemInline]


@admin.register(PaymentItem)
class PaymentItemAdmin(admin.ModelAdmin):
    list_display = ['payment', 'order_item', 'amount', 'created_at']
    list_filter = ['created_at']
    search_fields = ['payment__order__id', 'order_item__recipe__name']
    readonly_fields = ['created_at']


@admin.register(ContainerSale)
class ContainerSaleAdmin(admin.ModelAdmin):
    list_display = ['order', 'container', 'quantity', 'unit_price', 'total_price', 'created_at']
    list_filter = ['container', 'created_at']
    search_fields = ['order__id', 'container__name']
    readonly_fields = ['unit_price', 'total_price', 'created_at']
