import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { apiService } from '../../services/api';
import Button from '../common/Button';
import { useToast } from '../../contexts/ToastContext';

const OrderModal = ({ isOpen, onClose, onSubmit, initialData = null }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    table: '',
    status: 'CREATED'
  });
  const [tables, setTables] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (initialData) {
        setFormData({
          table: initialData.table || '',
          status: initialData.status || 'CREATED'
        });
        loadOrderItems();
      } else {
        setOrderItems([]);
      }
    }
  }, [isOpen, initialData]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tablesData, recipesData] = await Promise.all([
        apiService.tables.getAll(),
        apiService.recipes.getAll()
      ]);
      
      setTables(Array.isArray(tablesData) ? tablesData : tablesData.results || []);
      setRecipes(Array.isArray(recipesData) ? recipesData : recipesData.results || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrderItems = async () => {
    if (initialData?.id) {
      try {
        const data = await apiService.orderItems.getAll();
        const allItems = Array.isArray(data) ? data : data.results || [];
        const filteredItems = allItems.filter(item => item.order === initialData.id);
        setOrderItems(filteredItems.map(item => ({
          recipe: item.recipe,
          notes: item.notes || '',
          unit_price: item.unit_price || '',
          total_price: item.total_price || ''
        })));
      } catch (error) {
        console.error('Error loading order items:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const orderData = {
        ...formData,
        table: parseInt(formData.table)
      };

      if (initialData) {
        // Update existing order
        await onSubmit(orderData);
        
        // Update order items
        if (initialData.id) {
          // First delete existing items
          const existingItems = await apiService.orderItems.getAll();
          const currentItems = (Array.isArray(existingItems) ? existingItems : existingItems.results || [])
            .filter(item => item.order === initialData.id);
          
          for (const item of currentItems) {
            await apiService.orderItems.delete(item.id);
          }
          
          // Then create new items
          for (const item of orderItems) {
            if (item.recipe) {
              const recipe = recipes.find(r => r.id === parseInt(item.recipe));
              await apiService.orderItems.create({
                order: initialData.id,
                recipe: parseInt(item.recipe),
                unit_price: item.unit_price || recipe?.base_price || 0,
                total_price: item.total_price || recipe?.base_price || 0,
                notes: item.notes || ''
              });
            }
          }
        }
        showSuccess('Orden actualizada exitosamente');
      } else {
        // Create new order
        const newOrder = await apiService.orders.create(orderData);
        
        // Create order items
        for (const item of orderItems) {
          if (item.recipe) {
            const recipe = recipes.find(r => r.id === parseInt(item.recipe));
            await apiService.orderItems.create({
              order: newOrder.id,
              recipe: parseInt(item.recipe),
              unit_price: item.unit_price || recipe?.base_price || 0,
              total_price: item.total_price || recipe?.base_price || 0,
              notes: item.notes || ''
            });
          }
        }
        onSubmit(orderData);
        showSuccess('Orden creada exitosamente');
      }
    } catch (error) {
      console.error('Error saving order:', error);
      showError('Error al guardar la orden');
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addOrderItem = () => {
    setOrderItems(prev => [...prev, { recipe: '', notes: '', unit_price: '', total_price: '' }]);
  };

  const removeOrderItem = (index) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateOrderItem = (index, field, value) => {
    setOrderItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        
        // Auto-calculate prices when recipe changes
        if (field === 'recipe' && value) {
          const recipe = recipes.find(r => r.id === parseInt(value));
          if (recipe) {
            updatedItem.unit_price = recipe.base_price;
            updatedItem.total_price = recipe.base_price;
          }
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {initialData ? 'Editar Orden' : 'Nueva Orden'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Order Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mesa
              </label>
              <select
                value={formData.table}
                onChange={(e) => handleChange('table', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading}
              >
                <option value="">Seleccionar mesa...</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    Mesa {table.table_number} - {table.zone_name}
                  </option>
                ))}
              </select>
            </div>

            {initialData && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="CREATED">Creado</option>
                  <option value="SERVED">Servido</option>
                  <option value="PAID">Pagado</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>
            )}
          </div>

          {/* Order Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-medium text-gray-900">Items de la Orden</h4>
              <Button type="button" onClick={addOrderItem} size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Agregar Item
              </Button>
            </div>

            <div className="space-y-3">
              {orderItems.map((item, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <select
                        value={item.recipe}
                        onChange={(e) => updateOrderItem(index, 'recipe', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Seleccionar receta...</option>
                        {recipes.filter(recipe => recipe.is_available).map((recipe) => (
                          <option key={recipe.id} value={recipe.id}>
                            {recipe.name} - S/ {parseFloat(recipe.base_price).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOrderItem(index)}
                      className="text-red-600 hover:text-red-800 p-1 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Precio Unitario
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={item.unit_price}
                        onChange={(e) => updateOrderItem(index, 'unit_price', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Precio Total
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={item.total_price}
                        onChange={(e) => updateOrderItem(index, 'total_price', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Notas
                    </label>
                    <textarea
                      value={item.notes}
                      onChange={(e) => updateOrderItem(index, 'notes', e.target.value)}
                      placeholder="Notas especiales..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
              
              {orderItems.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  No hay items agregados a la orden
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {initialData ? 'Actualizar' : 'Crear'} Orden
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderModal;