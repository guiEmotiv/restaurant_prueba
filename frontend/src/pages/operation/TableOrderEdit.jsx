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
  CreditCard,
  Star,
  Coffee,
  X,
  Edit3,
  Utensils,
  Eye
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
    showSuccess('Agregado al pedido');
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
      case 'CREATED': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'SERVED': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-200 border-t-blue-600"></div>
          </div>
          <p className="text-gray-600 font-medium">Cargando pedido...</p>
        </div>
      </div>
    );
  }

  if (!table || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pedido no encontrado</h2>
          <button 
            onClick={() => navigate('/table-status')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Volver al estado de mesas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Fijo */}
      <div className="bg-white shadow-sm sticky top-0 z-50 border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => navigate('/table-status')}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-semibold text-gray-900">Mesa {table.table_number}</h1>
                  <span className="text-sm text-gray-500">#{order.id}</span>
                </div>
                <p className="text-xs text-gray-500">{table.zone_name}</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-gray-500">Total</p>
              <p className="font-bold text-lg text-gray-900">{formatCurrency(order.total_amount)}</p>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => navigate(`/table/${tableId}/order-ecommerce`)}
              className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-1"
            >
              <Users className="h-4 w-4" />
              Nueva Cuenta
            </button>

            <button
              onClick={() => setShowNewItems(!showNewItems)}
              className="relative bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Agregar Items
              {getNewItemsCount() > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {getNewItemsCount()}
                </div>
              )}
            </button>
            
            {checkAllItemsDelivered() && hasPermission('canManagePayments') && (
              <button
                onClick={handleGoToPayment}
                className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                <CreditCard className="h-4 w-4" />
                Pagar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="px-4 py-4">
        {/* Items del Pedido */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="font-medium text-gray-900">Items del Pedido</h3>
            <p className="text-sm text-gray-500">
              {existingItems.length} items • {existingItems.filter(i => i.status === 'SERVED').length} entregados
            </p>
          </div>

          <div className="p-4">
            {existingItems.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <div className="text-gray-500 text-sm">Sin items en el pedido</div>
              </div>
            ) : (
              <div className="space-y-3">
                {existingItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border ${
                      item.status === 'SERVED' 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Coffee className="h-6 w-6 text-orange-500" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">{item.recipe_name}</h4>
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              item.status === 'SERVED' 
                                ? 'bg-green-500 text-white' 
                                : 'bg-yellow-500 text-white'
                            }`}>
                              {getItemStatusText(item.status)}
                            </span>
                          </div>
                          
                          <div className="text-lg font-bold text-gray-900 ml-2">
                            {formatCurrency(item.total_price)}
                          </div>
                        </div>

                        {item.notes && (
                          <div className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded mb-2">
                            {item.notes}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex gap-1">
                            {item.is_takeaway && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                                <Package className="h-2 w-2" />
                                Llevar
                              </span>
                            )}
                            {item.has_taper && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                <Check className="h-2 w-2" />
                                Envase
                              </span>
                            )}
                          </div>

                          {item.status === 'CREATED' && (
                            <button
                              onClick={() => removeExistingItem(item.id)}
                              className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-200 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal para Agregar Items */}
      {showNewItems && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowNewItems(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white z-50 max-h-[80vh] overflow-hidden rounded-t-lg shadow-xl border-t">
            {/* Header */}
            <div className="px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Agregar Items</h2>
                  <p className="text-sm text-gray-500">
                    {getNewItemsCount() > 0 ? `${getNewItemsCount()} items • ${formatCurrency(calculateNewItemsTotal())}` : 'Selecciona platos'}
                  </p>
                </div>
                <button
                  onClick={() => setShowNewItems(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className="px-4 py-3 border-b bg-gray-50">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Buscar platos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

            {/* Lista de Recetas */}
            <div className="flex-1 overflow-y-auto px-4 py-3 max-h-60">
              {filteredRecipes.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <div className="text-gray-500 text-sm">Sin resultados</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRecipes.map((recipe) => (
                    <div
                      key={recipe.id}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Coffee className="h-6 w-6 text-orange-500" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 truncate">{recipe.name}</h4>
                              <p className="text-xs text-gray-500">{recipe.group_name || 'Sin grupo'}</p>
                            </div>
                            
                            <div className="text-lg font-bold text-green-600 ml-2">
                              {formatCurrency(recipe.base_price)}
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="h-3 w-3" />
                              <span>{recipe.preparation_time}min</span>
                            </div>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleQuickAdd(recipe)}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
                              >
                                <Plus className="h-3 w-3" />
                                Agregar
                              </button>
                              <button
                                onClick={() => openItemModal(recipe)}
                                className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm hover:bg-gray-200 transition-colors"
                              >
                                <StickyNote className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer con Nuevos Items */}
            {newItems.length > 0 && (
              <div className="border-t px-4 py-3 bg-gray-50">
                <div className="mb-3">
                  <h4 className="font-medium text-gray-900 mb-2">Items a Agregar ({getNewItemsCount()})</h4>
                  <div className="space-y-2 max-h-24 overflow-y-auto">
                    {newItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-blue-50 rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">{item.recipe.name}</div>
                          <div className="text-xs text-gray-600">
                            {item.quantity}x {formatCurrency(item.unit_price)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900">
                            {formatCurrency(item.unit_price * item.quantity)}
                          </div>
                          <button
                            onClick={() => removeNewItem(item.id)}
                            className="w-6 h-6 bg-red-100 text-red-600 rounded flex items-center justify-center hover:bg-red-200 transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t">
                    <span className="font-medium text-gray-700">Subtotal:</span>
                    <span className="text-lg font-bold text-gray-900">{formatCurrency(calculateNewItemsTotal())}</span>
                  </div>
                </div>

                <button
                  onClick={handleUpdateOrder}
                  disabled={updatingOrder}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {updatingOrder ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Actualizar Pedido
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal para personalizar item */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {selectedRecipe.name}
              </h3>
              <button
                onClick={() => setSelectedRecipe(null)}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Precio */}
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(selectedRecipe.base_price)}
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas especiales
                </label>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Sin cebolla, término medio..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Opciones */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemTakeaway}
                    onChange={(e) => {
                      setItemTakeaway(e.target.checked);
                      if (e.target.checked) {
                        setItemTaper(true);
                      }
                    }}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <Package className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-900">Para llevar</span>
                </label>

                {itemTakeaway && (
                  <label className="flex items-center gap-2 p-3 ml-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemTaper}
                      onChange={(e) => setItemTaper(e.target.checked)}
                      className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">Incluir envase</span>
                  </label>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-4 py-3 flex gap-3">
              <button
                onClick={() => setSelectedRecipe(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  addNewItem(selectedRecipe, itemNotes, itemTakeaway, itemTaper);
                  showSuccess(`${selectedRecipe.name} agregado`);
                }}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableOrderEdit;