from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from decimal import Decimal
from config.models import Category, Unit


class Group(models.Model):
    """Grupos para categorizar recetas"""
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'group'
        verbose_name = 'Grupo'
        verbose_name_plural = 'Grupos'

    def __str__(self):
        return self.name

    def delete(self, *args, **kwargs):
        if self.recipe_set.exists():
            raise ValidationError("No se puede eliminar un grupo que tiene recetas asociadas")
        super().delete(*args, **kwargs)


class Ingredient(models.Model):
    """Ingredientes del inventario"""
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
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
        self.save()


class Recipe(models.Model):
    """Recetas del menú"""
    group = models.ForeignKey(Group, on_delete=models.PROTECT, null=True, blank=True)
    name = models.CharField(max_length=100, unique=True)
    base_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    is_available = models.BooleanField(default=True)
    preparation_time = models.PositiveIntegerField(help_text="Tiempo en minutos")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recipe'
        verbose_name = 'Receta'
        verbose_name_plural = 'Recetas'

    def __str__(self):
        return self.name

    def calculate_base_price(self):
        """Calcula el precio base basado en los ingredientes"""
        total_cost = Decimal('0.00')
        for recipe_item in self.recipeitem_set.all():
            ingredient_cost = recipe_item.ingredient.unit_price * recipe_item.quantity
            total_cost += ingredient_cost
        return total_cost

    def update_base_price(self):
        """Actualiza el precio base cuando cambian los precios de ingredientes"""
        self.base_price = self.calculate_base_price()
        self.save()

    def check_availability(self):
        """Verifica si la receta está disponible según el stock"""
        for recipe_item in self.recipeitem_set.all():
            if recipe_item.ingredient.current_stock < recipe_item.quantity:
                return False
        return True

    def consume_ingredients(self):
        """Consume los ingredientes del stock cuando se prepara la receta"""
        for recipe_item in self.recipeitem_set.all():
            recipe_item.ingredient.update_stock(recipe_item.quantity, 'subtract')


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
