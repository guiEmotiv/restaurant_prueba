from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from decimal import Decimal
from config.models import Unit, Container


class Group(models.Model):
    """Grupos para categorizar recetas"""
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'group'
        verbose_name = 'Grupo'
        verbose_name_plural = 'Grupos'
        ordering = ['-id']

    def __str__(self):
        return self.name

    def delete(self, *args, **kwargs):
        if self.recipe_set.exists():
            raise ValidationError("No se puede eliminar un grupo que tiene recetas asociadas")
        super().delete(*args, **kwargs)


class Ingredient(models.Model):
    """Ingredientes del inventario"""
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    name = models.CharField(max_length=100, unique=True)
    unit_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    current_stock = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ingredient'
        verbose_name = 'Ingrediente'
        verbose_name_plural = 'Ingredientes'
        ordering = ['-id']

    def __str__(self):
        return f"{self.name} ({self.unit.name})"

    def delete(self, *args, **kwargs):
        if self.recipeitem_set.exists():
            raise ValidationError("No se puede eliminar un ingrediente que pertenece a una receta")
        super().delete(*args, **kwargs)

    def update_stock(self, quantity, operation='subtract'):
        """Actualiza el stock del ingrediente"""
        if operation == 'subtract':
            if self.current_stock < quantity:
                raise ValidationError(f"Stock insuficiente. Stock actual: {self.current_stock}")
            self.current_stock -= quantity
        elif operation == 'add':
            self.current_stock += quantity
        
        # Actualizar is_active basado en el stock
        self.is_active = self.current_stock > 0
        self.save()


class Recipe(models.Model):
    """Recetas del menú"""
    group = models.ForeignKey(Group, on_delete=models.PROTECT, null=True, blank=True)
    container = models.ForeignKey(
        Container, 
        on_delete=models.PROTECT, 
        null=True, 
        blank=True,
        help_text="Envase recomendado para pedidos para llevar"
    )
    name = models.CharField(max_length=100)
    version = models.CharField(
        max_length=10, 
        default='1.0',
        help_text="Versión de la receta (ej: 1.0, 1.1, 2.0)"
    )
    base_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    profit_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Porcentaje de ganancia sobre el costo de ingredientes"
    )
    is_available = models.BooleanField(default=True)
    is_active = models.BooleanField(
        default=True,
        help_text="Solo las versiones activas se muestran al crear pedidos"
    )
    preparation_time = models.PositiveIntegerField(help_text="Tiempo en minutos")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recipe'
        verbose_name = 'Receta'
        verbose_name_plural = 'Recetas'
        unique_together = ['name', 'version']
        ordering = ['-id']

    def __str__(self):
        return f"{self.name} v{self.version}"

    def calculate_ingredients_cost(self):
        """Calcula el costo total de los ingredientes"""
        total_cost = Decimal('0.00')
        for recipe_item in self.recipeitem_set.all():
            ingredient_cost = recipe_item.ingredient.unit_price * recipe_item.quantity
            total_cost += ingredient_cost
        return total_cost

    def calculate_base_price(self):
        """Calcula el precio base basado en los ingredientes y el porcentaje de ganancia"""
        ingredients_cost = self.calculate_ingredients_cost()
        if self.profit_percentage > 0:
            profit_amount = ingredients_cost * (self.profit_percentage / Decimal('100.00'))
            return ingredients_cost + profit_amount
        return ingredients_cost

    def update_base_price(self):
        """Actualiza el precio base cuando cambian los precios de ingredientes o porcentaje de ganancia"""
        self.base_price = self.calculate_base_price()
        self.save()

    def check_availability(self):
        """Verifica si la receta está disponible según el stock (independiente de is_active)"""
        if not self.is_available:
            return False
        for recipe_item in self.recipeitem_set.all():
            if not recipe_item.ingredient.is_active or recipe_item.ingredient.current_stock < recipe_item.quantity:
                return False
        return True
    
    def has_sufficient_stock(self):
        """Verifica si hay stock suficiente para preparar la receta (solo chequeo de stock)"""
        for recipe_item in self.recipeitem_set.all():
            if not recipe_item.ingredient.is_active or recipe_item.ingredient.current_stock < recipe_item.quantity:
                return False
        return True
    
    def save(self, *args, **kwargs):
        # No modificar automáticamente is_available, debe ser controlado manualmente
        super().save(*args, **kwargs)

    def consume_ingredients(self):
        """Consume los ingredientes del stock cuando se prepara la receta"""
        for recipe_item in self.recipeitem_set.all():
            recipe_item.ingredient.update_stock(recipe_item.quantity, 'subtract')

    def delete(self, *args, **kwargs):
        """Override delete para validar que no haya ordenes asociadas"""
        # Verificar si hay OrderItems que usan esta receta
        from operation.models import OrderItem
        if OrderItem.objects.filter(recipe=self).exists():
            raise ValidationError("No se puede eliminar una receta que ha sido utilizada en órdenes")
        super().delete(*args, **kwargs)


class RecipeItem(models.Model):
    """Ingredientes que componen una receta"""
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE)
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT)
    quantity = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'recipe_item'
        verbose_name = 'Ingrediente de Receta'
        verbose_name_plural = 'Ingredientes de Recetas'
        unique_together = ['recipe', 'ingredient']

    def __str__(self):
        return f"{self.recipe.name} - {self.ingredient.name} ({self.quantity})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Actualizar precio base de la receta cuando se modifica un ingrediente
        self.recipe.update_base_price()
