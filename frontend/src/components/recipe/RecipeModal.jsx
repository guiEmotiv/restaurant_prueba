import { useState, useEffect } from 'react';
import { X, Plus, Minus, Save, AlertCircle } from 'lucide-react';
import Button from '../common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const RecipeModal = ({ isOpen, onClose, recipe = null, onSave }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    base_price: '',
    preparation_time: '',
    is_available: true
  });
  
  const [ingredients, setIngredients] = useState([]);
  const [recipeItems, setRecipeItems] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadAvailableIngredients();
      if (recipe) {
        // Modo edición
        setFormData({
          name: recipe.name || '',
          base_price: recipe.base_price || '',
          preparation_time: recipe.preparation_time || '',
          is_available: recipe.is_available !== undefined ? recipe.is_available : true
        });
        loadRecipeItems();
      } else {
        // Modo creación
        resetForm();
      }
    }
  }, [isOpen, recipe]);

  const resetForm = () => {
    setFormData({
      name: '',
      base_price: '',
      preparation_time: '',
      is_available: true
    });
    setRecipeItems([]);
    setErrors({});
  };

  const loadAvailableIngredients = async () => {
    try {
      const data = await apiService.ingredients.getAll();
      setAvailableIngredients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading ingredients:', error);
    }
  };

  const loadRecipeItems = async () => {
    if (!recipe?.id) return;
    
    try {
      const response = await fetch(`http://localhost:8000/api/v1/recipe-items/?recipe=${recipe.id}`);
      const data = await response.json();
      
      const items = Array.isArray(data) ? data : [];
      setRecipeItems(items.map(item => ({
        id: item.id,
        ingredient: item.ingredient,
        ingredient_name: item.ingredient_name,
        ingredient_unit: item.ingredient_unit,
        quantity: item.quantity
      })));
    } catch (error) {
      console.error('Error loading recipe items:', error);
      setRecipeItems([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Limpiar error cuando el usuario empiece a escribir
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const addRecipeItem = () => {
    setRecipeItems(prev => [...prev, {
      id: null,
      ingredient: '',
      ingredient_name: '',
      ingredient_unit: '',
      quantity: ''
    }]);
  };

  const removeRecipeItem = (index) => {
    setRecipeItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateRecipeItem = (index, field, value) => {
    setRecipeItems(prev => prev.map((item, i) => {
      if (i === index) {
        if (field === 'ingredient') {
          const selectedIngredient = availableIngredients.find(ing => ing.id === parseInt(value));
          return {
            ...item,
            ingredient: value,
            ingredient_name: selectedIngredient?.name || '',
            ingredient_unit: selectedIngredient?.unit_name || '',
            ingredient_unit_price: selectedIngredient?.unit_price || 0
          };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Función para calcular precio sugerido basado en ingredientes
  const calculateSuggestedPrice = () => {
    const totalCost = recipeItems.reduce((total, item) => {
      if (item.ingredient && item.quantity) {
        const ingredient = availableIngredients.find(ing => ing.id === parseInt(item.ingredient));
        if (ingredient) {
          return total + (parseFloat(ingredient.unit_price) * parseFloat(item.quantity));
        }
      }
      return total;
    }, 0);
    
    // Sugerir precio con 60% de margen de ganancia
    return totalCost > 0 ? (totalCost * 1.6).toFixed(2) : '';
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    
    if (!formData.base_price || parseFloat(formData.base_price) <= 0) {
      newErrors.base_price = 'El precio debe ser mayor a 0';
    }
    
    if (!formData.preparation_time || parseInt(formData.preparation_time) <= 0) {
      newErrors.preparation_time = 'El tiempo de preparación debe ser mayor a 0';
    }
    
    // Validar ingredientes
    const validItems = recipeItems.filter(item => 
      item.ingredient && parseFloat(item.quantity) > 0
    );
    
    if (validItems.length === 0) {
      newErrors.ingredients = 'Debe agregar al menos un ingrediente';
    }
    
    // Validar cada item de ingrediente
    recipeItems.forEach((item, index) => {
      if (item.ingredient && (!item.quantity || parseFloat(item.quantity) <= 0)) {
        newErrors[`quantity_${index}`] = 'La cantidad debe ser mayor a 0';
      }
      if (item.quantity && !item.ingredient) {
        newErrors[`ingredient_${index}`] = 'Debe seleccionar un ingrediente';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const recipeData = {
        name: formData.name.trim(),
        base_price: parseFloat(formData.base_price),
        preparation_time: parseInt(formData.preparation_time),
        is_available: formData.is_available
      };
      
      let savedRecipe;
      if (recipe?.id) {
        // Actualizar receta existente
        savedRecipe = await apiService.recipes.update(recipe.id, recipeData);
      } else {
        // Crear nueva receta
        savedRecipe = await apiService.recipes.create(recipeData);
      }
      
      // Gestionar ingredientes
      const validItems = recipeItems.filter(item => 
        item.ingredient && parseFloat(item.quantity) > 0
      );
      
      // Si estamos editando, primero eliminar items existentes
      if (recipe?.id) {
        try {
          const existingItems = await fetch(`http://localhost:8000/api/v1/recipe-items/?recipe=${recipe.id}`);
          const existingData = await existingItems.json();
          const existingItemsArray = Array.isArray(existingData) ? existingData : [];
          
          for (const item of existingItemsArray) {
            await apiService.recipeItems.delete(item.id);
          }
        } catch (error) {
          console.warn('Error deleting existing items:', error);
        }
      }
      
      // Crear nuevos items
      for (const item of validItems) {
        const itemData = {
          recipe: savedRecipe.id,
          ingredient: parseInt(item.ingredient),
          quantity: parseFloat(item.quantity)
        };
        await apiService.recipeItems.create(itemData);
      }
      
      onSave();
      onClose();
      showSuccess(recipe ? 'Receta actualizada exitosamente' : 'Receta creada exitosamente');
    } catch (error) {
      console.error('Error saving recipe:', error);
      showError('Error al guardar la receta');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {recipe ? 'Editar Receta' : 'Nueva Receta'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {/* Información básica */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Receta *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ej: Arroz con Pollo"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precio Base (S/) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="base_price"
                    value={formData.base_price}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0.01"
                    className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      errors.base_price ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="18.50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const suggestedPrice = calculateSuggestedPrice();
                      if (suggestedPrice) {
                        setFormData(prev => ({ ...prev, base_price: suggestedPrice }));
                      }
                    }}
                    className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                    title="Calcular precio sugerido con base en ingredientes"
                  >
                    💡 Auto
                  </button>
                </div>
                {errors.base_price && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.base_price}
                  </p>
                )}
                {recipeItems.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    💡 Precio sugerido: S/ {calculateSuggestedPrice() || '0.00'} (costo + 60% ganancia)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tiempo de Preparación (minutos) *
                </label>
                <input
                  type="number"
                  name="preparation_time"
                  value={formData.preparation_time}
                  onChange={handleInputChange}
                  min="1"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.preparation_time ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="25"
                />
                {errors.preparation_time && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.preparation_time}
                  </p>
                )}
              </div>

              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_available"
                    checked={formData.is_available}
                    onChange={handleInputChange}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Disponible en el menú</span>
                </label>
              </div>
            </div>

            {/* Ingredientes */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Ingredientes</h3>
                <Button
                  onClick={addRecipeItem}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Agregar Ingrediente
                </Button>
              </div>

              {errors.ingredients && (
                <p className="mb-4 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.ingredients}
                </p>
              )}

              <div className="space-y-3">
                {recipeItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay ingredientes agregados</p>
                    <p className="text-sm">Haga clic en "Agregar Ingrediente" para comenzar</p>
                  </div>
                ) : (
                  recipeItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <select
                          value={item.ingredient}
                          onChange={(e) => updateRecipeItem(index, 'ingredient', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            errors[`ingredient_${index}`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="">Seleccionar ingrediente...</option>
                          {availableIngredients.map(ingredient => (
                            <option key={ingredient.id} value={ingredient.id}>
                              {ingredient.name} ({ingredient.unit_name})
                            </option>
                          ))}
                        </select>
                        {errors[`ingredient_${index}`] && (
                          <p className="mt-1 text-sm text-red-600">{errors[`ingredient_${index}`]}</p>
                        )}
                      </div>
                      
                      <div className="w-32">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateRecipeItem(index, 'quantity', e.target.value)}
                          placeholder="Cantidad"
                          step="0.01"
                          min="0.01"
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            errors[`quantity_${index}`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors[`quantity_${index}`] && (
                          <p className="mt-1 text-sm text-red-600">{errors[`quantity_${index}`]}</p>
                        )}
                      </div>
                      
                      {item.ingredient_unit && (
                        <div className="w-16 text-sm text-gray-600 text-center">
                          {item.ingredient_unit}
                        </div>
                      )}
                      
                      <button
                        onClick={() => removeRecipeItem(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Eliminar ingrediente"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={onClose}
            variant="secondary"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {recipe ? 'Actualizar Receta' : 'Crear Receta'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RecipeModal;