import { useState, useEffect } from 'react';
import { X, Clock, DollarSign, Package, CheckCircle, XCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import Button from '../common/Button';

const RecipeDetailModal = ({ isOpen, onClose, recipe }) => {
  const [recipeItems, setRecipeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    if (isOpen && recipe) {
      loadRecipeDetails();
    }
  }, [isOpen, recipe]);

  const loadRecipeDetails = async () => {
    try {
      setLoading(true);
      // Use the new getByRecipe method to get recipe items directly
      const recipeItems = await apiService.recipeItems.getByRecipe(recipe.id);
      
      // The API already returns enriched data with ingredient details
      setRecipeItems(recipeItems);

      // Calculate total cost using the total_cost field from API
      const cost = recipeItems.reduce((sum, item) => {
        return sum + parseFloat(item.total_cost || 0);
      }, 0);
      setTotalCost(cost);

    } catch (error) {
      console.error('Error loading recipe details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const checkAvailability = () => {
    return recipeItems.every(item => {
      // Since we don't have stock data in recipe-items endpoint, 
      // we'll rely on the recipe's is_available field
      return true;
    });
  };

  const isAvailable = recipe.is_available;

  if (!isOpen || !recipe) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Detalles de la Receta
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Recipe Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">{recipe.name}</h2>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                recipe.is_available 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {recipe.is_available ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Disponible
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-1" />
                    No disponible
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                <DollarSign className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm text-blue-600">Precio Base</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {formatCurrency(recipe.base_price)}
                  </p>
                </div>
              </div>

              <div className="flex items-center p-3 bg-green-50 rounded-lg">
                <Clock className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm text-green-600">Tiempo de Preparación</p>
                  <p className="text-lg font-semibold text-green-900">
                    {recipe.preparation_time} min
                  </p>
                </div>
              </div>

              <div className="flex items-center p-3 bg-purple-50 rounded-lg">
                <Package className="h-8 w-8 text-purple-600 mr-3" />
                <div>
                  <p className="text-sm text-purple-600">Costo de Ingredientes</p>
                  <p className="text-lg font-semibold text-purple-900">
                    {formatCurrency(totalCost)}
                  </p>
                </div>
              </div>
            </div>

            {/* Availability Status */}
            <div className={`mt-4 p-3 rounded-lg ${
              isAvailable ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center">
                {isAvailable ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mr-2" />
                )}
                <span className={`font-medium ${
                  isAvailable ? 'text-green-800' : 'text-red-800'
                }`}>
                  {isAvailable 
                    ? 'Todos los ingredientes están disponibles'
                    : 'Algunos ingredientes no tienen stock suficiente'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Ingredients List */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Ingredientes</h4>
            
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {recipeItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No hay ingredientes definidos para esta receta
                  </p>
                ) : (
                  recipeItems.map((item, index) => {
                    return (
                      <div key={index} className="p-4 rounded-lg border border-gray-200 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium text-gray-900">
                              {item.ingredient_name || 'Ingrediente no encontrado'}
                            </h5>
                            <p className="text-sm text-gray-600">
                              Categoría: {item.ingredient_category_name || 'N/A'}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-sm text-gray-600">Necesario</p>
                                <p className="font-medium">
                                  {parseFloat(item.quantity).toFixed(2)} {item.ingredient_unit_name}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Precio Unitario</p>
                                <p className="font-medium text-blue-600">
                                  {formatCurrency(item.ingredient_unit_price)}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Costo Total</p>
                                <p className="font-medium">
                                  {formatCurrency(item.total_cost)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          {recipeItems.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium text-gray-900">Total de Ingredientes:</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(totalCost)}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-600">Precio de Venta:</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(recipe.base_price)}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm text-gray-600">Margen de Ganancia:</span>
                <span className={`text-sm font-medium ${
                  (parseFloat(recipe.base_price) - totalCost) > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(parseFloat(recipe.base_price) - totalCost)}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-6 border-t border-gray-200 mt-6">
            <Button onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeDetailModal;