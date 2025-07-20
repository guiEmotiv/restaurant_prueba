from django.contrib import admin
from .models import Ingredient, Recipe, RecipeItem


class RecipeItemInline(admin.TabularInline):
    model = RecipeItem
    extra = 1
    min_num = 1


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'unit', 'unit_price', 'current_stock', 'is_active']
    list_filter = ['category', 'unit', 'is_active']
    search_fields = ['name']
    readonly_fields = ['created_at', 'updated_at']
    list_editable = ['unit_price', 'current_stock', 'is_active']


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ['name', 'base_price', 'is_available', 'preparation_time']
    list_filter = ['is_available']
    search_fields = ['name']
    readonly_fields = ['created_at', 'updated_at']
    list_editable = ['base_price', 'is_available']
    inlines = [RecipeItemInline]


@admin.register(RecipeItem)
class RecipeItemAdmin(admin.ModelAdmin):
    list_display = ['recipe', 'ingredient', 'quantity']
    list_filter = ['recipe', 'ingredient__category']
    search_fields = ['recipe__name', 'ingredient__name']
    readonly_fields = ['created_at']
