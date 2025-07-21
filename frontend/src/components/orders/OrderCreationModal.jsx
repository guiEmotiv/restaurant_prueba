import { useState, useEffect } from 'react';
import { X, Plus, Minus, AlertTriangle, Check } from 'lucide-react';
import Button from '../common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const OrderCreationModal = ({ isOpen, onClose, onSuccess }) => {
  const { showSuccess, showError } = useToast();
  const [step, setStep] = useState(1); // 1: Select Table, 2: Add Items
  const [selectedTable, setSelectedTable] = useState(null);
  const [availableTables, setAvailableTables] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAvailableTables();
      loadRecipes();
    }
  }, [isOpen]);

  const loadAvailableTables = async () => {
    try {
      setTablesLoading(true);
      const tables = await apiService.tables.getAll();
      const availableTables = [];
      
      // Check for tables that don't have current orders
      for (const table of tables) {
        try {
          await apiService.tables.getCurrentOrder(table.id);
          // If no error, table has current order
        } catch (error) {
          // If error (404), table is available
          if (error.response?.status === 404) {
            availableTables.push(table);
          }
        }
      }
      
      setAvailableTables(availableTables);
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      setTablesLoading(false);
    }
  };

  const loadRecipes = async () => {
    try {
      const recipesData = await apiService.recipes.getAll();
      const availableRecipes = [];
      
      // Check recipe availability
      for (const recipe of recipesData) {
        try {
          const availability = await apiService.recipes.checkAvailability(recipe.id);
          if (availability.available) {
            availableRecipes.push({ ...recipe, available: true });
          } else {
            availableRecipes.push({ 
              ...recipe, 
              available: false, 
              missing_ingredients: availability.missing_ingredients || []
            });
          }
        } catch (error) {
          // If error checking availability, assume not available
          availableRecipes.push({ ...recipe, available: false });
        }
      }
      
      setRecipes(availableRecipes);
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  };

  const handleTableSelect = (table) => {
    setSelectedTable(table);
    setStep(2);
  };

  const addItem = (recipe) => {
    const existingItem = selectedItems.find(item => item.recipe.id === recipe.id);
    if (existingItem) {
      setSelectedItems(selectedItems.map(item => 
        item.recipe.id === recipe.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setSelectedItems([...selectedItems, { recipe, quantity: 1, notes: '' }]);
    }
  };

  const removeItem = (recipeId) => {
    const existingItem = selectedItems.find(item => item.recipe.id === recipeId);
    if (existingItem && existingItem.quantity > 1) {
      setSelectedItems(selectedItems.map(item => 
        item.recipe.id === recipeId 
          ? { ...item, quantity: item.quantity - 1 }
          : item
      ));
    } else {
      setSelectedItems(selectedItems.filter(item => item.recipe.id !== recipeId));
    }
  };

  const updateItemNotes = (recipeId, notes) => {
    setSelectedItems(selectedItems.map(item => 
      item.recipe.id === recipeId 
        ? { ...item, notes }
        : item
    ));
  };

  const calculateTotal = () => {
    return selectedItems.reduce((total, item) => 
      total + (parseFloat(item.recipe.base_price || 0) * item.quantity), 0
    );
  };

  const handleCreateOrder = async () => {
    try {
      setLoading(true);
      
      // Create order first
      // Handle quantities by creating multiple items for the same recipe
      const itemsArray = [];
      selectedItems.forEach(item => {
        const quantity = item.quantity || 1;
        for (let i = 0; i < quantity; i++) {
          itemsArray.push({
            recipe: item.recipe.id,
            notes: item.notes || ''
          });
        }
      });
      
      const orderData = {
        table: selectedTable.id,
        items: itemsArray
      };

      await apiService.orders.create(orderData);
      
      showSuccess('Orden creada exitosamente');
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error creating order:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message;
      showError('Error al crear la orden: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedTable(null);
    setSelectedItems([]);
    onClose();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {step === 1 ? 'Seleccionar Mesa' : `Nueva Orden - Mesa ${selectedTable?.table_number}`}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {step === 1 ? (
            // Step 1: Table Selection
            <div className="p-6">
              {tablesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Cargando mesas disponibles...</p>
                </div>
              ) : availableTables.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-orange-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay mesas disponibles</h3>
                  <p className="text-gray-600">Todas las mesas tienen órdenes activas.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {availableTables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => handleTableSelect(table)}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="text-center">
                        <p className="font-medium text-gray-900">Mesa {table.table_number}</p>
                        <p className="text-sm text-gray-600">{table.zone_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Step 2: Add Items
            <div className="flex">
              {/* Recipe Selection */}
              <div className="w-2/3 p-6 border-r border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Seleccionar Platos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recipes.map((recipe) => (
                    <div
                      key={recipe.id}
                      className={`border rounded-lg p-4 ${
                        recipe.available 
                          ? 'border-gray-200 hover:border-blue-300' 
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{recipe.name}</h4>
                        {recipe.available ? (
                          <Check className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        {formatCurrency(recipe.base_price)} • {recipe.preparation_time}min
                      </p>
                      
                      {!recipe.available && recipe.missing_ingredients && (
                        <p className="text-xs text-red-600 mb-2">
                          Faltan ingredientes: {recipe.missing_ingredients.join(', ')}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          recipe.available 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {recipe.available ? 'Disponible' : 'No disponible'}
                        </span>
                        
                        {recipe.available && (
                          <button
                            onClick={() => addItem(recipe)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                          >
                            Agregar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="w-1/3 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen de la Orden</h3>
                
                {selectedItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No hay items seleccionados
                  </p>
                ) : (
                  <div className="space-y-4">
                    {selectedItems.map((item) => (
                      <div key={item.recipe.id} className="border border-gray-200 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">{item.recipe.name}</h4>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => removeItem(item.recipe.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="text-sm font-medium">{item.quantity}</span>
                            <button
                              onClick={() => addItem(item.recipe)}
                              className="text-green-600 hover:text-green-800"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-xs text-gray-600 mb-2">
                          {formatCurrency(item.recipe.base_price)} × {item.quantity} = {formatCurrency(item.recipe.base_price * item.quantity)}
                        </p>
                        
                        <textarea
                          placeholder="Notas especiales..."
                          value={item.notes}
                          onChange={(e) => updateItemNotes(item.recipe.id, e.target.value)}
                          className="w-full text-xs border border-gray-200 rounded p-2 resize-none"
                          rows={2}
                        />
                      </div>
                    ))}
                    
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center justify-between text-lg font-semibold">
                        <span>Total:</span>
                        <span>{formatCurrency(calculateTotal())}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="flex gap-3">
            {step === 2 && (
              <Button
                onClick={() => setStep(1)}
                variant="secondary"
              >
                Volver
              </Button>
            )}
            <Button
              onClick={handleClose}
              variant="secondary"
            >
              Cancelar
            </Button>
          </div>
          
          {step === 2 && (
            <Button
              onClick={handleCreateOrder}
              disabled={selectedItems.length === 0 || loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creando...
                </>
              ) : (
                'Crear Orden'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderCreationModal;