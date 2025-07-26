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
    profit_percentage: '0.00'
  });
  
  const [recipeItems, setRecipeItems] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, recipe]);

  const loadData = async () => {
    await loadAvailableIngredients();
    await loadAvailableGroups();
    
    if (recipe) {
      // Modo edición
      setFormData({
        name: recipe.name || '',
        group: recipe.group || '',
        preparation_time: recipe.preparation_time || '',
        profit_percentage: recipe.profit_percentage || '0.00'
      });
      // Cargar items después de que los ingredientes estén disponibles
      await loadRecipeItems();
    } else {
      // Modo creación
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      group: '',
      preparation_time: '',
      profit_percentage: '0.00'
    });
    setRecipeItems([]);
    setErrors({});
  };

  const loadAvailableIngredients = async () => {
    try {
      // Cargar TODOS los ingredientes (incluyendo inactivos) para mostrar completa la receta
      const data = await apiService.ingredients.getAll({ show_all: true });
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
      setRecipeItems(items.map(item => {
        // Buscar el stock actual del ingrediente
        const ingredient = availableIngredients.find(ing => ing.id === item.ingredient);
        return {
          id: item.id,
          ingredient: item.ingredient,
          ingredient_name: item.ingredient_name,
          ingredient_unit: item.ingredient_unit,
          ingredient_unit_price: item.ingredient_unit_price,
          ingredient_current_stock: ingredient?.current_stock || 0,
          quantity: item.quantity
        };
      }));
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
            ingredient_unit_price: selectedIngredient?.unit_price || 0,
            ingredient_current_stock: selectedIngredient?.current_stock || 0
          };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Función para verificar si un ingrediente tiene stock insuficiente
  const hasInsufficientStock = (item) => {
    if (!item.ingredient || !item.quantity) return false;
    const ingredient = availableIngredients.find(ing => ing.id === parseInt(item.ingredient));
    if (!ingredient) return false;
    return parseFloat(ingredient.current_stock) < parseFloat(item.quantity);
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    
    if (!formData.preparation_time || parseInt(formData.preparation_time) <= 0) {
      newErrors.preparation_time = 'El tiempo de preparación debe ser mayor a 0';
    }
    
    const profitPercentage = parseFloat(formData.profit_percentage);
    if (isNaN(profitPercentage) || profitPercentage < 0) {
      newErrors.profit_percentage = 'El porcentaje de ganancia debe ser un número válido mayor o igual a 0';
    } else if (profitPercentage > 100) {
      newErrors.profit_percentage = 'El porcentaje de ganancia no puede ser mayor a 100%';
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
      const ingredientsCost = recipeItems.reduce((total, item) => {
        if (item.ingredient && item.quantity && item.ingredient_unit_price) {
          return total + (parseFloat(item.ingredient_unit_price) * parseFloat(item.quantity));
        }
        return total;
      }, 0);
      
      const profitPercentage = parseFloat(formData.profit_percentage) || 0;
      const profitAmount = ingredientsCost * (profitPercentage / 100);
      const finalPrice = ingredientsCost + profitAmount;
      
      const recipeData = {
        name: formData.name.trim(),
        group: formData.group || null,
        base_price: finalPrice > 0 ? finalPrice.toFixed(2) : "0.01", // Backend requiere precio mínimo como string
        profit_percentage: parseFloat(formData.profit_percentage) || 0,
        preparation_time: parseInt(formData.preparation_time),
        is_available: true, // Por defecto siempre disponible
        recipe_items: validItems.map(item => ({
          ingredient: parseInt(item.ingredient),
          quantity: parseFloat(item.quantity)
        }))
      };
      
      console.log('Costo ingredientes:', ingredientsCost);
      console.log('Porcentaje ganancia:', profitPercentage);
      console.log('Precio final:', finalPrice);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[95vh] md:h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">
              {recipe ? 'Editar Receta' : 'Nueva Receta'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 md:p-0"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="space-y-6">
            {/* Información básica */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Información Básica</h3>
              <div className="space-y-4">
                {/* Primera fila: Nombre y Grupo */}
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
                </div>

                {/* Segunda fila: Tiempo de Preparación y Porcentaje de Ganancia */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Porcentaje de Ganancia (%)
                    </label>
                    <input
                      type="number"
                      name="profit_percentage"
                      value={formData.profit_percentage}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      step="0.01"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        errors.profit_percentage ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="25.00"
                    />
                    {errors.profit_percentage && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.profit_percentage}
                      </p>
                    )}
                  </div>
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
                    {/* Desktop Table Header */}
                    <div className="hidden md:grid grid-cols-12 gap-3 px-3 py-2 bg-gray-100 rounded-md text-sm font-medium text-gray-700">
                      <div className="col-span-5">Ingrediente</div>
                      <div className="col-span-2 text-center">Cantidad</div>
                      <div className="col-span-2 text-center">Unidad</div>
                      <div className="col-span-2 text-center">Subtotal</div>
                      <div className="col-span-1 text-center">Acción</div>
                    </div>
                    
                    {recipeItems.map((item, index) => (
                      <div key={index}>
                        {/* Desktop View */}
                        <div className={`hidden md:grid grid-cols-12 gap-3 p-3 border border-gray-200 rounded-lg items-center ${
                          hasInsufficientStock(item) ? 'bg-red-50 border-red-300' : 'bg-white'
                        }`}>
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
                            <div>{item.ingredient_unit || '-'}</div>
                            {item.ingredient && (
                              <div className={`text-xs mt-1 ${
                                hasInsufficientStock(item) ? 'text-red-600 font-semibold' : 'text-gray-500'
                              }`}>
                                Stock: {availableIngredients.find(ing => ing.id === parseInt(item.ingredient))?.current_stock || 0}
                                {hasInsufficientStock(item) && (
                                  <div className="text-red-600 font-bold">¡Sin stock suficiente!</div>
                                )}
                              </div>
                            )}
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

                        {/* Mobile View */}
                        <div className={`md:hidden p-4 border border-gray-200 rounded-lg space-y-3 ${
                          hasInsufficientStock(item) ? 'bg-red-50 border-red-300' : 'bg-white'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Ingrediente #{index + 1}</span>
                            <button
                              onClick={() => removeRecipeItem(index)}
                              className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-full"
                              title="Eliminar ingrediente"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ingrediente</label>
                            <select
                              value={item.ingredient}
                              onChange={(e) => updateRecipeItem(index, 'ingredient', e.target.value)}
                              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                errors[`ingredient_${index}`] ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">Seleccionar ingrediente...</option>
                              {availableIngredients.map(ingredient => {
                                const isAlreadySelected = recipeItems.some((otherItem, otherIndex) => 
                                  otherIndex !== index && 
                                  otherItem.ingredient === ingredient.id.toString()
                                );
                                return (
                                  <option 
                                    key={ingredient.id} 
                                    value={ingredient.id}
                                    disabled={isAlreadySelected}
                                  >
                                    {ingredient.name} - S/ {ingredient.unit_price} {isAlreadySelected ? ' (Ya seleccionado)' : ''}
                                  </option>
                                );
                              })}
                            </select>
                            {errors[`ingredient_${index}`] && (
                              <p className="mt-1 text-sm text-red-600">{errors[`ingredient_${index}`]}</p>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateRecipeItem(index, 'quantity', e.target.value)}
                                placeholder="0.0"
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
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                                <div>{item.ingredient_unit || '-'}</div>
                                {item.ingredient && (
                                  <div className={`text-xs mt-1 ${
                                    hasInsufficientStock(item) ? 'text-red-600 font-semibold' : 'text-gray-500'
                                  }`}>
                                    Stock disponible: {availableIngredients.find(ing => ing.id === parseInt(item.ingredient))?.current_stock || 0}
                                    {hasInsufficientStock(item) && (
                                      <div className="text-red-600 font-bold">¡Sin stock suficiente!</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="bg-blue-50 p-3 rounded-md">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-blue-700">Subtotal:</span>
                              <span className="text-lg font-bold text-blue-900">
                                {item.ingredient_unit_price && item.quantity ? 
                                  `S/ ${(parseFloat(item.ingredient_unit_price) * parseFloat(item.quantity)).toFixed(2)}` : 
                                  'S/ 0.00'
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Resumen de precios */}
        {recipeItems.length > 0 && (
          <div className="px-4 md:px-6 pb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-800 mb-3">Resumen de Costos</h4>
              {(() => {
                const ingredientsCost = recipeItems.reduce((total, item) => {
                  if (item.ingredient && item.quantity && item.ingredient_unit_price) {
                    return total + (parseFloat(item.ingredient_unit_price) * parseFloat(item.quantity));
                  }
                  return total;
                }, 0);
                
                const profitPercentage = parseFloat(formData.profit_percentage) || 0;
                const profitAmount = ingredientsCost * (profitPercentage / 100);
                const finalPrice = ingredientsCost + profitAmount;
                
                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Costo de ingredientes:</span>
                      <span className="font-medium">S/ {ingredientsCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Ganancia ({profitPercentage}%):</span>
                      <span className="font-medium">S/ {profitAmount.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-green-300 pt-2 flex justify-between">
                      <span className="font-semibold text-green-800">Precio base final:</span>
                      <span className="font-bold text-green-900 text-lg">S/ {finalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 p-4 md:p-6 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={onClose}
            variant="secondary"
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full sm:w-auto"
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