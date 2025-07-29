import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Save, Trash2, ShoppingCart } from 'lucide-react';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const NewOrder = () => {
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const params = useParams();
  const orderId = params.id;
  
  const [formData, setFormData] = useState({
    table: '',
    waiter: '',
    status: 'CREATED'
  });
  
  const [orderItems, setOrderItems] = useState([]);
  const [availableRecipes, setAvailableRecipes] = useState([]);
  const [availableTables, setAvailableTables] = useState([]);
  const [availableZones, setAvailableZones] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [availableWaiters, setAvailableWaiters] = useState([]);
  const [availableContainers, setAvailableContainers] = useState([]);
  const [defaultContainer, setDefaultContainer] = useState(null);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [existingOrder, setExistingOrder] = useState(null);

  useEffect(() => {
    loadAvailableData();
    if (orderId) {
      loadExistingOrder();
    } else {
      addOrderItem();
    }
  }, [orderId]);

  const loadExistingOrder = async () => {
    try {
      const orderDetails = await apiService.orders.getById(orderId);
      setExistingOrder(orderDetails);
      
      setFormData({
        table: orderDetails.table?.id || orderDetails.table || '',
        waiter: orderDetails.waiter?.id || orderDetails.waiter || '',
        status: orderDetails.status || 'CREATED'
      });
      
      const items = orderDetails.items || [];
      setOrderItems(items.map(item => ({
        id: item.id,
        recipe: typeof item.recipe === 'object' ? item.recipe.id : item.recipe,
        recipe_name: item.recipe_name,
        unit_price: item.unit_price,
        total_price: item.total_price,
        status: item.status,
        notes: item.notes || '',
        quantity: item.quantity || 1,
        is_takeaway: item.is_takeaway || false,
        has_taper: item.has_taper || false,
        selected_container: item.selected_container || null,
        can_delete: item.status === 'CREATED',
        can_edit: orderDetails.status === 'CREATED' ? true : false,
        tempKey: item.tempKey || (Date.now() + Math.random())
      })));
    } catch (error) {
      console.error('Error loading existing order:', error);
      showError('Error al cargar el pedido');
      navigate('/orders');
    }
  };

  const loadAvailableData = async () => {
    try {
      const [recipesData, tablesData, zonesData, groupsData, waitersData, containersData] = await Promise.all([
        apiService.recipes.getAll(),
        apiService.tables.getAll(),
        apiService.zones.getAll(),
        apiService.groups.getAll(),
        apiService.waiters.getAll(),
        apiService.containers.getAll({ is_active: true })
      ]);
      
      setAvailableRecipes(Array.isArray(recipesData) ? recipesData : []);
      setAvailableTables(Array.isArray(tablesData) ? tablesData : []);
      setAvailableZones(Array.isArray(zonesData) ? zonesData : []);
      setAvailableGroups(Array.isArray(groupsData) ? groupsData : []);
      setAvailableWaiters(Array.isArray(waitersData) ? waitersData.filter(w => w.is_active) : []);
      
      const containers = Array.isArray(containersData) ? containersData : [];
      setAvailableContainers(containers);
      
      const defaultCont = containers.find(c => c.name.toLowerCase().includes('taper')) || 
                         containers.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
      setDefaultContainer(defaultCont);
    } catch (error) {
      console.error('Error loading available data:', error);
    }
  };

  const getFilteredRecipes = (itemHasSelection = false) => {
    if (itemHasSelection) {
      return availableRecipes.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    let filtered;
    if (!selectedGroupFilter) {
      filtered = availableRecipes;
    } else {
      filtered = availableRecipes.filter(recipe => recipe.group === parseInt(selectedGroupFilter));
    }
    
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  };

  const getFilteredTables = () => {
    if (!selectedZoneFilter) {
      return availableTables.sort((a, b) => a.table_number.localeCompare(b.table_number));
    }
    return availableTables
      .filter(table => table.zone === parseInt(selectedZoneFilter))
      .sort((a, b) => a.table_number.localeCompare(b.table_number));
  };

  const addOrderItem = () => {
    setOrderItems(prev => {
      const updatedPrev = prev.map(item => ({
        ...item,
        can_edit: existingOrder?.status === 'SERVED' ? false : item.can_edit
      }));
      
      const newItem = {
        id: null,
        recipe: '',
        recipe_name: '',
        unit_price: '',
        total_price: '',
        status: 'CREATED',
        notes: '',
        quantity: 1,
        is_takeaway: false,
        has_taper: false,
        selected_container: null,
        can_delete: true,
        can_edit: true,
        tempKey: Date.now() + Math.random()
      };
      
      return [newItem, ...updatedPrev];
    });
  };

  const removeOrderItem = (index) => {
    const item = orderItems[index];
    if (!item.can_delete) {
      showError('No se puede eliminar este item porque ya fue entregado');
      return;
    }
    
    if (item.id) {
      setDeletedItemIds(prev => [...prev, item.id]);
    }
    
    setOrderItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateOrderItem = (index, field, value) => {
    setOrderItems(prev => {
      return prev.map((item, i) => {
        if (i === index) {
          if (field === 'recipe') {
            const selectedRecipe = availableRecipes.find(recipe => recipe.id === parseInt(value));
            return {
              ...item,
              recipe: value,
              recipe_name: selectedRecipe?.name || '',
              unit_price: selectedRecipe?.base_price || 0,
              total_price: selectedRecipe?.base_price || 0
            };
          }
          
          if (field === 'is_takeaway') {
            const newItem = { ...item, [field]: value };
            
            if (value === true) {
              newItem.has_taper = true;
              newItem.selected_container = defaultContainer?.id || null;
            } else {
              newItem.has_taper = false;
              newItem.selected_container = null;
            }
            
            return newItem;
          }

          if (field === 'has_taper') {
            const newItem = { ...item, [field]: value };
            
            if (value === true) {
              newItem.selected_container = defaultContainer?.id || null;
            } else {
              newItem.selected_container = null;
            }
            
            return newItem;
          }
          
          return { ...item, [field]: value };
        }
        return item;
      });
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.table || formData.table === '') {
      newErrors.table = 'La mesa es requerida';
    }
    
    if (!formData.waiter || formData.waiter === '') {
      newErrors.waiter = 'El mesero es requerido';
    }
    
    const validItems = orderItems.filter(item => {
      if (!item.recipe) return false;
      const parsedId = parseInt(item.recipe);
      return !isNaN(parsedId) && parsedId > 0;
    });
    
    if (validItems.length === 0) {
      newErrors.items = 'Debe agregar al menos un item válido con receta seleccionada';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    try {
      const validItems = orderItems.filter(item => {
        if (!item.recipe) return false;
        const parsedId = parseInt(item.recipe);
        return !isNaN(parsedId) && parsedId > 0;
      });
      
      if (orderId) {
        const orderData = {
          table: parseInt(formData.table),
          waiter: parseInt(formData.waiter),
          status: formData.status
        };
        
        await apiService.orders.update(orderId, orderData);
        
        if (deletedItemIds.length > 0) {
          for (const itemId of deletedItemIds) {
            await apiService.orderItems.delete(itemId);
          }
        }
        
        const newItems = orderItems.filter(item => !item.id && item.recipe);
        
        if (newItems.length > 0) {
          if (existingOrder?.status === 'SERVED') {
            await apiService.orders.updateStatus(orderId, 'CREATED');
          }
          
          for (const item of newItems) {
            const createData = {
              order: parseInt(orderId),
              recipe: parseInt(item.recipe),
              notes: item.notes || '',
              quantity: item.quantity || 1,
              is_takeaway: item.is_takeaway || false,
              has_taper: item.has_taper || false,
              selected_container: item.selected_container || null
            };
            await apiService.orderItems.create(createData);
          }
        }
        
        showSuccess('Pedido actualizado exitosamente');
      } else {
        const processedItems = validItems.map(item => ({
          recipe: parseInt(item.recipe),
          notes: (item.notes || '').toString().trim(),
          quantity: parseInt(item.quantity) || 1,
          is_takeaway: item.is_takeaway || false,
          has_taper: item.has_taper || false,
          selected_container: item.selected_container || null
        }));
        
        const orderData = {
          table: parseInt(formData.table),
          waiter: parseInt(formData.waiter),
          items: processedItems
        };
        
        await apiService.orders.create(orderData);
        showSuccess('Pedido creado exitosamente');
      }
      
      navigate('/orders');
    } catch (error) {
      console.error('Error saving order:', error);
      showError('Error al guardar el pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (confirm('¿Estás seguro de cancelar? Se perderán todos los cambios no guardados.')) {
      navigate('/orders');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount || 0);
  };

  const filterNumericInput = (value) => {
    let result = '';
    for (let char of value) {
      if (char >= '0' && char <= '9') {
        result += char;
      }
    }
    return result;
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex items-center justify-end gap-2 p-4 border-b border-gray-200">
        <Button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Guardar
            </>
          )}
        </Button>
        <Button
          variant="secondary"
          onClick={handleCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>

      <div className="p-4">
        <div className="space-y-3">
          <div>
            <select
              name="waiter"
              value={formData.waiter}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm ${
                errors.waiter ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={existingOrder?.status === 'SERVED'}
            >
              <option value="">Seleccionar mesero</option>
              {availableWaiters.map(waiter => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.name}
                </option>
              ))}
            </select>
            {errors.waiter && (
              <p className="mt-1 text-sm text-red-600">{errors.waiter}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <select
                value={selectedZoneFilter}
                onChange={(e) => {
                  setSelectedZoneFilter(e.target.value);
                  if (formData.table) {
                    setFormData(prev => ({ ...prev, table: '' }));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                disabled={!!orderId || existingOrder?.status === 'SERVED'}
              >
                <option value="">Zona</option>
                {availableZones.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                name="table"
                value={formData.table}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm ${
                  errors.table ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={!!orderId || existingOrder?.status === 'SERVED'}
              >
                <option value="">Mesa</option>
                {getFilteredTables().map(table => (
                  <option key={table.id} value={table.id}>
                    Mesa {table.table_number}
                  </option>
                ))}
              </select>
              {errors.table && (
                <p className="mt-1 text-sm text-red-600">{errors.table}</p>
              )}
            </div>

            {existingOrder && (
              <div>
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 font-medium text-sm">
                  {formData.status === 'CREATED' && 'Creado'}
                  {formData.status === 'SERVED' && 'Entregado'}
                  {formData.status === 'PAID' && 'Pagado'}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            >
              <option value="">Grupos</option>
              {availableGroups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            
            <button
              onClick={addOrderItem}
              className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              title="Agregar nuevo item"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {errors.items && (
            <p className="text-sm text-red-600">{errors.items}</p>
          )}

          <div className="space-y-2">
            {orderItems.length === 0 ? (
              <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-300 rounded">
                <ShoppingCart className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                <p className="font-medium text-sm">No hay items agregados</p>
              </div>
            ) : (
              <>
                <div className="hidden lg:grid grid-cols-11 gap-2 px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700">
                  <div className="col-span-3">Item</div>
                  <div className="col-span-1 text-center">Cant.</div>
                  <div className="col-span-1 text-center">Precio</div>
                  <div className="col-span-2 text-center">Para llevar/Taper</div>
                  <div className="col-span-3">Notas</div>
                  <div className="col-span-1 text-center">Acción</div>
                </div>
                
                {orderItems.map((item, index) => {
                  const displayNumber = orderItems.length - index;
                  const getStatusText = (status) => {
                    return status === 'CREATED' ? 'Creado' : status === 'SERVED' ? 'Entregado' : status;
                  };
                  
                  return (
                    <div key={item.tempKey || item.id || index} className={`border border-gray-200 rounded p-2 ${ 
                      !item.can_edit ? 'bg-gray-100' : 'bg-white'
                    }`}>
                      <div className="lg:hidden space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm text-gray-900">
                            Item #{displayNumber} - {getStatusText(item.status)}
                          </span>
                          {item.can_delete && (
                            <button
                              onClick={() => removeOrderItem(index)}
                              className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Receta</label>
                          <select
                            value={item.recipe}
                            onChange={(e) => updateOrderItem(index, 'recipe', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            disabled={!item.can_edit}
                          >
                            <option value="">Seleccionar...</option>
                            {getFilteredRecipes(!!item.recipe && item.recipe !== '').map(recipe => (
                              <option key={recipe.id} value={recipe.id}>
                                {recipe.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={item.quantity}
                              onChange={(e) => {
                                const value = filterNumericInput(e.target.value);
                                const numValue = parseInt(value) || 1;
                                updateOrderItem(index, 'quantity', numValue);
                              }}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                              disabled={!item.can_edit}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Precio Unit.</label>
                            <div className="text-sm font-semibold text-gray-900">{formatCurrency(item.unit_price)}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={item.is_takeaway}
                              onChange={(e) => updateOrderItem(index, 'is_takeaway', e.target.checked)}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              disabled={!item.can_edit}
                            />
                            <span className="ml-2 text-xs text-gray-700">Para llevar</span>
                          </label>
                          
                          {item.is_takeaway && (
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={item.has_taper}
                                onChange={(e) => updateOrderItem(index, 'has_taper', e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                disabled={!item.can_edit || !defaultContainer}
                              />
                              <span className="ml-2 text-xs text-gray-700">
                                Con envase {defaultContainer ? `(+S/ ${defaultContainer.price})` : '(Sin stock)'}
                              </span>
                            </label>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => updateOrderItem(index, 'notes', e.target.value)}
                            placeholder="Ej: Sin cebolla"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={!item.can_edit}
                          />
                        </div>
                      </div>
                      
                      <div className="hidden lg:grid grid-cols-11 gap-2 items-center">
                        <div className="col-span-3">
                          <div className="text-xs font-medium text-gray-900 mb-1">
                            Item #{displayNumber} - {getStatusText(item.status)}
                          </div>
                          <select
                            value={item.recipe}
                            onChange={(e) => updateOrderItem(index, 'recipe', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                            disabled={!item.can_edit}
                          >
                            <option value="">Seleccionar...</option>
                            {getFilteredRecipes(!!item.recipe && item.recipe !== '').map(recipe => (
                              <option key={recipe.id} value={recipe.id}>
                                {recipe.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="col-span-1 text-center">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item.quantity}
                            onChange={(e) => {
                              const value = filterNumericInput(e.target.value);
                              const numValue = parseInt(value) || 1;
                              updateOrderItem(index, 'quantity', numValue);
                            }}
                            className="w-full px-1 py-1 border border-gray-300 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={!item.can_edit}
                          />
                        </div>
                        
                        <div className="col-span-1 text-center text-xs font-semibold text-gray-900">
                          {formatCurrency(item.unit_price)}
                        </div>
                        
                        <div className="col-span-2 text-center">
                          <div className="flex justify-center items-center space-x-2">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={item.is_takeaway}
                                onChange={(e) => updateOrderItem(index, 'is_takeaway', e.target.checked)}
                                className="h-3 w-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                disabled={!item.can_edit}
                              />
                              <span className="ml-1 text-xs text-gray-700">P.llevar</span>
                            </label>
                            
                            {item.is_takeaway && (
                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={item.has_taper}
                                  onChange={(e) => updateOrderItem(index, 'has_taper', e.target.checked)}
                                  className="h-3 w-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  disabled={!item.can_edit || !defaultContainer}
                                />
                                <span className="ml-1 text-xs text-gray-700">
                                  Envase {defaultContainer ? `(+S/ ${defaultContainer.price})` : '(Sin stock)'}
                                </span>
                              </label>
                            )}
                          </div>
                        </div>

                        <div className="col-span-3">
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => updateOrderItem(index, 'notes', e.target.value)}
                            placeholder="Ej: Sin cebolla"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={!item.can_edit}
                          />
                        </div>
                        
                        <div className="col-span-1 text-center">
                          {item.can_delete && (
                            <button
                              onClick={() => removeOrderItem(index)}
                              className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewOrder;
