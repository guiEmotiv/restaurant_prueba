import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';
import { 
  Users, 
  Plus, 
  ShoppingCart, 
  Clock,
  Check,
  AlertCircle,
  Package,
  Coffee,
  ChevronRight,
  X,
  Minus,
  RefreshCw,
  Eye,
  Edit3,
  DollarSign
} from 'lucide-react';

const RestaurantOperations = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Main states
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]); // For table status calculation
  const [recipes, setRecipes] = useState([]);
  const [containers, setContainers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [step, setStep] = useState('tables'); // 'tables', 'orders', 'menu', 'cart'

  // Cart and menu states
  const [cart, setCart] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);

  // Modal states
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  // Load all initial data
  const loadInitialData = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setRefreshing(true);
      else setLoading(true);

      console.log('🔄 Loading restaurant data...');
      
      const [tablesRes, recipesRes, containersRes, groupsRes, allOrdersRes] = await Promise.all([
        api.get('/tables/'),
        api.get('/recipes/?is_active=true&is_available=true'),
        api.get('/containers/?is_active=true'),
        api.get('/groups/'),
        api.get('/orders/?status=CREATED')
      ]);
      
      console.log('✅ Data loaded:', {
        tables: tablesRes.data?.length || 0,
        recipes: recipesRes.data?.length || 0,
        containers: containersRes.data?.length || 0,
        groups: groupsRes.data?.length || 0,
        orders: allOrdersRes.data?.length || 0
      });

      setTables(Array.isArray(tablesRes.data) ? tablesRes.data : []);
      setRecipes(Array.isArray(recipesRes.data) ? recipesRes.data : []);
      setContainers(Array.isArray(containersRes.data) ? containersRes.data : []);
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
      setAllOrders(Array.isArray(allOrdersRes.data) ? allOrdersRes.data : []);
      
    } catch (error) {
      console.error('❌ Error loading data:', error);
      showToast('Error al cargar datos del restaurante', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInitialData();
    // Auto refresh every 30 seconds
    const interval = setInterval(() => loadInitialData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  // Memoize loadInitialData to avoid dependency warnings
  const memoizedLoadInitialData = useCallback(loadInitialData, [showToast]);

  // Load orders for specific table
  const loadTableOrders = async (tableId) => {
    try {
      console.log(`🔄 Loading orders for table ${tableId}...`);
      const response = await api.get(`/orders/?table=${tableId}&status=CREATED`);
      const tableOrders = Array.isArray(response.data) ? response.data : [];
      console.log(`✅ Loaded ${tableOrders.length} orders for table ${tableId}`);
      setOrders(tableOrders);
      return tableOrders;
    } catch (error) {
      console.error('❌ Error loading table orders:', error);
      showToast('Error al cargar pedidos de la mesa', 'error');
      return [];
    }
  };

  // Table management functions
  const getTableOrders = (tableId) => {
    return allOrders.filter(order => order.table?.id === tableId);
  };

  const getTableStatus = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    return tableOrders.length > 0 ? 'occupied' : 'available';
  };

  const getTableSummary = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    if (tableOrders.length === 0) return null;

    const totalAmount = tableOrders.reduce((sum, order) => 
      sum + parseFloat(order.grand_total || order.total_amount || 0), 0
    );
    
    const totalItems = tableOrders.reduce((sum, order) => 
      sum + (order.items?.length || 0), 0
    );

    const oldestOrder = tableOrders.reduce((oldest, order) => {
      const orderTime = new Date(order.created_at);
      const oldestTime = new Date(oldest.created_at);
      return orderTime < oldestTime ? order : oldest;
    });

    return {
      orderCount: tableOrders.length,
      totalAmount,
      totalItems,
      duration: getDurationText(oldestOrder.created_at),
      orders: tableOrders
    };
  };

  const getDurationText = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMinutes = Math.floor((now - created) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  };

  const getTableStatusColor = (status, duration = '') => {
    if (status === 'available') {
      return 'border-green-200 bg-green-50 hover:border-green-300';
    }
    
    if (duration.includes('h')) {
      const hours = parseInt(duration.split('h')[0]);
      if (hours >= 2) {
        return 'border-red-200 bg-red-50 hover:border-red-300';
      } else if (hours >= 1) {
        return 'border-yellow-200 bg-yellow-50 hover:border-yellow-300';
      }
    }
    
    return 'border-blue-200 bg-blue-50 hover:border-blue-300';
  };

  const getTableStatusIcon = (status, duration = '') => {
    if (status === 'available') {
      return <Check className="text-green-600" size={20} />;
    }
    
    if (duration.includes('h')) {
      const hours = parseInt(duration.split('h')[0]);
      if (hours >= 2) {
        return <AlertCircle className="text-red-600" size={20} />;
      } else if (hours >= 1) {
        return <Clock className="text-yellow-600" size={20} />;
      }
    }
    
    return <Users className="text-blue-600" size={20} />;
  };

  // Navigation functions
  const handleTableSelect = async (table) => {
    console.log(`🎯 Selected table: ${table.table_number}`);
    setSelectedTable(table);
    await loadTableOrders(table.id);
    setStep('orders');
  };

  const handleCreateNewOrder = () => {
    console.log('➕ Creating new order');
    setCurrentOrder(null);
    setCart([]);
    setStep('menu');
  };

  const handleEditOrder = (order) => {
    console.log(`✏️ Editing order ${order.id}`);
    setCurrentOrder(order);
    // Load existing items to cart for editing
    const cartItems = order.items?.map(item => ({
      recipe: item.recipe,
      quantity: item.quantity,
      notes: item.notes || '',
      is_takeaway: item.is_takeaway || false,
      unit_price: item.unit_price,
      total_price: item.total_price
    })) || [];
    setCart(cartItems);
    setStep('menu');
  };

  // Cart management functions
  const addToCart = (recipe) => {
    const existingItemIndex = cart.findIndex(item => 
      item.recipe.id === recipe.id && !item.notes && !item.is_takeaway
    );

    if (existingItemIndex >= 0) {
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += 1;
      newCart[existingItemIndex].total_price = newCart[existingItemIndex].unit_price * newCart[existingItemIndex].quantity;
      setCart(newCart);
    } else {
      const newItem = {
        recipe,
        quantity: 1,
        notes: '',
        is_takeaway: false,
        unit_price: parseFloat(recipe.base_price),
        total_price: parseFloat(recipe.base_price)
      };
      setCart([...cart, newItem]);
    }
    showToast(`${recipe.name} agregado`, 'success');
  };

  const updateCartItem = (index, updates) => {
    const newCart = [...cart];
    const oldItem = newCart[index];
    newCart[index] = { ...oldItem, ...updates };
    
    // Recalculate price if quantity changed
    if (updates.quantity !== undefined) {
      newCart[index].total_price = newCart[index].unit_price * updates.quantity;
    }
    
    setCart(newCart);
  };

  const removeFromCart = (index) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
    showToast('Item eliminado del carrito', 'info');
  };

  // Price calculation functions
  const getCartTotal = () => {
    return cart.reduce((total, item) => total + parseFloat(item.total_price), 0);
  };

  const getContainerTotal = () => {
    const takeawayItems = cart.filter(item => item.is_takeaway);
    return takeawayItems.reduce((total, item) => {
      const container = containers.find(c => c.id === item.recipe.container);
      return total + (container ? parseFloat(container.price) * item.quantity : 0);
    }, 0);
  };

  const getGrandTotal = () => {
    return getCartTotal() + getContainerTotal();
  };

  // Order saving function
  const saveOrder = async () => {
    if (cart.length === 0) {
      showToast('Agregue items al pedido', 'error');
      return;
    }

    try {
      setLoading(true);
      console.log(`💾 Saving order...`, { currentOrder: currentOrder?.id, itemCount: cart.length });
      
      if (currentOrder) {
        // Update existing order
        const orderData = {
          items: cart.map(item => ({
            recipe: item.recipe.id,
            quantity: item.quantity,
            notes: item.notes || '',
            is_takeaway: item.is_takeaway || false
          }))
        };
        
        await api.put(`/orders/${currentOrder.id}/`, orderData);
        showToast('Pedido actualizado exitosamente', 'success');
      } else {
        // Create new order
        const orderData = {
          table: selectedTable.id,
          waiter: user?.username || user?.email || 'Sistema',
          items: cart.map(item => ({
            recipe: item.recipe.id,
            quantity: item.quantity,
            notes: item.notes || '',
            is_takeaway: item.is_takeaway || false
          })),
          // Add container sales for takeaway items
          container_sales: cart
            .filter(item => item.is_takeaway && item.recipe.container)
            .map(item => ({
              container: item.recipe.container,
              quantity: item.quantity
            }))
        };
        
        console.log('📋 Order data:', orderData);
        await api.post('/orders/', orderData);
        showToast('Pedido creado exitosamente', 'success');
      }

      // Refresh data and return to orders view
      await Promise.all([
        loadTableOrders(selectedTable.id),
        loadInitialData(true)
      ]);
      
      setCart([]);
      setCurrentOrder(null);
      setStep('orders');
      
    } catch (error) {
      console.error('❌ Error saving order:', error);
      showToast(
        error.response?.data?.detail || 'Error al guardar el pedido', 
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // Filtered recipes for menu
  const filteredRecipes = useMemo(() => {
    return selectedGroup 
      ? recipes.filter(r => r.group?.id === selectedGroup)
      : recipes;
  }, [recipes, selectedGroup]);

  // Statistics calculations
  const stats = useMemo(() => {
    const availableTables = tables.filter(t => getTableStatus(t.id) === 'available').length;
    const occupiedTables = tables.filter(t => getTableStatus(t.id) === 'occupied').length;
    const totalActiveOrders = allOrders.length;
    const totalPendingSales = allOrders.reduce((sum, order) => 
      sum + parseFloat(order.grand_total || order.total_amount || 0), 0
    );

    return {
      availableTables,
      occupiedTables,
      totalActiveOrders,
      totalPendingSales
    };
  }, [tables, allOrders, getTableStatus]);

  // Main loading state
  if (loading && step === 'tables') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Cargando restaurante...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Top row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {step !== 'tables' && (
                <button
                  onClick={() => {
                    if (step === 'orders') {
                      setStep('tables');
                      setSelectedTable(null);
                    } else if (step === 'menu' || step === 'cart') {
                      setStep('orders');
                      setCart([]);
                      setCurrentOrder(null);
                    }
                  }}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ← Atrás
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {step === 'tables' && 'Operaciones del Restaurante'}
                  {step === 'orders' && `Mesa ${selectedTable?.table_number}`}
                  {(step === 'menu' || step === 'cart') && (currentOrder ? 'Editar Pedido' : 'Nuevo Pedido')}
                </h1>
                {selectedTable && (
                  <p className="text-sm text-gray-600">{selectedTable.zone?.name}</p>
                )}
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center space-x-3">
              {step === 'tables' && (
                <button
                  onClick={() => loadInitialData(true)}
                  disabled={refreshing}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                  <span>Actualizar</span>
                </button>
              )}
              
              {(step === 'menu' || step === 'cart') && cart.length > 0 && (
                <button
                  onClick={() => setStep(step === 'cart' ? 'menu' : 'cart')}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ShoppingCart size={18} />
                  <span>Carrito ({cart.length})</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-sm text-gray-600 mt-3">
            <span>Operaciones</span>
            {selectedTable && (
              <>
                <ChevronRight size={16} />
                <span>Mesa {selectedTable.table_number}</span>
              </>
            )}
            {(step === 'menu' || step === 'cart') && (
              <>
                <ChevronRight size={16} />
                <span>{currentOrder ? 'Editar Pedido' : 'Nuevo Pedido'}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* TABLES VIEW */}
        {step === 'tables' && (
          <div className="space-y-6">
            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Check className="text-green-600" size={20} />
                  <span className="text-green-700 font-medium">Disponibles</span>
                </div>
                <div className="text-3xl font-bold text-green-700">
                  {stats.availableTables}
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="text-blue-600" size={20} />
                  <span className="text-blue-700 font-medium">Ocupadas</span>
                </div>
                <div className="text-3xl font-bold text-blue-700">
                  {stats.occupiedTables}
                </div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Coffee className="text-purple-600" size={20} />
                  <span className="text-purple-700 font-medium">Pedidos Activos</span>
                </div>
                <div className="text-3xl font-bold text-purple-700">
                  {stats.totalActiveOrders}
                </div>
              </div>
              
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <div className="flex items-center space-x-2 mb-2">
                  <DollarSign className="text-orange-600" size={20} />
                  <span className="text-orange-700 font-medium">Ventas Pendientes</span>
                </div>
                <div className="text-3xl font-bold text-orange-700">
                  S/ {stats.totalPendingSales.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Tables grid */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Seleccione una mesa para gestionar pedidos
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {tables.map(table => {
                  const status = getTableStatus(table.id);
                  const summary = getTableSummary(table.id);
                  const duration = summary?.duration || '';
                  
                  return (
                    <div
                      key={table.id}
                      className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${getTableStatusColor(status, duration)}`}
                      onClick={() => handleTableSelect(table)}
                    >
                      {/* Table header */}
                      <div className="text-center mb-3">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white flex items-center justify-center shadow-sm">
                          {getTableStatusIcon(status, duration)}
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">
                          Mesa {table.table_number}
                        </h3>
                        <p className="text-xs text-gray-600">{table.zone?.name}</p>
                      </div>

                      {/* Table status */}
                      {status === 'available' ? (
                        <div className="text-center">
                          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Disponible
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-center">
                            <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white bg-opacity-80 mb-2">
                              {summary.orderCount} pedido{summary.orderCount > 1 ? 's' : ''}
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-700 space-y-1">
                            <div className="flex justify-between">
                              <span>Items:</span>
                              <span className="font-medium">{summary.totalItems}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total:</span>
                              <span className="font-medium">S/ {summary.totalAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Tiempo:</span>
                              <span className="font-medium">{duration}</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrderDetails(summary.orders);
                            }}
                            className="w-full text-xs bg-white bg-opacity-80 hover:bg-opacity-100 px-2 py-1 rounded-lg flex items-center justify-center space-x-1 transition-colors"
                          >
                            <Eye size={12} />
                            <span>Ver Detalle</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ORDERS VIEW */}
        {step === 'orders' && selectedTable && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Pedidos Activos - Mesa {selectedTable.table_number}
                </h2>
                <p className="text-gray-600">{selectedTable.zone?.name}</p>
              </div>
              <button
                onClick={handleCreateNewOrder}
                className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <Plus size={20} />
                <span>Nuevo Pedido</span>
              </button>
            </div>

            {/* Orders list */}
            {orders.length === 0 ? (
              <div className="text-center py-16">
                <Coffee className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay pedidos activos
                </h3>
                <p className="text-gray-600 mb-6">
                  Esta mesa no tiene pedidos pendientes
                </p>
                <button
                  onClick={handleCreateNewOrder}
                  className="inline-flex items-center space-x-2 text-green-600 hover:text-green-700 font-medium"
                >
                  <Plus size={20} />
                  <span>Crear el primer pedido</span>
                </button>
              </div>
            ) : (
              <div className="grid gap-6">
                {orders.map(order => (
                  <div key={order.id} className="bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow">
                    {/* Order header */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          Pedido #{order.id}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-2">
                          <span className="flex items-center space-x-1">
                            <Clock size={16} />
                            <span>{new Date(order.created_at).toLocaleString()}</span>
                          </span>
                          {order.waiter && (
                            <span>• Mesero: {order.waiter}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleEditOrder(order)}
                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <Edit3 size={16} />
                        <span>Editar</span>
                      </button>
                    </div>

                    {/* Order items */}
                    <div className="space-y-3 mb-4">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start py-3 border-b border-gray-100 last:border-b-0">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{item.recipe?.name}</h4>
                            {item.notes && (
                              <p className="text-sm text-gray-600 mt-1 italic">
                                Nota: {item.notes}
                              </p>
                            )}
                            {item.is_takeaway && (
                              <span className="inline-flex items-center space-x-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full mt-2">
                                <Package size={12} />
                                <span>Para llevar</span>
                              </span>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-bold text-lg">×{item.quantity}</div>
                            <div className="text-sm text-gray-600">S/ {item.total_price}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Order total */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                      <div className="text-gray-600">
                        {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          S/ {order.grand_total || order.total_amount}
                        </div>
                        <div className="text-sm text-orange-600 font-medium">
                          Pendiente de pago
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MENU VIEW */}
        {step === 'menu' && (
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Categories sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border shadow-sm p-6 sticky top-24">
                <h3 className="font-bold text-gray-900 mb-4 text-lg">Categorías</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedGroup(null)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${
                      !selectedGroup 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    Todos los platos ({recipes.length})
                  </button>
                  {groups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => setSelectedGroup(group.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium ${
                        selectedGroup === group.id 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recipes grid */}
            <div className="lg:col-span-3">
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredRecipes.map(recipe => (
                  <div key={recipe.id} className="bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-gray-900 flex-1 text-lg">{recipe.name}</h4>
                        <span className="font-bold text-green-600 ml-3 text-xl">S/ {recipe.base_price}</span>
                      </div>
                      
                      {recipe.group && (
                        <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full mb-3">
                          {recipe.group.name}
                        </span>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 flex items-center space-x-1">
                          <Clock size={16} />
                          <span>{recipe.preparation_time} min</span>
                        </span>
                        <button
                          onClick={() => addToCart(recipe)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredRecipes.length === 0 && (
                <div className="text-center py-16">
                  <Coffee className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">
                    No hay recetas disponibles
                  </h3>
                  <p className="text-gray-600">
                    {selectedGroup ? 'Esta categoría no tiene platos disponibles' : 'No hay platos disponibles en el menú'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CART VIEW */}
        {step === 'cart' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border">
              {/* Cart header */}
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  Carrito de Pedido
                </h2>
                <p className="text-gray-600">
                  Mesa {selectedTable?.table_number} - {selectedTable?.zone?.name}
                </p>
              </div>

              <div className="p-6">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Carrito vacío
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Agregue platos al carrito para crear el pedido
                    </p>
                    <button
                      onClick={() => setStep('menu')}
                      className="inline-flex items-center space-x-2 text-green-600 hover:text-green-700 font-medium"
                    >
                      <Plus size={20} />
                      <span>Agregar platos</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Cart items */}
                    <div className="space-y-4">
                      {cart.map((item, index) => (
                        <div key={index} className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 text-lg">{item.recipe.name}</h4>
                            
                            {/* Quantity controls */}
                            <div className="mt-3 flex items-center space-x-3">
                              <label className="text-sm font-medium text-gray-700">Cantidad:</label>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => updateCartItem(index, { 
                                    quantity: Math.max(1, item.quantity - 1) 
                                  })}
                                  className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="w-12 text-center font-medium">{item.quantity}</span>
                                <button
                                  onClick={() => updateCartItem(index, { 
                                    quantity: item.quantity + 1 
                                  })}
                                  className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Notes */}
                            <div className="mt-3">
                              <label className="text-sm font-medium text-gray-700">Notas especiales:</label>
                              <input
                                type="text"
                                value={item.notes}
                                onChange={(e) => updateCartItem(index, { notes: e.target.value })}
                                placeholder="Sin cebolla, extra picante..."
                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>

                            {/* Takeaway option */}
                            <div className="mt-3 flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`takeaway-${index}`}
                                checked={item.is_takeaway}
                                onChange={(e) => updateCartItem(index, { is_takeaway: e.target.checked })}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <label htmlFor={`takeaway-${index}`} className="text-sm font-medium text-gray-700">
                                Para llevar
                                {item.is_takeaway && item.recipe.container && (
                                  <span className="ml-1 text-xs text-blue-600 font-normal">
                                    (+ envase incluido)
                                  </span>
                                )}
                              </label>
                            </div>
                          </div>

                          {/* Item price and actions */}
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900">
                              S/ {item.total_price.toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-600 mb-3">
                              S/ {item.unit_price.toFixed(2)} c/u
                            </div>
                            <button
                              onClick={() => removeFromCart(index)}
                              className="flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              <X size={16} />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Cart summary */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <div className="space-y-3 text-right">
                        <div className="flex justify-between text-lg">
                          <span className="font-medium">Subtotal comida:</span>
                          <span className="font-bold">S/ {getCartTotal().toFixed(2)}</span>
                        </div>
                        
                        {getContainerTotal() > 0 && (
                          <div className="flex justify-between text-lg">
                            <span className="font-medium">Envases:</span>
                            <span className="font-bold">S/ {getContainerTotal().toFixed(2)}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between text-2xl font-bold border-t border-gray-300 pt-3">
                          <span>Total:</span>
                          <span className="text-green-600">S/ {getGrandTotal().toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex space-x-4 mt-6">
                        <button
                          onClick={() => setStep('menu')}
                          className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                          Continuar Comprando
                        </button>
                        <button
                          onClick={saveOrder}
                          disabled={loading}
                          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
                        >
                          {loading ? 'Guardando...' : (currentOrder ? 'Actualizar Pedido' : 'Crear Pedido')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-96 overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">
                  Detalles - Mesa {selectedOrderDetails[0]?.table?.table_number}
                </h3>
                <button
                  onClick={() => setSelectedOrderDetails(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {selectedOrderDetails.map(order => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-gray-900">Pedido #{order.id}</h4>
                      <div className="text-sm text-gray-600 flex items-center space-x-2 mt-1">
                        <Clock size={14} />
                        <span>{new Date(order.created_at).toLocaleString()}</span>
                        {order.waiter && <span>• {order.waiter}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">S/ {order.grand_total || order.total_amount}</div>
                      <div className="text-sm text-gray-600">{order.items?.length || 0} items</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm py-2 border-b border-gray-100 last:border-b-0">
                        <div>
                          <span className="font-medium">{item.recipe?.name}</span>
                          {item.notes && (
                            <div className="text-xs text-gray-600 mt-1">Nota: {item.notes}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-medium">×{item.quantity}</div>
                          <div className="text-xs text-gray-600">S/ {item.total_price}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantOperations;