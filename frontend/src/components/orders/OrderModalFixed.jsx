import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Minus, Save, Trash2, ShoppingCart } from 'lucide-react';
import Button from '../common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const OrderModal = ({ isOpen, onClose, order = null, onSave }) => {
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
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
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');
  const [deletedItemIds, setDeletedItemIds] = useState([]); // Llevar registro de items eliminados
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadAvailableData();
      if (order) {
        // Modo edición
        setFormData({
          table: order.table?.id || order.table || '',
          waiter: order.waiter?.id || order.waiter || '',
          status: order.status || 'CREATED'
        });
        loadOrderItems();
      } else {
        // Modo creación
        resetForm();
      }
    }
  }, [isOpen, order]);

  const resetForm = () => {
    setFormData({
      table: '',
      waiter: '',
      status: 'CREATED'
    });
    setOrderItems([]);
    setSelectedZoneFilter('');
    setSelectedGroupFilter('');
    setDeletedItemIds([]);
    setErrors({});
  };

  // Filtrar recetas según el grupo seleccionado (solo para items sin seleccionar)
  const getFilteredRecipes = (itemHasSelection = false) => {
    // Si el item ya tiene una selección, mostrar todas las recetas
    if (itemHasSelection) {
      return availableRecipes.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // Si no hay selección, aplicar el filtro
    let filtered;
    if (!selectedGroupFilter) {
      filtered = availableRecipes;
    } else {
      filtered = availableRecipes.filter(recipe => recipe.group === parseInt(selectedGroupFilter));
    }
    
    // Ordenar alfabéticamente por nombre
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Filtrar mesas según la zona seleccionada
  const getFilteredTables = () => {
    if (!selectedZoneFilter) {
      return availableTables.sort((a, b) => a.table_number.localeCompare(b.table_number));
    }
    return availableTables
      .filter(table => table.zone === parseInt(selectedZoneFilter))
      .sort((a, b) => a.table_number.localeCompare(b.table_number));
  };

  // Obtener el nombre del grupo seleccionado
  const getSelectedGroupName = () => {
    if (!selectedGroupFilter) return 'Todos los grupos';
    const group = availableGroups.find(g => g.id === parseInt(selectedGroupFilter));
    return group ? group.name : 'Grupo desconocido';
  };

  // Obtener el nombre de la zona seleccionada
  const getSelectedZoneName = () => {
    if (!selectedZoneFilter) return 'Todas las zonas';
    const zone = availableZones.find(z => z.id === parseInt(selectedZoneFilter));
    return zone ? zone.name : 'Zona desconocida';
  };

  const loadAvailableData = async () => {
    try {
      const [recipesData, tablesData, zonesData, groupsData, waitersData] = await Promise.all([
        apiService.recipes.getAll(), // Sin show_all, el backend filtra automáticamente
        apiService.tables.getAll(),
        apiService.zones.getAll(),
        apiService.groups.getAll(),
        apiService.waiters.getAll()
      ]);
      // El backend ya filtra recetas activas con stock suficiente
      setAvailableRecipes(Array.isArray(recipesData) ? recipesData : []);
      setAvailableTables(Array.isArray(tablesData) ? tablesData : []);
      setAvailableZones(Array.isArray(zonesData) ? zonesData : []);
      setAvailableGroups(Array.isArray(groupsData) ? groupsData : []);
      setAvailableWaiters(Array.isArray(waitersData) ? waitersData.filter(w => w.is_active) : []);
    } catch (error) {
      console.error('Error loading available data:', error);
    }
  };

  const loadOrderItems = async () => {
    if (!order?.id) return;
    
    try {
      const orderDetails = await apiService.orders.getById(order.id);
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
        can_delete: item.status === 'CREATED',
        can_edit: item.status === 'CREATED', // Inicialmente todos los items existentes pueden editarse
        tempKey: item.tempKey || (Date.now() + Math.random())
      })));
    } catch (error) {
      console.error('Error loading order items:', error);
      setOrderItems([]);
    }
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

  const addOrderItem = () => {
    setOrderItems(prev => {
      // Marcar todos los items existentes como no editables cuando se agrega uno nuevo
      const updatedPrev = prev.map(item => ({
        ...item,
        can_edit: false // Bloquear edición de items anteriores
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
        can_delete: true,
        can_edit: true, // Solo el nuevo item puede ser editado
        tempKey: Date.now() + Math.random() // Unique key for React
      };
      // Add new item at the beginning of the array
      return [newItem, ...updatedPrev];
    });
  };

  const removeOrderItem = (index) => {
    const item = orderItems[index];
    if (!item.can_delete) {
      showError('No se puede eliminar este item porque ya fue entregado');
      return;
    }
    
    // Si el item tiene ID (existe en backend), agregarlo a la lista de eliminados
    if (item.id) {
      setDeletedItemIds(prev => [...prev, item.id]);
    }
    
    // Eliminar del estado local
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
          return { ...item, [field]: value };
        }
        return item;
      });
    });
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Validar mesa
    if (!formData.table || formData.table === '') {
      newErrors.table = 'La mesa es requerida';
    } else {
      const tableId = parseInt(formData.table);
      if (isNaN(tableId) || tableId <= 0) {
        newErrors.table = 'Debe seleccionar una mesa válida';
      }
    }
    
    // Validar mesero
    if (!formData.waiter || formData.waiter === '') {
      newErrors.waiter = 'El mesero es requerido';
    } else {
      const waiterId = parseInt(formData.waiter);
      if (isNaN(waiterId) || waiterId <= 0) {
        newErrors.waiter = 'Debe seleccionar un mesero válido';
      }
    }
    
    // Validar items - al menos uno debe estar completo
    const validItems = orderItems.filter(item => {
      if (!item.recipe) return false;
      
      // Extract recipe ID for validation
      let recipeId = item.recipe;
      if (typeof recipeId === 'object' && recipeId !== null) {
        recipeId = recipeId.id || recipeId.value;
      }
      
      // Check if it's a valid number
      const parsedId = parseInt(recipeId);
      return !isNaN(parsedId) && parsedId > 0;
    });
    
    if (validItems.length === 0) {
      newErrors.items = 'Debe agregar al menos un item válido con receta seleccionada';
    }
    
    // Validar cada item individual (permitir duplicados)
    orderItems.forEach((item, index) => {
      if (item.recipe && item.recipe !== '') {
        let recipeId;
        if (typeof item.recipe === 'object' && item.recipe !== null) {
          recipeId = item.recipe.id || item.recipe;
        } else {
          recipeId = item.recipe;
        }
        
        const parsedRecipeId = parseInt(recipeId);
        const displayNumber = orderItems.length - index;
        
        if (!recipeId || isNaN(parsedRecipeId)) {
          newErrors[`item_${index}`] = `El item ${displayNumber} tiene una receta inválida`;
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    try {
      // Preparar items válidos
      const validItems = orderItems.filter(item => {
        if (!item.recipe) return false;
        
        // Extract recipe ID for validation
        let recipeId = item.recipe;
        if (typeof recipeId === 'object' && recipeId !== null) {
          recipeId = recipeId.id || recipeId.value;
        }
        
        // Check if it's a valid number
        const parsedId = parseInt(recipeId);
        return !isNaN(parsedId) && parsedId > 0;
      });
      
      let savedOrder;
      if (order?.id) {
        // Actualizar pedido existente - table y waiter requeridos por serializer
        const orderData = {
          table: parseInt(formData.table),
          waiter: parseInt(formData.waiter),
          status: formData.status
        };
        savedOrder = await apiService.orders.update(order.id, orderData);
        
        // Manejar actualización de items - COMPLETO
        
        // 1. Eliminar items que fueron removidos
        if (deletedItemIds.length > 0) {
          for (const itemId of deletedItemIds) {
            try {
              await apiService.orderItems.delete(itemId);
            } catch (error) {
              console.error('Error deleting item:', itemId, error);
              throw error;
            }
          }
        }
        
        // 2. Crear nuevos items (los que no tienen id)
        const newItems = orderItems.filter(item => !item.id && item.recipe);
        
        if (newItems.length > 0) {
          for (const item of newItems) {
            try {
              const createData = {
                order: order.id,
                recipe: parseInt(item.recipe),
                notes: item.notes || '',
                quantity: item.quantity || 1,
                is_takeaway: item.is_takeaway || false,
                has_taper: item.has_taper || false
              };
              await apiService.orderItems.create(createData);
            } catch (error) {
              console.error('Error creating new item:', error);
              throw error;
            }
          }
        }
      } else {
        // Crear nuevo pedido con items incluidos según OrderCreateSerializer
        
        // Process all items (allowing duplicates) 
        const processedItems = validItems.map((item, index) => {
          // Extract recipe ID properly - ensure it's a number
          let recipeId = item.recipe;
          
          // Handle case where recipe might be an object or string
          if (typeof recipeId === 'object' && recipeId !== null) {
            recipeId = recipeId.id || recipeId.value || null;
          }
          
          // Convert to number
          const parsedRecipeId = parseInt(recipeId);
          
          if (isNaN(parsedRecipeId) || parsedRecipeId <= 0) {
            throw new Error(`Receta inválida en el item ${index + 1}`);
          }
          
          return {
            recipe: parsedRecipeId,
            notes: (item.notes || '').toString().trim(),
            quantity: parseInt(item.quantity) || 1,
            is_takeaway: item.is_takeaway || false,
            has_taper: item.has_taper || false
          };
        });
        
        // Final validation before sending
        if (processedItems.length === 0) {
          throw new Error('Debes agregar al menos un item al pedido');
        }
        
        const orderData = {
          table: parseInt(formData.table),
          waiter: parseInt(formData.waiter),
          items: processedItems
        };
        
        // Validate that all items have proper structure
        const invalidItems = orderData.items.filter(item => 
          typeof item !== 'object' || 
          typeof item.recipe !== 'number' || 
          isNaN(item.recipe) || 
          item.recipe <= 0
        );
        
        if (invalidItems.length > 0) {
          throw new Error('Algunos items tienen datos inválidos');
        }
        
        savedOrder = await apiService.orders.create(orderData);
      }
      
      // Verificar si después de la actualización todos los items están SERVED (solo para edición)
      if (order?.id) {
        // Recargar el pedido actualizado para verificar el estado de los items
        const updatedOrder = await apiService.orders.getById(order.id);
        const remainingItems = updatedOrder.items || [];
        
        // Si hay items y todos están SERVED, cambiar estatus del pedido a SERVED
        if (remainingItems.length > 0 && remainingItems.every(item => item.status === 'SERVED')) {
          try {
            await apiService.orders.updateStatus(order.id, 'SERVED');
            
            // Cerrar modal y mostrar mensaje de éxito con redirección
            onSave();
            onClose();
            showSuccess('Pedido actualizado. Todos los items están listos para cobrar.');
            
            // Redireccionar a vista de pagos después de un breve delay
            setTimeout(() => {
              navigate(`/orders/${order.id}/payment`);
            }, 1500);
            
            return; // Salir temprano para evitar el flujo normal
          } catch (statusError) {
            console.error('Error updating order status to SERVED:', statusError);
            // Continuar con el flujo normal si falla el cambio de estatus
          }
        }
      }
      
      onSave();
      onClose();
      showSuccess(order ? 'Pedido actualizado exitosamente' : 'Pedido creado exitosamente');
    } catch (error) {
      let errorMessage = 'Error desconocido';
      
      // Si es un error de validación personalizado (del try/catch anterior)
      if (error.message && !error.response) {
        errorMessage = error.message;
      } else if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else {
          // Simplificar el manejo de errores de validación
          const errors = [];
          for (const [field, fieldErrors] of Object.entries(error.response.data)) {
            if (field === 'items' && Array.isArray(fieldErrors)) {
              // Manejo especial para errores de items
              fieldErrors.forEach((itemError, index) => {
                if (typeof itemError === 'object' && itemError !== null) {
                  for (const [itemField, itemFieldError] of Object.entries(itemError)) {
                    if (Array.isArray(itemFieldError)) {
                      errors.push(`Item ${index + 1} - ${itemField}: ${itemFieldError.join(', ')}`);
                    } else {
                      errors.push(`Item ${index + 1} - ${itemField}: ${itemFieldError}`);
                    }
                  }
                } else {
                  errors.push(`Item ${index + 1}: ${itemError}`);
                }
              });
            } else if (Array.isArray(fieldErrors)) {
              errors.push(`${field}: ${fieldErrors.join(', ')}`);
            } else {
              errors.push(`${field}: ${fieldErrors}`);
            }
          }
          errorMessage = errors.length > 0 ? errors.join('\n') : 'Error de validación';
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showError('Error al guardar el pedido: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount || 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[95vh] sm:h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {order ? `Editar Pedido #${order.id}` : 'Nuevo Pedido'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 -m-2"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-6">
            {/* Filtros y Items unificados */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-4">
                {/* Campo de mesero - arriba de todo */}
                <div>
                  <select
                    name="waiter"
                    value={formData.waiter}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm ${
                      errors.waiter ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Seleccionar mesero</option>
                    {availableWaiters.map(waiter => (
                      <option key={waiter.id} value={waiter.id}>
                        {waiter.name}
                      </option>
                    ))}
                  </select>
                  {errors.waiter && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.waiter}
                    </p>
                  )}
                </div>

                {/* Filtros de mesa y zona */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Filtro de Zona */}
                  <div>
                    <select
                      value={selectedZoneFilter}
                      onChange={(e) => {
                        setSelectedZoneFilter(e.target.value);
                        // Limpiar mesa seleccionada si cambia la zona
                        if (formData.table) {
                          setFormData(prev => ({ ...prev, table: '' }));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                      disabled={!!order} // No cambiar en edición
                    >
                      <option value="">Zona</option>
                      {availableZones.map(zone => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name} ({availableTables.filter(t => t.zone === zone.id).length})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selector de Mesa */}
                  <div>
                    <select
                      name="table"
                      value={formData.table}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm ${
                        errors.table ? 'border-red-500' : 'border-gray-300'
                      }`}
                      disabled={!!order} // No cambiar mesa en edición para evitar confusión operativa
                    >
                      <option value="">Mesa</option>
                      {getFilteredTables().map(table => (
                        <option key={table.id} value={table.id}>
                          Mesa {table.table_number}
                          {!selectedZoneFilter && ` - ${table.zone_name}`}
                        </option>
                      ))}
                    </select>
                    {errors.table && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.table}
                      </p>
                    )}
                  </div>

                  {/* Estado Actual (solo en edición) */}
                  {order && (
                    <div>
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 font-medium text-sm">
                        {formData.status === 'CREATED' && 'Creado'}
                        {formData.status === 'SERVED' && 'Entregado'}
                        {formData.status === 'PAID' && 'Pagado'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filtro de grupos y botón agregar */}
                <div className="flex items-center justify-between gap-2">
                  {/* Group Filter */}
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
                  
                  {/* Add Item Button */}
                  <button
                    onClick={addOrderItem}
                    disabled={order && order.status !== 'CREATED'}
                    className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={order && order.status !== 'CREATED' ? 'Solo se pueden agregar items a órdenes creadas' : 'Agregar nuevo item'}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {errors.items && (
                <p className="mb-4 text-sm text-red-600">
                  {errors.items}
                </p>
              )}

              <div className="space-y-3">
                {orderItems.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                    <ShoppingCart className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="font-medium">No hay items agregados</p>
                    <p className="text-sm">El total se calculará automáticamente al agregar items</p>
                  </div>
                ) : (
                  <>
                    {/* Header de tabla - Solo en desktop */}
                    <div className="hidden lg:grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 rounded-md text-xs font-medium text-gray-700">
                      <div className="col-span-3">Item</div>
                      <div className="col-span-1 text-center">Cant.</div>
                      <div className="col-span-1 text-center">Precio</div>
                      <div className="col-span-2 text-center">Para llevar/Taper</div>
                      <div className="col-span-1 text-center">Estado</div>
                      <div className="col-span-3">Notas</div>
                      <div className="col-span-1 text-center">Acción</div>
                    </div>
                    
                    {orderItems.map((item, index) => {
                      // Calculate display number (reverse of actual index)
                      const displayNumber = orderItems.length - index;
                      return (
                      <div key={item.tempKey || item.id || index} className={`border border-gray-200 rounded-lg p-3 ${ 
                        !item.can_edit ? 'bg-gray-100' : 'bg-white'
                      }`}>
                        {/* Layout móvil - Formato de card */}
                        <div className="lg:hidden space-y-3">
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-sm text-gray-900">Item #{displayNumber}</span>
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
                            <option value="">
                              {getFilteredRecipes(!!item.recipe && item.recipe !== '').length === 0 ? 'No hay recetas disponibles' : 'Seleccionar...'}
                            </option>
                            {getFilteredRecipes(!!item.recipe && item.recipe !== '').map(recipe => (
                              <option key={recipe.id} value={recipe.id}>
                                {recipe.name}
                              </option>
                            ))}
                          </select>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                disabled={!item.can_edit}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Precio Unit.</label>
                              <div className="text-sm font-semibold text-gray-900">{formatCurrency(item.unit_price)}</div>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center">
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
                                    disabled={!item.can_edit}
                                  />
                                  <span className="ml-2 text-xs text-gray-700">Con taper</span>
                                </label>
                              )}
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                item.status === 'CREATED' ? 'bg-yellow-100 text-yellow-800' :
                                item.status === 'SERVED' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {item.status === 'CREATED' && 'Creado'}
                                {item.status === 'SERVED' && 'Entregado'}
                              </span>
                            </div>
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
                        
                        {/* Layout desktop - Grid actualizado */}
                        <div className="hidden lg:grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-3">
                            <select
                              value={item.recipe}
                              onChange={(e) => updateOrderItem(index, 'recipe', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                              disabled={!item.can_edit}
                            >
                              <option value="">
                                {getFilteredRecipes(!!item.recipe && item.recipe !== '').length === 0 ? 'No hay recetas disponibles' : 'Seleccionar...'}
                              </option>
                              {getFilteredRecipes(!!item.recipe && item.recipe !== '').map(recipe => (
                                <option key={recipe.id} value={recipe.id}>
                                  {recipe.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="col-span-1 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
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
                                    disabled={!item.can_edit}
                                  />
                                  <span className="ml-1 text-xs text-gray-700">Taper</span>
                                </label>
                              )}
                            </div>
                          </div>
                          
                          <div className="col-span-1 text-center">
                            <span className={`inline-flex px-1 py-1 text-xs font-semibold rounded-full ${
                              item.status === 'CREATED' ? 'bg-yellow-100 text-yellow-800' :
                              item.status === 'SERVED' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {item.status === 'CREATED' && 'Creado'}
                              {item.status === 'SERVED' && 'Entregado'}
                            </span>
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

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end px-4 sm:px-6 py-4 border-t border-gray-200 bg-white">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          </button>
        </div>

      </div>
    </div>
  );
};

export default OrderModal;