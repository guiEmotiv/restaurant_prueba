from rest_framework import serializers
from .models import Group, Ingredient, Recipe, RecipeItem
from config.serializers import UnitSerializer


class GroupSerializer(serializers.ModelSerializer):
    recipes_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Group
        fields = [
            'id', 'name', 'recipes_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_recipes_count(self, obj):
        return obj.recipe_set.count()


class IngredientSerializer(serializers.ModelSerializer):
    unit_name = serializers.CharField(source='unit.name', read_only=True)
    
    class Meta:
        model = Ingredient
        fields = [
            'id', 'unit', 'unit_name', 
            'name', 'unit_price', 'current_stock', 'is_active', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'is_active', 'created_at', 'updated_at']


class IngredientDetailSerializer(IngredientSerializer):
    unit_detail = UnitSerializer(source='unit', read_only=True)
    
    class Meta(IngredientSerializer.Meta):
        fields = IngredientSerializer.Meta.fields + ['unit_detail']


class RecipeItemSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source='ingredient.name', read_only=True)
    ingredient_unit = serializers.CharField(source='ingredient.unit.name', read_only=True)
    ingredient_unit_name = serializers.CharField(source='ingredient.unit.name', read_only=True)
    ingredient_unit_price = serializers.DecimalField(source='ingredient.unit_price', max_digits=10, decimal_places=2, read_only=True)
    total_cost = serializers.SerializerMethodField()
    
    class Meta:
        model = RecipeItem
        fields = [
            'id', 'recipe', 'ingredient', 'ingredient_name', 'ingredient_unit', 
            'ingredient_unit_name', 'ingredient_unit_price', 
            'quantity', 'total_cost', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_total_cost(self, obj):
        return obj.ingredient.unit_price * obj.quantity


class RecipeSerializer(serializers.ModelSerializer):
    group_name = serializers.SerializerMethodField()
    container_name = serializers.SerializerMethodField()
    ingredients_count = serializers.SerializerMethodField()
    ingredients_list = serializers.SerializerMethodField()
    is_available_calculated = serializers.SerializerMethodField()
    ingredients_cost = serializers.SerializerMethodField()
    profit_amount = serializers.SerializerMethodField()
    # Aliases para compatibilidad con frontend
    price = serializers.DecimalField(source='base_price', max_digits=10, decimal_places=2, read_only=True)
    unit_price = serializers.DecimalField(source='base_price', max_digits=10, decimal_places=2, read_only=True)
    cost = serializers.DecimalField(source='base_price', max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = Recipe
        fields = [
            'id', 'group', 'group_name', 'container', 'container_name', 'name', 'version', 'base_price', 'price', 'unit_price', 'cost', 'profit_percentage', 
            'ingredients_cost', 'profit_amount', 'is_available', 'is_active', 'is_available_calculated',
            'preparation_time', 'ingredients_count', 'ingredients_list', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_group_name(self, obj):
        return obj.group.name if obj.group else None
    
    def get_container_name(self, obj):
        return obj.container.name if obj.container else None
    
    def get_ingredients_count(self, obj):
        return obj.recipeitem_set.count()
    
    def get_ingredients_list(self, obj):
        """Retorna lista de ingredientes con sus cantidades"""
        recipe_items = obj.recipeitem_set.all()
        return [
            {
                'id': item.ingredient.id,
                'name': item.ingredient.name,
                'quantity': str(item.quantity),
                'unit': item.ingredient.unit.name,
                'unit_price': str(item.ingredient.unit_price),
                'total_cost': str(item.ingredient.unit_price * item.quantity)
            }
            for item in recipe_items
        ]
    
    def get_is_available_calculated(self, obj):
        return obj.check_availability()
    
    def get_ingredients_cost(self, obj):
        return obj.calculate_ingredients_cost()
    
    def get_profit_amount(self, obj):
        ingredients_cost = obj.calculate_ingredients_cost()
        if obj.profit_percentage > 0:
            return ingredients_cost * (obj.profit_percentage / 100)
        return 0


class RecipeDetailSerializer(RecipeSerializer):
    group_detail = GroupSerializer(source='group', read_only=True)
    recipe_items = RecipeItemSerializer(source='recipeitem_set', many=True, read_only=True)
    calculated_price = serializers.SerializerMethodField()
    
    class Meta(RecipeSerializer.Meta):
        fields = RecipeSerializer.Meta.fields + ['group_detail', 'recipe_items', 'calculated_price']
    
    def get_calculated_price(self, obj):
        return obj.calculate_base_price()


class RecipeItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecipeItem
        fields = ['ingredient', 'quantity']
    
    def validate(self, data):
        recipe = self.context['recipe']
        ingredient = data['ingredient']
        
        # Verificar que no exista ya este ingrediente en la receta
        if RecipeItem.objects.filter(recipe=recipe, ingredient=ingredient).exists():
            raise serializers.ValidationError(
                f"El ingrediente {ingredient.name} ya está en esta receta"
            )
        
        return data


class RecipeWithItemsCreateSerializer(serializers.ModelSerializer):
    recipe_items = serializers.ListField(
        child=serializers.DictField(), 
        write_only=True,
        required=False
    )
    group_name = serializers.SerializerMethodField()
    container_name = serializers.SerializerMethodField()
    ingredients_count = serializers.SerializerMethodField()
    ingredients_list = serializers.SerializerMethodField()
    is_available_calculated = serializers.SerializerMethodField()
    ingredients_cost = serializers.SerializerMethodField()
    profit_amount = serializers.SerializerMethodField()
    # Aliases para compatibilidad con frontend
    price = serializers.DecimalField(source='base_price', max_digits=10, decimal_places=2, read_only=True)
    unit_price = serializers.DecimalField(source='base_price', max_digits=10, decimal_places=2, read_only=True)
    cost = serializers.DecimalField(source='base_price', max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = Recipe
        fields = [
            'id', 'group', 'group_name', 'container', 'container_name', 'name', 'version', 'base_price', 'price', 'unit_price', 'cost', 'profit_percentage',
            'ingredients_cost', 'profit_amount', 'is_available', 'is_active', 'is_available_calculated',
            'preparation_time', 'ingredients_count', 'ingredients_list', 'created_at', 'updated_at', 
            'recipe_items'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        recipe_items_data = validated_data.pop('recipe_items', [])
        
        # Crear receta
        recipe = Recipe.objects.create(**validated_data)
        
        # Crear items de receta
        for item_data in recipe_items_data:
            RecipeItem.objects.create(
                recipe=recipe, 
                ingredient_id=item_data['ingredient'],
                quantity=item_data['quantity']
            )
        
        # Actualizar precio base automáticamente si hay ingredientes
        if recipe_items_data:
            recipe.update_base_price()
        
        return recipe
    
    def update(self, instance, validated_data):
        recipe_items_data = validated_data.pop('recipe_items', None)
        
        # Actualizar campos de la receta
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Si se proporcionaron recipe_items, reemplazar todos
        if recipe_items_data is not None:
            # Eliminar items existentes
            instance.recipeitem_set.all().delete()
            
            # Crear nuevos items
            for item_data in recipe_items_data:
                RecipeItem.objects.create(
                    recipe=instance, 
                    ingredient_id=item_data['ingredient'],
                    quantity=item_data['quantity']
                )
            
            # Actualizar precio base
            instance.update_base_price()
        
        return instance
    
    def get_group_name(self, obj):
        return obj.group.name if obj.group else None
    
    def get_container_name(self, obj):
        return obj.container.name if obj.container else None
    
    def get_ingredients_count(self, obj):
        return obj.recipeitem_set.count()
    
    def get_ingredients_list(self, obj):
        """Retorna lista de ingredientes con sus cantidades"""
        recipe_items = obj.recipeitem_set.all()
        return [
            {
                'id': item.ingredient.id,
                'name': item.ingredient.name,
                'quantity': str(item.quantity),
                'unit': item.ingredient.unit.name,
                'unit_price': str(item.ingredient.unit_price),
                'total_cost': str(item.ingredient.unit_price * item.quantity)
            }
            for item in recipe_items
        ]
    
    def get_is_available_calculated(self, obj):
        return obj.check_availability()
    
    def get_ingredients_cost(self, obj):
        return obj.calculate_ingredients_cost()
    
    def get_profit_amount(self, obj):
        ingredients_cost = obj.calculate_ingredients_cost()
        if obj.profit_percentage > 0:
            return ingredients_cost * (obj.profit_percentage / 100)
        return 0