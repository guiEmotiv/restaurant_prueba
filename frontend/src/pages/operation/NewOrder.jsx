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
        displayQuantity: (item.quantity || 1).toString(),
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
        displayQuantity: '1',
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
    
    const itemName = item.recipe_name || 'este item';
    const confirmMessage = `¿Estás seguro que deseas eliminar el item ${itemName}?`;
    
    if (!confirm(confirmMessage)) {
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

  const handleQuantityChange = (e, index) => {
    const rawValue = e.target.value;
    
    // Si está vacío, permitir temporalmente pero mantener 1 como valor efectivo
    if (rawValue === '') {
      // Actualizar la vista pero mantener quantity como 1 internamente
      setOrderItems(prev => prev.map((item, i) => 
        i === index ? { ...item, displayQuantity: '', quantity: 1 } : item
      ));
      return;
    }
    
    const filteredValue = filterNumericInput(rawValue);
    const numValue = parseInt(filteredValue) || 1;
    
    setOrderItems(prev => prev.map((item, i) => 
      i === index ? { ...item, displayQuantity: filteredValue, quantity: numValue } : item
    ));
  };

  const incrementQuantity = (index) => {
    setOrderItems(prev => prev.map((item, i) => {
      if (i === index) {
        const newQuantity = (item.quantity || 1) + 1;
        return { ...item, quantity: newQuantity, displayQuantity: newQuantity.toString() };
      }
      return item;
    }));
  };

  const decrementQuantity = (index) => {
    setOrderItems(prev => prev.map((item, i) => {
      if (i === index) {
        const newQuantity = Math.max(1, (item.quantity || 1) - 1);
        return { ...item, quantity: newQuantity, displayQuantity: newQuantity.toString() };
      }
      return item;
    }));
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

      <div className="p-3">
        <div className="space-y-3">
          {/* Controles principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <select
              name="waiter"
              value={formData.waiter}
              onChange={handleInputChange}
              className={`px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm ${
                errors.waiter ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={!!orderId || existingOrder?.status === 'SERVED'}
            >
              <option value="">Seleccionar mesero</option>
              {availableWaiters.map(waiter => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.name}
                </option>
              ))}
            </select>
            
            <select
              value={selectedZoneFilter}
              onChange={(e) => {
                setSelectedZoneFilter(e.target.value);
                if (formData.table) {
                  setFormData(prev => ({ ...prev, table: '' }));
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              disabled={!!orderId || existingOrder?.status === 'SERVED'}
            >
              <option value="">Zona</option>
              {availableZones.map(zone => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>

            <select
              name="table"
              value={formData.table}
              onChange={handleInputChange}
              className={`px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm ${
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

            {existingOrder ? (
              <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 font-medium text-sm text-center">
                {formData.status === 'CREATED' && 'Creado'}
                {formData.status === 'SERVED' && 'Entregado'}
                {formData.status === 'PAID' && 'Pagado'}
              </div>
            ) : (
              <div></div>
            )}
          </div>

          {/* Filtros y botón agregar */}
          <div className="flex items-center gap-2">
            <select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            >
              <option value="">Filtrar por grupo</option>
              {availableGroups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            
            <button
              onClick={addOrderItem}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              title="Agregar nuevo item"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>

          {/* Errores */}
          {(errors.waiter || errors.table || errors.items) && (
            <div className="space-y-1">
              {errors.waiter && <p className="text-sm text-red-600">{errors.waiter}</p>}
              {errors.table && <p className="text-sm text-red-600">{errors.table}</p>}
              {errors.items && <p className="text-sm text-red-600">{errors.items}</p>}
            </div>
          )}

          {/* Items */}
          {orderItems.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <ShoppingCart className="h-6 w-6 text-gray-400 mx-auto mb-2" />
              <p className="font-medium">No hay items agregados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orderItems.map((item, index) => {
                const displayNumber = orderItems.length - index;
                const getStatusText = (status) => {
                  return status === 'CREATED' ? 'Creado' : status === 'SERVED' ? 'Entregado' : status;
                };
                
                // Lógica: si hay items nuevos (sin ID), los anteriores solo se pueden eliminar
                const hasNewItems = orderItems.some(i => !i.id);
                const isOldItem = !!item.id;
                const canEditOldItem = !hasNewItems || !isOldItem;
                const finalCanEdit = item.can_edit && canEditOldItem;
                
                return (
                  <div key={item.tempKey || item.id || index} className={`p-3 rounded border ${ 
                    !finalCanEdit ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-200'
                  }`}>
                    {/* Header compacto */}
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-medium text-gray-900">
                        #{displayNumber} - {getStatusText(item.status)}
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
                    
                    {/* Contenido en grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      {/* Receta */}
                      <div className="md:col-span-5">
                        <select
                          value={item.recipe}
                          onChange={(e) => updateOrderItem(index, 'recipe', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                          disabled={!finalCanEdit}
                        >
                          <option value="">Seleccionar receta...</option>
                          {getFilteredRecipes(!!item.recipe && item.recipe !== '').map(recipe => (
                            <option key={recipe.id} value={recipe.id}>
                              {recipe.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Cantidad con botones */}
                      <div className="md:col-span-2">
                        <div className="flex items-center border border-gray-300 rounded">
                          <button
                            type="button"
                            onClick={() => decrementQuantity(index)}
                            disabled={!finalCanEdit}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                          >
                            -
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item.displayQuantity || item.quantity}
                            onChange={(e) => handleQuantityChange(e, index)}
                            className="w-full px-2 py-1 text-center border-0 focus:outline-none text-sm"
                            disabled={!finalCanEdit}
                          />
                          <button
                            type="button"
                            onClick={() => incrementQuantity(index)}
                            disabled={!finalCanEdit}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      
                      {/* Precio */}
                      <div className="md:col-span-2">
                        <div className="px-3 py-2 text-center font-semibold text-gray-900 text-sm">
                          {formatCurrency(item.unit_price)}
                        </div>
                      </div>
                      
                      {/* Opciones */}
                      <div className="md:col-span-3">
                        <div className="flex flex-col space-y-1">
                          <label className="flex items-center text-xs">
                            <input
                              type="checkbox"
                              checked={item.is_takeaway}
                              onChange={(e) => updateOrderItem(index, 'is_takeaway', e.target.checked)}
                              className="h-3 w-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              disabled={!finalCanEdit}
                            />
                            <span className="ml-1">Para llevar</span>
                          </label>
                          
                          {item.is_takeaway && (
                            <label className="flex items-center text-xs">
                              <input
                                type="checkbox"
                                checked={item.has_taper}
                                onChange={(e) => updateOrderItem(index, 'has_taper', e.target.checked)}
                                className="h-3 w-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                disabled={!finalCanEdit || !defaultContainer}
                              />
                              <span className="ml-1">Con envase (+{defaultContainer?.price || '0'})</span>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Notas en fila separada */}
                    <div className="mt-2">
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateOrderItem(index, 'notes', e.target.value)}
                        placeholder="Notas especiales..."
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={!finalCanEdit}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewOrder;
