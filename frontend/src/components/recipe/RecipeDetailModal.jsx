import { useState, useEffect } from 'react';
import { X, Clock, DollarSign, Package, Eye } from 'lucide-react';
import Button from '../common/Button';
import { apiService } from '../../services/api';

const RecipeDetailModal = ({ isOpen, onClose, recipe }) => {
  const [recipeItems, setRecipeItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && recipe?.id) {
      loadRecipeItems();
    }
  }, [isOpen, recipe]);

  const loadRecipeItems = async () => {
    setLoading(true);
    try {
      const data = await apiService.getAll(`recipe-items?recipe=${recipe.id}`);
      setRecipeItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading recipe items:', error);
      setRecipeItems([]);
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

  const calculateTotalCost = () => {
    return recipeItems.reduce((total, item) => {
      const itemCost = parseFloat(item.ingredient_unit_price || 0) * parseFloat(item.quantity || 0);
      return total + itemCost;
    }, 0);
  };

  const calculateProfitMargin = () => {
    const totalCost = calculateTotalCost();
    const basePrice = parseFloat(recipe?.base_price || 0);
    if (totalCost === 0 || basePrice === 0) return 0;
    return ((basePrice - totalCost) / basePrice) * 100;
  };

  if (!isOpen || !recipe) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{recipe.name}</h2>
            <div className="flex items-center gap-4 mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                recipe.is_available 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {recipe.is_available ? 'Disponible' : 'No disponible'}
              </span>
              <span className="text-sm text-gray-600">
                Creada el {new Date(recipe.created_at).toLocaleDateString('es-PE')}
              </span>
            </div>
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
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Precio Base</p>
                  <p className="text-xl font-bold text-green-900">
                    {formatCurrency(recipe.base_price)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Tiempo Prep.</p>
                  <p className="text-xl font-bold text-blue-900">
                    {recipe.preparation_time} min
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800">Ingredientes</p>
                  <p className="text-xl font-bold text-purple-900">
                    {recipeItems.length}
                  </p>
                </div>
                <Package className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Cost Analysis */}
          {recipeItems.length > 0 && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Análisis de Costos</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-yellow-700">Costo Total Ingredientes:</span>
                  <p className="font-bold text-yellow-900">{formatCurrency(calculateTotalCost())}</p>
                </div>
                <div>
                  <span className="text-yellow-700">Precio de Venta:</span>
                  <p className="font-bold text-yellow-900">{formatCurrency(recipe.base_price)}</p>
                </div>
                <div>
                  <span className="text-yellow-700">Margen de Ganancia:</span>
                  <p className={`font-bold ${calculateProfitMargin() > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {calculateProfitMargin().toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Ingredients List */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Lista de Ingredientes</h3>
              <Eye className="h-5 w-5 text-gray-500" />
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Cargando ingredientes...</p>
              </div>
            ) : recipeItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No hay ingredientes definidos para esta receta</p>
                <p className="text-sm">Edite la receta para agregar ingredientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recipeItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{item.ingredient_name}</h4>
                          <p className="text-sm text-gray-600">{item.ingredient_category_name}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {parseFloat(item.quantity).toFixed(2)} {item.ingredient_unit_name}
                      </div>
                      {item.ingredient_unit_price && (
                        <div className="text-sm text-gray-600">
                          {formatCurrency(parseFloat(item.ingredient_unit_price) * parseFloat(item.quantity))}
                          <span className="text-xs ml-1">
                            ({formatCurrency(item.ingredient_unit_price)}/{item.ingredient_unit_name})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Total */}
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200 font-semibold">
                  <span className="text-blue-800">Total Costo de Ingredientes:</span>
                  <span className="text-blue-900 text-lg">{formatCurrency(calculateTotalCost())}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200 bg-gray-50">
          <Button onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RecipeDetailModal;