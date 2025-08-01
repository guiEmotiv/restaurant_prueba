from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.core.exceptions import ValidationError
from backend.cognito_permissions import (
    CognitoAdminOnlyPermission, 
    CognitoReadOnlyForNonAdmins
)
from .models import Group, Ingredient, Recipe, RecipeItem
from .serializers import (
    GroupSerializer,
    IngredientSerializer, IngredientDetailSerializer,
    RecipeSerializer, RecipeDetailSerializer, RecipeWithItemsCreateSerializer,
    RecipeItemSerializer, RecipeItemCreateSerializer
)


class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all().order_by('name')
    serializer_class = GroupSerializer
    permission_classes = []  # Acceso completo para todos los usuarios autenticados
    
    @action(detail=True, methods=['get'])
    def recipes(self, request, pk=None):
        """Obtener todas las recetas de un grupo"""
        group = self.get_object()
        recipes = group.recipe_set.all().order_by('name')
        
        from .serializers import RecipeSerializer
        serializer = RecipeSerializer(recipes, many=True)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """Override destroy para manejar errores de validación"""
        group = self.get_object()
        try:
            self.perform_destroy(group)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ValidationError as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class IngredientViewSet(viewsets.ModelViewSet):
    permission_classes = []  # Acceso completo para todos los usuarios autenticados
    queryset = Ingredient.objects.all().order_by('-id')
    
    def get_serializer_class(self):
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return IngredientDetailSerializer
        return IngredientSerializer
    
    def get_queryset(self):
        queryset = Ingredient.objects.all().order_by('-id')
        category = self.request.query_params.get('category')
        unit = self.request.query_params.get('unit')
        is_active = self.request.query_params.get('is_active')
        
        if category:
            queryset = queryset.filter(category_id=category)
        if unit:
            queryset = queryset.filter(unit_id=unit)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Para creación de recetas, solo mostrar ingredientes activos
        if self.request.path.endswith('/ingredients/') and self.request.method == 'GET':
            show_all = self.request.query_params.get('show_all')
            if not show_all:
                queryset = queryset.filter(is_active=True)
            
        return queryset
    
    @action(detail=True, methods=['post'])
    def update_stock(self, request, pk=None):
        """Actualizar stock de un ingrediente"""
        ingredient = self.get_object()
        quantity = request.data.get('quantity')
        operation = request.data.get('operation', 'add')  # 'add' or 'subtract'
        
        if not quantity:
            return Response({'error': 'Se requiere la cantidad'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            ingredient.update_stock(float(quantity), operation)
            serializer = self.get_serializer(ingredient)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, 
                          status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        """Override destroy para manejar errores de validación"""
        ingredient = self.get_object()
        try:
            self.perform_destroy(ingredient)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ValidationError as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class RecipeViewSet(viewsets.ModelViewSet):
    permission_classes = []  # Acceso completo para todos los usuarios autenticados
    queryset = Recipe.objects.all().order_by('name')
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return RecipeWithItemsCreateSerializer
        elif self.action == 'retrieve':
            return RecipeDetailSerializer
        return RecipeSerializer
    
    def get_queryset(self):
        queryset = Recipe.objects.all().order_by('name', '-version')
        is_available = self.request.query_params.get('is_available')
        is_active = self.request.query_params.get('is_active')
        group = self.request.query_params.get('group')
        
        if is_available is not None:
            queryset = queryset.filter(is_available=is_available.lower() == 'true')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        if group:
            queryset = queryset.filter(group_id=group)
        
        # Para creación de pedidos, solo mostrar recetas activas y disponibles
        if self.request.path.endswith('/recipes/') and self.request.method == 'GET':
            show_all = self.request.query_params.get('show_all')
            if not show_all:
                # Filtrar por recetas que están activas Y tienen stock suficiente
                available_recipes = []
                for recipe in queryset:
                    if recipe.is_active and recipe.has_sufficient_stock():
                        available_recipes.append(recipe.id)
                queryset = queryset.filter(id__in=available_recipes)
            
        return queryset
    
    @action(detail=True, methods=['post'])
    def update_price(self, request, pk=None):
        """Recalcular precio base de una receta"""
        recipe = self.get_object()
        recipe.update_base_price()
        serializer = self.get_serializer(recipe)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def check_availability(self, request, pk=None):
        """Verificar disponibilidad de una receta según stock"""
        recipe = self.get_object()
        is_available = recipe.check_availability()
        
        # Obtener detalles de disponibilidad por ingrediente
        availability_details = []
        for recipe_item in recipe.recipeitem_set.all():
            ingredient = recipe_item.ingredient
            available = ingredient.current_stock >= recipe_item.quantity
            availability_details.append({
                'ingredient_name': ingredient.name,
                'required_quantity': recipe_item.quantity,
                'current_stock': ingredient.current_stock,
                'available': available
            })
        
        return Response({
            'is_available': is_available,
            'details': availability_details
        })
    
    @action(detail=True, methods=['post'])
    def add_ingredient(self, request, pk=None):
        """Agregar ingrediente a una receta"""
        recipe = self.get_object()
        serializer = RecipeItemCreateSerializer(
            data=request.data, 
            context={'recipe': recipe}
        )
        
        if serializer.is_valid():
            serializer.save(recipe=recipe)
            recipe.update_base_price()  # Actualizar precio
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['delete'])
    def remove_ingredient(self, request, pk=None):
        """Remover ingrediente de una receta"""
        recipe = self.get_object()
        ingredient_id = request.data.get('ingredient_id')
        
        try:
            recipe_item = RecipeItem.objects.get(recipe=recipe, ingredient_id=ingredient_id)
            recipe_item.delete()
            recipe.update_base_price()  # Actualizar precio
            return Response({'message': 'Ingrediente removido exitosamente'})
        except RecipeItem.DoesNotExist:
            return Response({'error': 'Ingrediente no encontrado en la receta'}, 
                          status=status.HTTP_404_NOT_FOUND)

    def destroy(self, request, *args, **kwargs):
        """Override destroy para manejar errores de validación"""
        recipe = self.get_object()
        try:
            self.perform_destroy(recipe)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ValidationError as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class RecipeItemViewSet(viewsets.ModelViewSet):
    permission_classes = []  # Acceso completo para todos los usuarios autenticados
    queryset = RecipeItem.objects.all().order_by('recipe__name', 'ingredient__name')
    serializer_class = RecipeItemSerializer
    
    def get_queryset(self):
        queryset = RecipeItem.objects.all().order_by('recipe__name', 'ingredient__name')
        recipe = self.request.query_params.get('recipe')
        ingredient = self.request.query_params.get('ingredient')
        
        if recipe:
            queryset = queryset.filter(recipe_id=recipe)
        if ingredient:
            queryset = queryset.filter(ingredient_id=ingredient)
            
        return queryset
