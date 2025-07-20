import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { apiService } from '../../services/api';
import Button from '../common/Button';
import { useToast } from '../../contexts/ToastContext';

const RecipeModal = ({ isOpen, onClose, onSubmit, initialData = null }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    base_price: '',
    preparation_time: '',
    is_available: true
  });
  const [ingredients, setIngredients] = useState([]);
  const [recipeItems, setRecipeItems] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadIngredients();
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          base_price: initialData.base_price || '',
          preparation_time: initialData.preparation_time || '',
          is_available: initialData.is_available !== undefined ? initialData.is_available : true
        });
        loadRecipeItems();
      } else {
        setRecipeItems([]);
      }
    }
  }, [isOpen, initialData]);

  const loadIngredients = async () => {
    try {
      const data = await apiService.ingredients.getAll();
      setIngredients(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error('Error loading ingredients:', error);
    }
  };

  const loadRecipeItems = async () => {
    if (initialData?.id) {
      try {
        const data = await apiService.recipeItems.getByRecipe(initialData.id);
        setRecipeItems(data);
      } catch (error) {
        console.error('Error loading recipe items:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const recipeData = {
        ...formData,
        base_price: parseFloat(formData.base_price),
        preparation_time: parseInt(formData.preparation_time)
      };

      if (initialData) {
        // Update existing recipe
        await onSubmit(recipeData);
        
        // Update recipe items
        if (initialData.id) {
          // First delete existing items
          const currentItems = await apiService.recipeItems.getByRecipe(initialData.id);
          
          for (const item of currentItems) {
            await apiService.recipeItems.delete(item.id);
          }
          
          // Then create new items
          for (const item of recipeItems) {
            if (item.ingredient && item.quantity) {
              await apiService.recipeItems.create({
                recipe: initialData.id,
                ingredient: item.ingredient,
                quantity: parseFloat(item.quantity)
              });
            }
          }
        }
      } else {
        // Create new recipe
        const newRecipe = await apiService.recipes.create(recipeData);
        
        // Create recipe items
        for (const item of recipeItems) {
          if (item.ingredient && item.quantity) {
            await apiService.recipeItems.create({
              recipe: newRecipe.id,
              ingredient: item.ingredient,
              quantity: parseFloat(item.quantity)
            });
          }
        }
        onSubmit(recipeData);
      }
    } catch (error) {
      console.error('Error saving recipe:', error);
      showError('Error al guardar la receta');
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addIngredient = () => {
    setRecipeItems(prev => [...prev, { ingredient: '', quantity: '' }]);
  };

  const removeIngredient = (index) => {
    setRecipeItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateIngredientItem = (index, field, value) => {
    setRecipeItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {initialData ? 'Editar Receta' : 'Agregar Receta'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Recipe Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de la Receta
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precio Base (S/)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.base_price}
                  onChange={(e) => handleChange('base_price', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tiempo de Preparación (min)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.preparation_time}
                  onChange={(e) => handleChange('preparation_time', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_available"
                checked={formData.is_available}
                onChange={(e) => handleChange('is_available', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_available" className="ml-2 block text-sm text-gray-900">
                Disponible en el menú
              </label>
            </div>
          </div>

          {/* Recipe Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-medium text-gray-900">Ingredientes</h4>
              <Button type="button" onClick={addIngredient} size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Agregar Ingrediente
              </Button>
            </div>

            <div className="space-y-3">
              {recipeItems.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <select
                      value={item.ingredient}
                      onChange={(e) => updateIngredientItem(index, 'ingredient', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Seleccionar ingrediente...</option>
                      {ingredients.map((ingredient) => (
                        <option key={ingredient.id} value={ingredient.id}>
                          {ingredient.name} ({ingredient.unit_name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Cantidad"
                      value={item.quantity}
                      onChange={(e) => updateIngredientItem(index, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="text-red-600 hover:text-red-800 p-1 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              
              {recipeItems.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  No hay ingredientes agregados
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {initialData ? 'Actualizar' : 'Crear'} Receta
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecipeModal;