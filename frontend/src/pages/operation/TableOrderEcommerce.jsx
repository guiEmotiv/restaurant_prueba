import { useState, useEffect } from 'react';
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
  ChevronRight
} from 'lucide-react';

const TableOrderEcommerce = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Estados principales
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [orders, setOrders] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [containers, setContainers] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('tables'); // 'tables', 'orders', 'menu', 'cart'

  // Estados del carrito temporal
  const [cart, setCart] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [tablesRes, recipesRes, containersRes, groupsRes] = await Promise.all([
        api.get('/config/tables/'),
        api.get('/inventory/recipes/'),
        api.get('/config/containers/'),
        api.get('/inventory/groups/')
      ]);
      
      setTables(tablesRes.data);
      setRecipes(recipesRes.data.filter(r => r.is_active && r.is_available));
      setContainers(containersRes.data.filter(c => c.is_active));
      setGroups(groupsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadTableOrders = async (tableId) => {
    try {
      const response = await api.get(`/operation/orders/?table=${tableId}&status=CREATED`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
      showToast('Error al cargar pedidos', 'error');
    }
  };

  const handleTableSelect = async (table) => {
    setSelectedTable(table);
    await loadTableOrders(table.id);
    setStep('orders');
  };

  const handleCreateNewOrder = () => {
    setCurrentOrder(null);
    setCart([]);
    setStep('menu');
  };

  const handleEditOrder = (order) => {
    setCurrentOrder(order);
    // Cargar items existentes al carrito para edición
    const cartItems = order.items.map(item => ({
      recipe: item.recipe,
      quantity: item.quantity,
      notes: item.notes || '',
      is_takeaway: item.is_takeaway,
      unit_price: item.unit_price,
      total_price: item.total_price
    }));
    setCart(cartItems);
    setStep('menu');
  };

  const addToCart = (recipe) => {
    const existingItemIndex = cart.findIndex(item => 
      item.recipe.id === recipe.id && !item.notes
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
        unit_price: recipe.base_price,
        total_price: recipe.base_price
      };
      setCart([...cart, newItem]);
    }
    showToast(`${recipe.name} agregado`, 'success');
  };

  const updateCartItem = (index, updates) => {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], ...updates };
    
    // Recalcular precio total si cambia cantidad
    if (updates.quantity) {
      newCart[index].total_price = newCart[index].unit_price * updates.quantity;
    }
    
    setCart(newCart);
  };

  const removeFromCart = (index) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
  };

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

  const saveOrder = async () => {
    if (cart.length === 0) {
      showToast('Agregue items al pedido', 'error');
      return;
    }

    try {
      setLoading(true);
      
      let orderData;
      if (currentOrder) {
        // Editar orden existente
        orderData = {
          items: cart.map(item => ({
            recipe: item.recipe.id,
            quantity: item.quantity,
            notes: item.notes,
            is_takeaway: item.is_takeaway
          }))
        };
        await api.put(`/operation/orders/${currentOrder.id}/`, orderData);
        showToast('Pedido actualizado', 'success');
      } else {
        // Crear nueva orden
        orderData = {
          table: selectedTable.id,
          waiter: user?.username || '',
          items: cart.map(item => ({
            recipe: item.recipe.id,
            quantity: item.quantity,
            notes: item.notes,
            is_takeaway: item.is_takeaway
          })),
          // Agregar envases para items para llevar
          container_sales: cart
            .filter(item => item.is_takeaway && item.recipe.container)
            .map(item => ({
              container: item.recipe.container,
              quantity: item.quantity
            }))
        };
        await api.post('/operation/orders/', orderData);
        showToast('Pedido creado', 'success');
      }

      // Recargar órdenes y volver a la vista de órdenes
      await loadTableOrders(selectedTable.id);
      setCart([]);
      setCurrentOrder(null);
      setStep('orders');
    } catch (error) {
      console.error('Error saving order:', error);
      showToast('Error al guardar pedido', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getTableStatus = (tableId) => {
    const tableOrders = orders.filter(order => order.table.id === tableId && order.status === 'CREATED');
    return tableOrders.length > 0 ? 'occupied' : 'available';
  };

  const filteredRecipes = selectedGroup 
    ? recipes.filter(r => r.group?.id === selectedGroup)
    : recipes;

  if (loading && step === 'tables') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mesas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
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
                  className="text-gray-600 hover:text-gray-800"
                >
                  ←
                </button>
              )}
              <h1 className="text-2xl font-bold text-gray-900">
                {step === 'tables' && 'Gestión de Mesas'}
                {step === 'orders' && `Mesa ${selectedTable?.table_number}`}
                {(step === 'menu' || step === 'cart') && 'Crear Pedido'}
              </h1>
            </div>
            
            {(step === 'menu' || step === 'cart') && cart.length > 0 && (
              <button
                onClick={() => setStep(step === 'cart' ? 'menu' : 'cart')}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <ShoppingCart size={20} />
                <span>Carrito ({cart.length})</span>
              </button>
            )}
          </div>
          
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
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
        {/* VISTA DE MESAS */}
        {step === 'tables' && (
          <div>
            <div className="mb-6">
              <p className="text-gray-600">Seleccione una mesa para gestionar sus pedidos</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {tables.map(table => {
                const status = getTableStatus(table.id);
                return (
                  <button
                    key={table.id}
                    onClick={() => handleTableSelect(table)}
                    className={`p-6 rounded-xl border-2 text-center transition-all hover:shadow-md ${
                      status === 'available' 
                        ? 'border-green-200 bg-green-50 hover:border-green-300' 
                        : 'border-orange-200 bg-orange-50 hover:border-orange-300'
                    }`}
                  >
                    <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
                      status === 'available' ? 'bg-green-100' : 'bg-orange-100'
                    }`}>
                      {status === 'available' ? (
                        <Check className="text-green-600" size={24} />
                      ) : (
                        <Users className="text-orange-600" size={24} />
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900">Mesa {table.table_number}</h3>
                    <p className="text-sm text-gray-600">{table.zone.name}</p>
                    <div className={`mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                      status === 'available' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {status === 'available' ? 'Disponible' : 'Ocupada'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* VISTA DE PEDIDOS DE MESA */}
        {step === 'orders' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Pedidos Activos</h2>
                <p className="text-gray-600">Mesa {selectedTable.table_number} - {selectedTable.zone.name}</p>
              </div>
              <button
                onClick={handleCreateNewOrder}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Plus size={20} />
                <span>Nuevo Pedido</span>
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-12">
                <Coffee className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600">No hay pedidos activos en esta mesa</p>
                <button
                  onClick={handleCreateNewOrder}
                  className="mt-4 text-blue-600 hover:text-blue-700"
                >
                  Crear el primer pedido
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {orders.map(order => (
                  <div key={order.id} className="bg-white rounded-lg border shadow-sm p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">Pedido #{order.id}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <span className="flex items-center space-x-1">
                            <Clock size={16} />
                            <span>{new Date(order.created_at).toLocaleTimeString()}</span>
                          </span>
                          {order.waiter && (
                            <span>Mesero: {order.waiter}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleEditOrder(order)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Editar
                      </button>
                    </div>

                    <div className="space-y-2 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                          <div className="flex-1">
                            <span className="font-medium">{item.recipe.name}</span>
                            {item.notes && (
                              <p className="text-sm text-gray-600 mt-1">Nota: {item.notes}</p>
                            )}
                            {item.is_takeaway && (
                              <span className="inline-flex items-center space-x-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full mt-1">
                                <Package size={12} />
                                <span>Para llevar</span>
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-medium">x{item.quantity}</div>
                            <div className="text-sm text-gray-600">S/ {item.total_price}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">S/ {order.grand_total || order.total_amount}</div>
                        <div className="text-sm text-gray-600">
                          {order.status === 'CREATED' ? 'Pendiente de pago' : 'Pagado'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VISTA DE MENÚ */}
        {step === 'menu' && (
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Filtro por grupos */}
            <div className="lg:col-span-1">
              <h3 className="font-semibold text-gray-900 mb-4">Categorías</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedGroup(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    !selectedGroup ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                  }`}
                >
                  Todos
                </button>
                {groups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(group.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedGroup === group.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                    }`}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de recetas */}
            <div className="lg:col-span-3">
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredRecipes.map(recipe => (
                  <div key={recipe.id} className="bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-900 flex-1">{recipe.name}</h4>
                        <span className="font-bold text-blue-600 ml-2">S/ {recipe.base_price}</span>
                      </div>
                      {recipe.group && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          {recipe.group.name}
                        </span>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {recipe.preparation_time} min
                        </span>
                        <button
                          onClick={() => addToCart(recipe)}
                          className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 text-sm"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VISTA DE CARRITO */}
        {step === 'cart' && (
          <div>
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Carrito de Pedido</h2>
                <p className="text-gray-600">Mesa {selectedTable.table_number}</p>
              </div>

              <div className="p-6">
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-600">No hay items en el carrito</p>
                    <button
                      onClick={() => setStep('menu')}
                      className="mt-4 text-blue-600 hover:text-blue-700"
                    >
                      Agregar items al pedido
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item, index) => (
                      <div key={index} className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{item.recipe.name}</h4>
                          
                          {/* Cantidad */}
                          <div className="mt-2 flex items-center space-x-2">
                            <label className="text-sm text-gray-600">Cantidad:</label>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => updateCartItem(index, { 
                                  quantity: Math.max(1, item.quantity - 1) 
                                })}
                                className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                              >
                                -
                              </button>
                              <span className="w-8 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateCartItem(index, { 
                                  quantity: item.quantity + 1 
                                })}
                                className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Notas */}
                          <div className="mt-2">
                            <label className="text-sm text-gray-600">Notas especiales:</label>
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) => updateCartItem(index, { notes: e.target.value })}
                              placeholder="Sin cebolla, extra picante..."
                              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>

                          {/* Para llevar */}
                          <div className="mt-2 flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`takeaway-${index}`}
                              checked={item.is_takeaway}
                              onChange={(e) => updateCartItem(index, { is_takeaway: e.target.checked })}
                              className="rounded border-gray-300"
                            />
                            <label htmlFor={`takeaway-${index}`} className="text-sm text-gray-700">
                              Para llevar
                              {item.is_takeaway && item.recipe.container && (
                                <span className="ml-1 text-xs text-gray-600">
                                  (+ envase)
                                </span>
                              )}
                            </label>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-lg">S/ {item.total_price}</div>
                          <div className="text-sm text-gray-600">S/ {item.unit_price} c/u</div>
                          <button
                            onClick={() => removeFromCart(index)}
                            className="mt-2 text-red-600 hover:text-red-700 text-sm"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {cart.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="space-y-2 text-right">
                      <div className="flex justify-between">
                        <span>Subtotal comida:</span>
                        <span className="font-medium">S/ {getCartTotal().toFixed(2)}</span>
                      </div>
                      {getContainerTotal() > 0 && (
                        <div className="flex justify-between">
                          <span>Envases:</span>
                          <span className="font-medium">S/ {getContainerTotal().toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xl font-bold border-t border-gray-200 pt-2">
                        <span>Total:</span>
                        <span>S/ {(getCartTotal() + getContainerTotal()).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mt-6 flex space-x-4">
                      <button
                        onClick={() => setStep('menu')}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Continuar Comprando
                      </button>
                      <button
                        onClick={saveOrder}
                        disabled={loading}
                        className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {loading ? 'Guardando...' : currentOrder ? 'Actualizar Pedido' : 'Crear Pedido'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableOrderEcommerce;