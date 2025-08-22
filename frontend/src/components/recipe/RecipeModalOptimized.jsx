import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Plus, Minus, Save, Package, AlertTriangle } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

/**
 * Modal optimizado para creación/edición de recetas
 * Funcionalidades mejoradas:
 * - Mejor manejo de errores del backend
 * - Estado del checkbox is_active más consistente
 * - Validaciones optimizadas
 */
const RecipeModalOptimized = ({ isOpen, onClose, recipe = null, onSave }) => {
  const { showSuccess, showError } = useToast();
  
  // Estados principales
  const [formData, setFormData] = useState({
    name: '',
    version: '1.0',
    group: '',
    container: '',
    preparation_time: '',
    profit_percentage: '0.00',
    is_active: true
  });
  
  const [recipeItems, setRecipeItems] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [availableContainers, setAvailableContainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  

  // Reset del formulario
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      version: '1.0',
      group: '',
      container: '',
      preparation_time: '',
      profit_percentage: '0.00',
      is_active: true
    });
    setRecipeItems([]);
    setErrors({});
  }, []);

  // Cargar ingredientes de receta usando API
  const loadRecipeIngredients = useCallback(async () => {
    if (!recipe?.id) return;
    
    try {
      const response = await apiService.recipes.getById(recipe.id);
      
      if (response && response.ingredients_list && Array.isArray(response.ingredients_list)) {
        setRecipeItems(response.ingredients_list.map(item => ({
          id: null,
          ingredient: item.id.toString(),
          ingredient_name: item.name,
          ingredient_unit: item.unit,
          ingredient_unit_price: item.unit_price,
          ingredient_current_stock: 0,
          quantity: item.quantity.toString()
        })));
      } else {
        setRecipeItems([]);
      }
    } catch (error) {
      setRecipeItems([]);
    }
  }, [recipe?.id]);

  // Cargar datos de referencia (optimizado con cache)
  const loadReferenceData = useCallback(async () => {
    try {
      // Usar un solo endpoint optimizado que retorne todos los datos
      const [allIngredients, groups, containers] = await Promise.all([
        // Usar apiService para manejar autenticación correctamente
        apiService.ingredients.getAll({ show_all: true }),
        apiService.groups.getAll(),
        apiService.containers.getAll()
      ]);
      
      setAvailableIngredients(allIngredients);
      setAvailableGroups(Array.isArray(groups) ? groups : []);
      setAvailableContainers(Array.isArray(containers) ? containers : []);
    } catch (error) {
    }
  }, []);

  // Inicializar modal
  useEffect(() => {
    if (isOpen) {
      const initializeModal = async () => {
        // Cargar datos de referencia primero
        await loadReferenceData();
        
        if (recipe) {
        // Modo edición
        
        setFormData({
          name: recipe.name || '',
          version: recipe.version || '1.0',
          group: recipe.group ? (typeof recipe.group === 'object' ? recipe.group.id.toString() : recipe.group.toString()) : '',
          container: recipe.container ? recipe.container.toString() : '',
          preparation_time: recipe.preparation_time || '',
          profit_percentage: recipe.profit_percentage || '0.00',
          is_active: Boolean(recipe.is_active) // Asegurar que sea boolean
        });
        
        // Cargar ingredientes de la receta
        
        if (recipe.ingredients_list && Array.isArray(recipe.ingredients_list)) {
          
          const mappedItems = recipe.ingredients_list.map(item => ({
            id: null,
            ingredient: item.id.toString(),
            ingredient_name: item.name,
            ingredient_unit: item.unit,
            ingredient_unit_price: item.unit_price,
            ingredient_current_stock: 0,
            quantity: item.quantity.toString()
          }));
          
          setRecipeItems(mappedItems);
          
          // Verificar después de set
          
        } else {
          // Cargar ingredientes usando el API si no están en ingredients_list
          loadRecipeIngredients();
        }
        
        } else {
          // Modo creación
          resetForm();
        }
      };
      
      initializeModal();
    }
  }, [isOpen, recipe, loadReferenceData, resetForm, loadRecipeIngredients]);

  // Manejador de cambios optimizado
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    
    
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      
      if (name === 'is_active') {
      }
      
      return newData;
    });
    
    // Limpiar errores
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  // Agregar ingrediente
  const addRecipeItem = useCallback(() => {
    setRecipeItems(prev => [...prev, {
      id: null,
      ingredient: '',
      ingredient_name: '',
      ingredient_unit: '',
      ingredient_unit_price: '',
      quantity: ''
    }]);
  }, []);

  // Remover ingrediente
  const removeRecipeItem = useCallback((index) => {
    setRecipeItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Actualizar ingrediente
  const updateRecipeItem = useCallback((index, field, value) => {
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
  }, [availableIngredients]);

  // Validación del formulario
  const validateForm = useCallback(() => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    
    if (!formData.version.trim()) {
      newErrors.version = 'La versión es obligatoria';
    }
    
    if (!formData.container || formData.container === '') {
      newErrors.container = 'Debe seleccionar un envase';
    }
    
    if (!formData.preparation_time || parseInt(formData.preparation_time) <= 0) {
      newErrors.preparation_time = 'El tiempo de preparación debe ser mayor a 0';
    }
    
    const profitPercentage = parseFloat(formData.profit_percentage);
    if (isNaN(profitPercentage) || profitPercentage < 0) {
      newErrors.profit_percentage = 'El porcentaje de ganancia debe ser un número válido mayor o igual a 0';
    }
    
    // Validar ingredientes
    const validItems = recipeItems.filter(item => 
      item.ingredient && item.ingredient !== '' && 
      item.quantity && parseFloat(item.quantity) > 0
    );
    
    if (validItems.length === 0) {
      newErrors.ingredients = 'Debe agregar al menos un ingrediente válido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, recipeItems]);

  // Cálculos de precio memoizados
  const priceCalculations = useMemo(() => {
    const ingredientsCost = recipeItems.reduce((total, item) => {
      if (item.ingredient && item.quantity && item.ingredient_unit_price) {
        return total + (parseFloat(item.ingredient_unit_price) * parseFloat(item.quantity));
      }
      return total;
    }, 0);
    
    const profitPercentage = parseFloat(formData.profit_percentage) || 0;
    const profitAmount = ingredientsCost * (profitPercentage / 100);
    const finalPrice = ingredientsCost + profitAmount;
    
    return { ingredientsCost, profitPercentage, profitAmount, finalPrice };
  }, [recipeItems, formData.profit_percentage]);

  // Guardar receta
  const handleSave = useCallback(async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Preparar ingredientes válidos
      const validItems = recipeItems.filter(item => 
        item.ingredient && item.ingredient !== '' && 
        item.quantity && parseFloat(item.quantity) > 0
      );
      
      // Crear payload optimizado
      const recipeData = {
        name: formData.name.trim(),
        version: formData.version.trim() || '1.0',
        group: formData.group ? parseInt(formData.group) : null,
        container: formData.container ? parseInt(formData.container) : null,
        base_price: priceCalculations.finalPrice > 0 ? priceCalculations.finalPrice.toFixed(2) : "0.01",
        profit_percentage: parseFloat(formData.profit_percentage) || 0,
        preparation_time: parseInt(formData.preparation_time),
        is_available: true,
        is_active: Boolean(formData.is_active), // Asegurar que sea boolean
        recipe_items: validItems.map(item => ({
          ingredient: parseInt(item.ingredient),
          quantity: parseFloat(item.quantity)
        }))
      };
      
      
      let savedRecipe;
      if (recipe?.id) {
        savedRecipe = await apiService.recipes.update(recipe.id, recipeData);
      } else {
        savedRecipe = await apiService.recipes.create(recipeData);
      }
      
      
      onSave();
      onClose();
      showSuccess(recipe ? 'Receta actualizada exitosamente' : 'Receta creada exitosamente');
      
    } catch (error) {
      
      // Manejo mejorado de errores
      let errorMessage = 'Error al guardar la receta';
      
      if (error.response?.status === 400) {
        const errorData = error.response.data;
        
        if (typeof errorData === 'object') {
          // Errores de validación específicos
          const fieldErrors = [];
          Object.entries(errorData).forEach(([field, messages]) => {
            if (Array.isArray(messages)) {
              fieldErrors.push(`${field}: ${messages.join(', ')}`);
            } else {
              fieldErrors.push(`${field}: ${messages}`);
            }
          });
          
          if (fieldErrors.length > 0) {
            errorMessage = `Errores de validación: ${fieldErrors.join('; ')}`;
          }
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [formData, recipeItems, recipe, validateForm, priceCalculations, onSave, onClose, showSuccess, showError]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[95vh] md:h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-4">
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
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
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

                {/* Segunda fila: Envase y Versión */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Envase *
                    </label>
                    <select
                      name="container"
                      value={formData.container}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        errors.container ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Seleccionar envase...</option>
                      {availableContainers.map(container => (
                        <option key={container.id} value={container.id}>
                          {container.name}
                        </option>
                      ))}
                    </select>
                    {errors.container && (
                      <p className="mt-1 text-sm text-red-600">{errors.container}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Versión *
                    </label>
                    <input
                      type="text"
                      name="version"
                      value={formData.version}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        errors.version ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="1.0"
                    />
                    {errors.version && (
                      <p className="mt-1 text-sm text-red-600">{errors.version}</p>
                    )}
                  </div>
                </div>

                {/* Tercera fila: Tiempo y Ganancia */}
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
                      <p className="mt-1 text-sm text-red-600">{errors.preparation_time}</p>
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
                      <p className="mt-1 text-sm text-red-600">{errors.profit_percentage}</p>
                    )}
                  </div>
                </div>

                {/* Cuarta fila: Estado Activo - Simplificado */}
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Receta activa
                    </span>
                  </label>
                </div>

              </div>
            </div>

            {/* Ingredientes (versión simplificada) */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Ingredientes *</h3>
                <div className="flex gap-2">
                  <button
                    onClick={addRecipeItem}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    <Plus className="h-4 w-4 inline mr-1" />
                    Agregar
                  </button>
                </div>
              </div>

              {errors.ingredients && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                    <p className="text-sm text-red-600">{errors.ingredients}</p>
                  </div>
                </div>
              )}


              <div className="space-y-3">
                {recipeItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                    <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="font-medium">No hay ingredientes agregados</p>
                    <p className="text-sm">Agrega ingredientes para calcular el precio automáticamente</p>
                  </div>
                ) : (
                  <div>
                    {recipeItems.map((item, index) => {
                    const hasInsufficientStock = item.ingredient && item.quantity && 
                      availableIngredients.find(ing => ing.id === parseInt(item.ingredient))?.current_stock < parseFloat(item.quantity);
                    
                    return (
                      <div key={index} className={`bg-white rounded-lg border transition-all p-4 ${
                        hasInsufficientStock ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}>
                        {/* Una sola línea responsive */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                          {/* Ingrediente */}
                          <div className="lg:col-span-5">
                            <select
                              value={item.ingredient}
                              onChange={(e) => updateRecipeItem(index, 'ingredient', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            >
                              <option value="">Seleccionar ingrediente...</option>
                              {availableIngredients.map(ingredient => (
                                <option key={ingredient.id} value={ingredient.id.toString()}>
                                  {ingredient.name} - S/ {ingredient.unit_price}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Cantidad */}
                          <div className="lg:col-span-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateRecipeItem(index, 'quantity', e.target.value)}
                              placeholder="Cantidad"
                              step="0.01"
                              min="0.01"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                          
                          {/* Subtotal */}
                          <div className="lg:col-span-2">
                            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm font-semibold text-blue-900 h-[40px] flex items-center justify-center">
                              S/ {item.ingredient_unit_price && item.quantity ? 
                                (parseFloat(item.ingredient_unit_price) * parseFloat(item.quantity)).toFixed(2) : 
                                '0.00'
                              }
                            </div>
                          </div>
                          
                          {/* Stock */}
                          <div className="lg:col-span-2">
                            <div className={`px-3 py-2 border rounded-md text-sm h-[40px] flex items-center justify-center ${
                              hasInsufficientStock
                                ? 'bg-red-50 text-red-700 border-red-300' 
                                : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}>
                              {item.ingredient ? (
                                <div className="text-center">
                                  <span className={`font-bold ${
                                    hasInsufficientStock ? 'text-red-600' : 'text-gray-800'
                                  }`}>
                                    {availableIngredients.find(ing => ing.id === parseInt(item.ingredient))?.current_stock || 0}
                                  </span>
                                  {hasInsufficientStock && (
                                    <span className="text-xs font-semibold text-red-600 ml-1">
                                      ⚠️
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Botón eliminar */}
                          <div className="lg:col-span-1">
                            <button
                              onClick={() => removeRecipeItem(index)}
                              className="w-full lg:w-auto px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center justify-center"
                              title="Eliminar ingrediente"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Alerta de stock en mobile */}
                        {hasInsufficientStock && (
                          <div className="lg:hidden mt-2 text-xs text-red-600 font-semibold bg-red-100 px-2 py-1 rounded text-center">
                            ⚠️ Sin stock suficiente para este ingrediente
                          </div>
                        )}
                      </div>
                    );
                    })}
                  </div>
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
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-gray-700">Costo ingredientes</div>
                  <div className="font-bold text-lg">S/ {priceCalculations.ingredientsCost.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-700">Ganancia ({priceCalculations.profitPercentage}%)</div>
                  <div className="font-bold text-lg">S/ {priceCalculations.profitAmount.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-green-800 font-semibold">Precio final</div>
                  <div className="font-bold text-xl text-green-900">S/ {priceCalculations.finalPrice.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer con botones */}
        <div className="flex items-center justify-end gap-3 p-4 md:p-6 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {recipe ? 'Actualizar' : 'Crear'} Receta
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeModalOptimized;