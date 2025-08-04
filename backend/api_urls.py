from rest_framework.routers import DefaultRouter
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

# Import ViewSets
from config.views import UnitViewSet, ZoneViewSet, TableViewSet, ContainerViewSet, operational_info
from inventory.views import GroupViewSet, IngredientViewSet, RecipeViewSet, RecipeItemViewSet
from operation.views import (
    OrderViewSet, OrderItemViewSet, OrderItemIngredientViewSet, PaymentViewSet
)
from operation.views_dashboard import DashboardViewSet

# Create router and register viewsets
router = DefaultRouter()

# Config app routes
router.register(r'units', UnitViewSet, basename='unit')
router.register(r'zones', ZoneViewSet, basename='zone')
router.register(r'tables', TableViewSet, basename='table')
router.register(r'containers', ContainerViewSet, basename='container')

# Inventory app routes
router.register(r'groups', GroupViewSet, basename='group')
router.register(r'ingredients', IngredientViewSet, basename='ingredient')
router.register(r'recipes', RecipeViewSet, basename='recipe')
router.register(r'recipe-items', RecipeItemViewSet, basename='recipeitem')

# Operation app routes
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'order-items', OrderItemViewSet, basename='orderitem')
router.register(r'order-item-ingredients', OrderItemIngredientViewSet, basename='orderitemingredient')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')

urlpatterns = [
    path('', include(router.urls)),  # Remove api/ prefix from here
    path('restaurant-config/operational_info/', operational_info, name='operational-info'),
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]