import { useState, useEffect } from 'react';
import { X, Plus, Minus, Save, Package } from 'lucide-react';
import Button from '../common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const RecipeModal = ({ isOpen, onClose, recipe = null, onSave }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    group: '',
    preparation_time: '',
    is_available: true
  });
  
  const [recipeItems, setRecipeItems] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadAvailableIngredients();
      loadAvailableGroups();
      if (recipe) {
        // Modo edición
        setFormData({
          name: recipe.name || '',
          group: recipe.group || '',
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
      group: '',
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

  const loadAvailableGroups = async () => {
    try {
      const data = await apiService.groups.getAll();
      setAvailableGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadRecipeItems = async () => {
    if (!recipe?.id) return;
    
    try {
      const response = await apiService.recipeItems.getByRecipe(recipe.id);
      const items = Array.isArray(response) ? response : [];
      setRecipeItems(items.map(item => ({
        id: item.id,
        ingredient: item.ingredient,
        ingredient_name: item.ingredient_name,
        ingredient_unit: item.ingredient_unit,
        ingredient_unit_price: item.ingredient_unit_price,
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
      ingredient_unit_price: '',
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

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    
    if (!formData.preparation_time || parseInt(formData.preparation_time) <= 0) {
      newErrors.preparation_time = 'El tiempo de preparación debe ser mayor a 0';
    }
    
    // Validar ingredientes - al menos uno debe estar completo
    const validItems = recipeItems.filter(item => 
      item.ingredient && item.ingredient !== '' && 
      item.quantity && parseFloat(item.quantity) > 0
    );
    
    if (validItems.length === 0) {
      newErrors.ingredients = 'Debe agregar al menos un ingrediente válido';
    }
    
    // Validar duplicados
    const ingredientIds = validItems.map(item => item.ingredient);
    const duplicates = ingredientIds.filter((id, index) => ingredientIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      newErrors.ingredients = 'No se pueden agregar ingredientes duplicados';
    }
    
    // Validar cada item de ingrediente que tenga datos
    recipeItems.forEach((item, index) => {
      if (item.ingredient && item.ingredient !== '') {
        if (!item.quantity || parseFloat(item.quantity) <= 0) {
          newErrors[`quantity_${index}`] = 'La cantidad debe ser mayor a 0';
        }
        
        // Verificar si hay duplicados para este item específico
        const sameIngredientCount = recipeItems.filter(otherItem => 
          otherItem.ingredient === item.ingredient && otherItem.ingredient !== ''
        ).length;
        if (sameIngredientCount > 1) {
          newErrors[`ingredient_${index}`] = 'Ingrediente duplicado';
        }
      }
      if (item.quantity && parseFloat(item.quantity) > 0) {
        if (!item.ingredient || item.ingredient === '') {
          newErrors[`ingredient_${index}`] = 'Debe seleccionar un ingrediente';
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      // Gestionar ingredientes - solo los que están completos
      const validItems = recipeItems.filter(item => 
        item.ingredient && item.ingredient !== '' && 
        item.quantity && parseFloat(item.quantity) > 0
      );
      
      // Calcular precio automáticamente basado en ingredientes
      const totalCost = recipeItems.reduce((total, item) => {
        if (item.ingredient && item.quantity && item.ingredient_unit_price) {
          return total + (parseFloat(item.ingredient_unit_price) * parseFloat(item.quantity));
        }
        return total;
      }, 0);
      
      const recipeData = {
        name: formData.name.trim(),
        group: formData.group || null,
        base_price: totalCost > 0 ? totalCost.toFixed(2) : "0.01", // Backend requiere precio mínimo como string
        preparation_time: parseInt(formData.preparation_time),
        is_available: formData.is_available,
        recipe_items: validItems.map(item => ({
          ingredient: parseInt(item.ingredient),
          quantity: parseFloat(item.quantity)
        }))
      };
      
      console.log('Costo total calculado:', totalCost);
      console.log('Ingredientes válidos:', validItems);
      console.log('Guardando receta:', recipeData);
      
      let savedRecipe;
      if (recipe?.id) {
        // Actualizar receta existente - usar el endpoint especial que maneja ingredientes
        savedRecipe = await apiService.recipes.update(recipe.id, recipeData);
      } else {
        // Crear nueva receta con ingredientes en una sola llamada
        savedRecipe = await apiService.recipes.create(recipeData);
      }
      
      onSave();
      onClose();
      showSuccess(recipe ? 'Receta actualizada exitosamente' : 'Receta creada exitosamente');
    } catch (error) {
      console.error('Error saving recipe:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.error || 
                          (error.response?.data && typeof error.response.data === 'object' ? 
                            JSON.stringify(error.response.data) : 
                            error.message);
      showError('Error al guardar la receta: ' + errorMessage);
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
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {recipe ? 'Editar Receta' : 'Nueva Receta'}
            </h2>
          </div>
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
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Información Básica</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
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
                    <p className="mt-1 text-sm text-red-600">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grupo
                  </label>
                  <select
                    name="group"
                    value={formData.group}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Sin grupo</option>
                    {availableGroups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tiempo de Preparación (min) *
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
                    <p className="mt-1 text-sm text-red-600">
                      {errors.preparation_time}
                    </p>
                  )}
                </div>


                <div className="flex items-center pt-6">
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
            </div>

            {/* Ingredientes */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Ingredientes *</h3>
                <Button
                  onClick={addRecipeItem}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </div>

              {errors.ingredients && (
                <p className="mb-4 text-sm text-red-600">
                  {errors.ingredients}
                </p>
              )}

              <div className="space-y-3">
                {recipeItems.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                    <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="font-medium">No hay ingredientes agregados</p>
                    <p className="text-sm">El precio se calculará automáticamente al agregar ingredientes</p>
                  </div>
                ) : (
                  <>
                    {/* Header de tabla */}
                    <div className="grid grid-cols-12 gap-3 px-3 py-2 bg-gray-100 rounded-md text-sm font-medium text-gray-700">
                      <div className="col-span-5">Ingrediente</div>
                      <div className="col-span-2 text-center">Cantidad</div>
                      <div className="col-span-2 text-center">Unidad</div>
                      <div className="col-span-2 text-center">Subtotal</div>
                      <div className="col-span-1 text-center">Acción</div>
                    </div>
                    
                    {recipeItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-3 p-3 border border-gray-200 rounded-lg bg-white items-center">
                        <div className="col-span-5">
                          <select
                            value={item.ingredient}
                            onChange={(e) => updateRecipeItem(index, 'ingredient', e.target.value)}
                            className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm ${
                              errors[`ingredient_${index}`] ? 'border-red-500' : 'border-gray-300'
                            }`}
                          >
                            <option value="">Seleccionar...</option>
                            {availableIngredients.map(ingredient => {
                              // Deshabilitar ingredientes ya seleccionados en otros items
                              const isAlreadySelected = recipeItems.some((otherItem, otherIndex) => 
                                otherIndex !== index && 
                                otherItem.ingredient === ingredient.id.toString()
                              );
                              return (
                                <option 
                                  key={ingredient.id} 
                                  value={ingredient.id}
                                  disabled={isAlreadySelected}
                                  style={isAlreadySelected ? { color: '#999', backgroundColor: '#f5f5f5' } : {}}
                                >
                                  {ingredient.name} (S/ {ingredient.unit_price}) {isAlreadySelected ? ' - Ya seleccionado' : ''}
                                </option>
                              );
                            })}
                          </select>
                          {errors[`ingredient_${index}`] && (
                            <p className="mt-1 text-xs text-red-600">{errors[`ingredient_${index}`]}</p>
                          )}
                        </div>
                        
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateRecipeItem(index, 'quantity', e.target.value)}
                            placeholder="0.0"
                            step="0.01"
                            min="0.01"
                            className={`w-full px-2 py-1 border rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              errors[`quantity_${index}`] ? 'border-red-500' : 'border-gray-300'
                            }`}
                          />
                          {errors[`quantity_${index}`] && (
                            <p className="mt-1 text-xs text-red-600">{errors[`quantity_${index}`]}</p>
                          )}
                        </div>
                        
                        <div className="col-span-2 text-center text-sm text-gray-600 font-medium">
                          {item.ingredient_unit || '-'}
                        </div>

                        <div className="col-span-2 text-center text-sm font-semibold text-gray-900">
                          {item.ingredient_unit_price && item.quantity ? 
                            `S/ ${(parseFloat(item.ingredient_unit_price) * parseFloat(item.quantity)).toFixed(2)}` : 
                            'S/ 0.00'
                          }
                        </div>
                        
                        <div className="col-span-1 text-center">
                          <button
                            onClick={() => removeRecipeItem(index)}
                            className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
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