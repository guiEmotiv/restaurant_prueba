import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Package, 
  StickyNote, 
  Check,
  AlertCircle,
  Filter,
  Search,
  Users,
  Clock,
  Trash2,
  CheckCircle,
  CreditCard
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const TableOrderEdit = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();
  const { hasPermission } = useAuth();
  
  // Estados principales
  const [table, setTable] = useState(null);
  const [order, setOrder] = useState(null);
  const [groups, setGroups] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [containers, setContainers] = useState([]);
  const [existingItems, setExistingItems] = useState([]);
  const [newItems, setNewItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrder, setUpdatingOrder] = useState(false);
  
  // Estados de filtros y UI
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewItems, setShowNewItems] = useState(false);
  
  // Estados para modal de item
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [itemNotes, setItemNotes] = useState('');
  const [itemTakeaway, setItemTakeaway] = useState(false);
  const [itemTaper, setItemTaper] = useState(false);

  const { orderId } = location.state || {};

  useEffect(() => {
    if (!orderId) {
      showError('ID de pedido no encontrado');
      navigate('/table-status');
      return;
    }
    loadData();
  }, [tableId, orderId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tableData, orderData, groupsData, recipesData, containersData] = await Promise.all([
        apiService.tables.getById(tableId),
        apiService.orders.getById(orderId),
        apiService.groups.getAll(),
        apiService.recipes.getAll(),
        apiService.containers.getAll()
      ]);
      
      setTable(tableData);
      setOrder(orderData);
      setExistingItems(orderData.items || []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setContainers(Array.isArray(containersData) ? containersData.filter(c => c.is_active) : []);
      
      // Solo recetas activas con stock
      const availableRecipes = recipesData.filter(recipe => recipe.is_active && recipe.available !== false);
      setRecipes(availableRecipes);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar los datos');
      navigate('/table-status');
    } finally {
      setLoading(false);
    }
  };

  const addNewItem = (recipe, notes = '', isTakeaway = false, hasTaper = false) => {
    const existingNewItem = newItems.find(item => 
      item.recipe.id === recipe.id && 
      item.notes === notes && 
      item.is_takeaway === isTakeaway &&
      item.has_taper === hasTaper
    );

    if (existingNewItem) {
      setNewItems(newItems.map(item => 
        item === existingNewItem 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      const newItem = {
        id: Date.now() + Math.random(), // ID único temporal
        recipe,
        quantity: 1,
        notes: notes || '',
        is_takeaway: isTakeaway,
        has_taper: hasTaper,
        unit_price: parseFloat(recipe.base_price || 0),
        isNew: true
      };
      setNewItems([...newItems, newItem]);
    }
    
    // Cerrar modal si está abierto
    setSelectedRecipe(null);
    resetItemModal();
  };

  const removeNewItem = (itemId) => {
    const item = newItems.find(i => i.id === itemId);
    if (item && item.quantity > 1) {
      setNewItems(newItems.map(i => 
        i.id === itemId 
          ? { ...i, quantity: i.quantity - 1 }
          : i
      ));
    } else {
      setNewItems(newItems.filter(i => i.id !== itemId));
    }
  };

  const removeExistingItem = async (itemId) => {
    const item = existingItems.find(i => i.id === itemId);
    if (!item) return;

    if (item.status === 'SERVED') {
      showError('No se puede eliminar un item que ya fue entregado');
      return;
    }

    const isLastItem = existingItems.length === 1 && newItems.length === 0;
    
    const confirmMessage = isLastItem 
      ? '¿Estás seguro? Este es el último item del pedido. Al eliminarlo se eliminará toda la orden.'
      : '¿Estás seguro de que deseas eliminar este item del pedido?';

    if (window.confirm(confirmMessage)) {
      try {
        await apiService.orderItems.delete(itemId);
        
        // Si era el último item, eliminar la orden completa
        if (isLastItem) {
          try {
            await apiService.orders.delete(order.id);
            showSuccess('Orden eliminada (no quedaban items)');
            navigate('/table-status');
            return;
          } catch (deleteOrderError) {
            console.error('Error deleting order:', deleteOrderError);
            // Continuar con el flujo normal si no se pudo eliminar la orden
          }
        }
        
        setExistingItems(existingItems.filter(i => i.id !== itemId));
        showSuccess('Item eliminado del pedido');
        // Recargar orden para actualizar total
        await loadData();
      } catch (error) {
        console.error('Error deleting item:', error);
        showError('Error al eliminar el item');
      }
    }
  };

  const resetItemModal = () => {
    setItemNotes('');
    setItemTakeaway(false);
    setItemTaper(false);
  };

  const openItemModal = (recipe) => {
    setSelectedRecipe(recipe);
    resetItemModal();
  };

  const handleQuickAdd = (recipe) => {
    addNewItem(recipe);
  };

  const calculateNewItemsTotal = () => {
    return newItems.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
  };

  const getNewItemsCount = () => {
    return newItems.reduce((total, item) => total + item.quantity, 0);
  };

  const checkAllItemsDelivered = () => {
    return existingItems.length > 0 && existingItems.every(item => item.status === 'SERVED');
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesGroup = selectedGroup === 'all' || recipe.group === parseInt(selectedGroup);
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (recipe.description && recipe.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesGroup && matchesSearch;
  });

  const handleUpdateOrder = async () => {
    if (newItems.length === 0) {
      showError('No hay items nuevos para agregar');
      return;
    }

    try {
      setUpdatingOrder(true);
      
      // Agregar nuevos items al pedido existente
      for (const newItem of newItems) {
        for (let i = 0; i < newItem.quantity; i++) {
          const itemData = {
            recipe: newItem.recipe.id,
            notes: newItem.notes || '',
            is_takeaway: newItem.is_takeaway || false,
            has_taper: newItem.has_taper || false,
            quantity: 1
          };

          // Si el item tiene taper, agregar el contenedor por defecto
          if (newItem.has_taper && containers.length > 0) {
            itemData.selected_container = containers[0].id;
          }
          
          await apiService.orders.addItem(orderId, itemData);
        }
      }

      showSuccess(`${getNewItemsCount()} items agregados al pedido`);
      
      // Recargar datos y limpiar nuevos items
      await loadData();
      setNewItems([]);
      
    } catch (error) {
      console.error('Error updating order:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message;
      showError('Error al actualizar el pedido: ' + errorMessage);
    } finally {
      setUpdatingOrder(false);
    }
  };

  const handleGoToPayment = () => {
    navigate(`/table/${tableId}/payment-ecommerce`, {
      state: { orderId: orderId }
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const getItemStatusColor = (status) => {
    switch (status) {
      case 'CREATED': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'SERVED': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getItemStatusText = (status) => {
    switch (status) {
      case 'CREATED': return 'Pendiente';
      case 'SERVED': return 'Entregado';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-base text-gray-600">Cargando pedido...</p>
        </div>
      </div>
    );
  }

  if (!table || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-base font-medium text-gray-900 mb-2">Pedido no encontrado</h2>
          <button 
            onClick={() => navigate('/table-status')}
            className="text-blue-600 hover:text-blue-800 text-base"
          >
            Volver al estado de mesas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col h-full">
      {/* Header fijo estandarizado reducido 70% */}
      <div className="bg-white border-b border-gray-200">
        <div className="p-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 flex-1">
              <button
                onClick={() => navigate('/table-status')}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
              </button>
              
              <div className="text-center flex-1">
                <h1 className="text-xs font-medium text-gray-900">
                  Mesa {table.table_number} - #{order.id}
                </h1>
                <p className="text-xs text-gray-500">{table.zone_name}</p>
              </div>
            </div>

            {/* Total estandarizado */}
            <div className="text-right">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-sm font-medium text-gray-900">{formatCurrency(order.total_amount)}</p>
            </div>
          </div>

          {/* Botones de acción estandarizados reducidos 70% */}
          <div className="flex items-center gap-1.5">
            {/* Botón Nueva Cuenta */}
            <button
              onClick={() => navigate(`/table/${tableId}/order-ecommerce`)}
              className="bg-purple-600 text-white px-2 py-1.5 rounded text-xs font-medium hover:bg-purple-700 flex items-center gap-0.5"
            >
              <Users className="h-3 w-3" />
              <span className="hidden sm:inline">Nueva Cuenta</span>
              <span className="sm:hidden">+</span>
            </button>

            {/* Botón Agregar Items */}
            <button
              onClick={() => setShowNewItems(!showNewItems)}
              className="relative bg-blue-600 text-white px-2 py-1.5 rounded text-xs font-medium hover:bg-blue-700 flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" />
              <span>Agregar</span>
              {getNewItemsCount() > 0 && (
                <div className="absolute -top-0.5 -right-0.5 bg-red-500 text-white rounded w-3.5 h-3.5 flex items-center justify-center text-xs font-medium">
                  {getNewItemsCount()}
                </div>
              )}
            </button>
            
            {/* Botón Procesar Pago */}
            {checkAllItemsDelivered() && hasPermission('canManagePayments') && (
              <button
                onClick={handleGoToPayment}
                className="bg-green-600 text-white px-2 py-1.5 rounded text-xs font-medium hover:bg-green-700 flex items-center gap-0.5"
              >
                <CreditCard className="h-3 w-3" />
                <span>Pagar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Panel principal - Items existentes reducido 70% */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${showNewItems ? 'hidden sm:flex sm:mr-56' : 'flex'}`}>
          <div className="p-2">
            <div className="bg-white rounded border border-gray-200 h-full flex flex-col">
              <div className="p-2 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-gray-900">Items del Pedido</h2>
                    <p className="text-xs text-gray-600">
                      {existingItems.length} items • {existingItems.filter(i => i.status === 'SERVED').length} entregados
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-yellow-400 rounded"></div>
                      <span className="text-gray-700">Pendiente</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-400 rounded"></div>
                      <span className="text-gray-700">Entregado</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2" style={{maxHeight: 'calc(100vh - 140px)'}}>
                {existingItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <ShoppingCart className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <h3 className="text-xs font-medium text-gray-900 mb-1">Sin items</h3>
                      <p className="text-xs text-gray-500">Agrega items al pedido</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {existingItems.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded p-2 border-l-2 ${
                          item.status === 'SERVED' 
                            ? 'bg-green-50 border-green-400' 
                            : 'bg-white border-yellow-400 border'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-1">
                              <h4 className="font-medium text-gray-900 text-xs">{item.recipe_name}</h4>
                              <span className={`inline-flex items-center px-1 py-0.5 rounded text-xs ${
                                item.status === 'SERVED' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {getItemStatusText(item.status)}
                              </span>
                            </div>

                            <div className="text-xs font-medium text-gray-900 mb-1">
                              {formatCurrency(item.total_price)}
                            </div>

                            {item.notes && (
                              <p className="text-xs text-gray-600 bg-blue-50 px-1 py-0.5 rounded mb-1">
                                {item.notes}
                              </p>
                            )}

                            <div className="flex gap-1">
                              {item.is_takeaway && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                                  <Package className="h-2.5 w-2.5" />
                                  Para llevar
                                </span>
                              )}
                              {item.has_taper && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                  <Check className="h-2.5 w-2.5" />
                                  Envase
                                </span>
                              )}
                            </div>
                          </div>

                          {item.status === 'CREATED' && (
                            <button
                              onClick={() => removeExistingItem(item.id)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Overlay para móviles */}
        {showNewItems && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
            onClick={() => setShowNewItems(false)}
          />
        )}

        {/* Panel para agregar nuevos items estandarizado reducido 70% */}
        {showNewItems && (
          <div className="fixed right-0 top-0 h-full w-full sm:w-56 bg-white border-l border-gray-200 z-50 pt-12 sm:pt-0">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-2 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-medium text-gray-900">Agregar Items</h2>
                  <button
                    onClick={() => setShowNewItems(false)}
                    className="p-1 text-gray-500 hover:text-gray-700 rounded transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" />
                  </button>
                </div>

                {/* Filtros */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-2.5 w-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar platos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-6 pr-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Todos los grupos</option>
                    {groups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lista de recetas estandarizada */}
              <div className="flex-1 overflow-y-auto p-2" style={{maxHeight: 'calc(100vh - 160px)'}}>
                {filteredRecipes.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <h3 className="text-xs font-medium text-gray-900 mb-1">Sin resultados</h3>
                      <p className="text-xs text-gray-500">Intenta otros términos</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredRecipes.map((recipe) => (
                      <div
                        key={recipe.id}
                        className="bg-gray-50 rounded border border-gray-200 p-2"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 text-xs line-clamp-1">
                              {recipe.name}
                            </h4>
                            <p className="text-xs text-gray-600">
                              {recipe.group_name || 'Sin grupo'}
                            </p>

                            <div className="flex items-center justify-between my-1">
                              <span className="text-xs font-medium text-gray-900">
                                {formatCurrency(recipe.base_price)}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {recipe.preparation_time}min
                              </span>
                            </div>

                            <div className="flex gap-1">
                              <button
                                onClick={() => handleQuickAdd(recipe)}
                                className="flex-1 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-700 flex items-center justify-center gap-0.5"
                              >
                                <Plus className="h-2.5 w-2.5" />
                                Agregar
                              </button>
                              <button
                                onClick={() => openItemModal(recipe)}
                                className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-xs"
                                title="Personalizar"
                              >
                                <StickyNote className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Carrito de nuevos items estandarizado */}
              {newItems.length > 0 && (
                <div className="border-t border-gray-200 p-2 bg-gray-50">
                  <div className="bg-white rounded p-2 mb-2">
                    <h4 className="font-medium text-gray-900 mb-2 text-xs">Items a Agregar</h4>
                    <div className="space-y-2 max-h-24 overflow-y-auto">
                      {newItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-blue-50 rounded p-2">
                          <div className="flex-1">
                            <div className="font-medium text-xs text-gray-900">{item.recipe.name}</div>
                            <div className="text-xs text-gray-600">
                              {item.quantity}x {formatCurrency(item.unit_price)} = {formatCurrency(item.unit_price * item.quantity)}
                            </div>
                          </div>
                          <button
                            onClick={() => removeNewItem(item.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors ml-2"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 mt-2 border-t border-gray-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700">Subtotal:</span>
                        <span className="font-medium text-gray-900">{formatCurrency(calculateNewItemsTotal())}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleUpdateOrder}
                    disabled={updatingOrder}
                    className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 font-medium flex items-center justify-center gap-1 transition-colors text-xs"
                  >
                    {updatingOrder ? (
                      <>
                        <div className="animate-spin rounded h-3 w-3 border border-white border-t-transparent"></div>
                        Actualizando...
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3" />
                        Actualizar ({getNewItemsCount()})
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal estandarizado simplificado para agregar item */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded max-w-sm w-full">
            {/* Header del modal */}
            <div className="p-2 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-gray-900">
                  {selectedRecipe.name}
                </h3>
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-3">
              {/* Precio */}
              <div className="text-center py-2 bg-gray-50 rounded">
                <div className="text-sm font-medium text-gray-900">
                  {formatCurrency(selectedRecipe.base_price)}
                </div>
              </div>

              {/* Notas simplificadas */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Ej: Sin cebolla, término medio..."
                  className="w-full px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>

              {/* Opciones */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={itemTakeaway}
                    onChange={(e) => {
                      setItemTakeaway(e.target.checked);
                      if (e.target.checked) {
                        setItemTaper(true);
                      }
                    }}
                    className="rounded text-orange-600"
                  />
                  <Package className="h-3 w-3 text-orange-600" />
                  Para llevar
                </label>

                {itemTakeaway && (
                  <label className="flex items-center gap-2 text-xs ml-4">
                    <input
                      type="checkbox"
                      checked={itemTaper}
                      onChange={(e) => setItemTaper(e.target.checked)}
                      className="rounded text-green-600"
                    />
                    <Check className="h-3 w-3 text-green-600" />
                    Incluir envase
                  </label>
                )}
              </div>
            </div>

            {/* Footer del modal */}
            <div className="p-2 bg-gray-50 border-t border-gray-200">
              <div className="flex gap-1">
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-100 transition-colors text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    addNewItem(selectedRecipe, itemNotes, itemTakeaway, itemTaper);
                    showSuccess(`${selectedRecipe.name} agregado`);
                  }}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium flex items-center justify-center gap-1 transition-colors text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableOrderEdit;