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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando pedido...</p>
        </div>
      </div>
    );
  }

  if (!table || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Pedido no encontrado</h2>
          <button 
            onClick={() => navigate('/table-status')}
            className="text-blue-600 hover:text-blue-800"
          >
            Volver al estado de mesas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col h-full">
      {/* Header fijo compacto */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={() => navigate('/table-status')}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              
              <div className="text-center flex-1">
                <h1 className="text-sm font-bold text-gray-900">
                  Mesa {table.table_number} - #{order.id}
                </h1>
                <p className="text-xs text-gray-600">{table.zone_name}</p>
              </div>
            </div>

            {/* Total compacto */}
            <div className="text-right">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-base font-bold text-gray-900">{formatCurrency(order.total_amount)}</p>
            </div>
          </div>

          {/* Botones de acción compactos */}
          <div className="flex items-center gap-2">
            {/* Botón Nueva Cuenta */}
            <button
              onClick={() => navigate(`/table/${tableId}/order-ecommerce`)}
              className="bg-purple-600 text-white px-2 py-1.5 rounded text-xs font-medium hover:bg-purple-700 flex items-center gap-1"
            >
              <Users className="h-3 w-3" />
              <span className="hidden sm:inline">Nueva Cuenta</span>
              <span className="sm:hidden">+</span>
            </button>

            {/* Botón Agregar Items */}
            <button
              onClick={() => setShowNewItems(!showNewItems)}
              className="relative bg-blue-600 text-white px-2 py-1.5 rounded text-xs font-medium hover:bg-blue-700 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              <span>Agregar</span>
              {getNewItemsCount() > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">
                  {getNewItemsCount()}
                </div>
              )}
            </button>
            
            {/* Botón Procesar Pago */}
            {checkAllItemsDelivered() && hasPermission('canManagePayments') && (
              <button
                onClick={handleGoToPayment}
                className="bg-green-600 text-white px-2 py-1.5 rounded text-xs font-medium hover:bg-green-700 flex items-center gap-1"
              >
                <CreditCard className="h-3 w-3" />
                <span>Pagar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Panel principal - Items existentes */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${showNewItems ? 'hidden sm:flex sm:mr-96' : 'flex'}`}>
          <div className="p-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
              <div className="p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Items del Pedido</h2>
                    <p className="text-xs text-gray-600">
                      {existingItems.length} items • {existingItems.filter(i => i.status === 'SERVED').length} entregados
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      <span className="text-gray-600">Pendiente</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-gray-600">Entregado</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {existingItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <h3 className="text-sm font-medium text-gray-900 mb-1">Sin items</h3>
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
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900 text-xs">{item.recipe_name}</h4>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                                item.status === 'SERVED' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {getItemStatusText(item.status)}
                              </span>
                            </div>

                            <div className="text-xs font-semibold text-gray-900 mb-1">
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

        {/* Panel para agregar nuevos items compacto */}
        {showNewItems && (
          <div className="fixed right-0 top-0 h-full w-full sm:w-80 bg-white border-l border-gray-200 shadow-xl z-50 pt-12 sm:pt-0">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-gray-900">Agregar Items</h2>
                  <button
                    onClick={() => setShowNewItems(false)}
                    className="p-1 text-gray-500 hover:text-gray-700 rounded transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>

                {/* Filtros */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar platos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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

              {/* Lista de recetas compacta */}
              <div className="flex-1 overflow-y-auto p-2">
                {filteredRecipes.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <h3 className="text-sm font-medium text-gray-900 mb-1">Sin resultados</h3>
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
                              <span className="text-xs font-bold text-gray-900">
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

              {/* Carrito de nuevos items */}
              {newItems.length > 0 && (
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                  <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                    <h4 className="font-semibold text-gray-900 mb-3">Items a Agregar</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {newItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                          <div className="flex-1">
                            <div className="font-medium text-sm text-gray-900">{item.recipe.name}</div>
                            <div className="text-xs text-gray-600">
                              {item.quantity}x {formatCurrency(item.unit_price)} = {formatCurrency(item.unit_price * item.quantity)}
                            </div>
                          </div>
                          <button
                            onClick={() => removeNewItem(item.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-lg transition-colors ml-2"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 mt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between text-lg">
                        <span className="font-semibold text-gray-700">Subtotal:</span>
                        <span className="font-bold text-gray-900">{formatCurrency(calculateNewItemsTotal())}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleUpdateOrder}
                    disabled={updatingOrder}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-xl hover:from-green-700 hover:to-green-800 disabled:opacity-50 font-semibold flex items-center justify-center gap-2 shadow-lg transition-all duration-200 transform hover:scale-105"
                  >
                    {updatingOrder ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Actualizando pedido...
                      </>
                    ) : (
                      <>
                        <Check className="h-5 w-5" />
                        Actualizar Pedido ({getNewItemsCount()} items)
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal para agregar item con opciones */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedRecipe.name}
                </h3>
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="text-xl font-bold text-gray-900">
                  {formatCurrency(selectedRecipe.base_price)}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notas especiales (opcional)
                  </label>
                  <textarea
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder="Ej: Sin cebolla, término medio..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={itemTakeaway}
                      onChange={(e) => {
                        setItemTakeaway(e.target.checked);
                        if (e.target.checked) {
                          setItemTaper(true);
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Para llevar</span>
                  </label>

                  {itemTakeaway && (
                    <label className="flex items-center gap-3 ml-6">
                      <input
                        type="checkbox"
                        checked={itemTaper}
                        onChange={(e) => setItemTaper(e.target.checked)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">Incluir envase</span>
                        {containers.length > 0 && itemTaper && (
                          <div className="text-xs text-gray-500 mt-1">
                            {containers[0].name} - {formatCurrency(containers[0].price)}
                            {containers[0].stock !== undefined && (
                              <span className="ml-1">({containers[0].stock} disponibles)</span>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    addNewItem(selectedRecipe, itemNotes, itemTakeaway, itemTaper);
                    showSuccess(`${selectedRecipe.name} agregado`);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
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