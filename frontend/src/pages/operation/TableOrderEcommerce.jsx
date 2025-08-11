import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';

const TableOrderEcommerce = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Estados principales
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]); 
  const [recipes, setRecipes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('tables'); // 'tables', 'orders', 'menu'

  // Estados carrito
  const [cart, setCart] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Cargar datos iniciales
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [tablesRes, recipesRes, groupsRes, allOrdersRes] = await Promise.all([
        api.get('/tables/'),
        api.get('/recipes/?is_active=true&is_available=true'),
        api.get('/groups/'),
        api.get('/orders/?status=CREATED')
      ]);
      
      setTables(tablesRes.data || []);
      setRecipes(recipesRes.data || []);
      setGroups(groupsRes.data || []);
      setAllOrders(allOrdersRes.data || []);
    } catch (error) {
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(() => loadInitialData(), 30000);
    return () => clearInterval(interval);
  }, [loadInitialData]);

  // Cargar órdenes de mesa específica
  const loadTableOrders = async (tableId) => {
    try {
      const response = await api.get(`/tables/${tableId}/active_orders/`);
      setOrders(response.data || []);
    } catch (error) {
      showToast('Error al cargar pedidos', 'error');
    }
  };

  // Obtener órdenes de una mesa
  const getTableOrders = useCallback((tableId) => {
    return allOrders.filter(order => {
      const orderTableId = 
        (typeof order.table === 'object' && order.table?.id) ||
        (typeof order.table === 'number' && order.table) ||
        order.table_id;
      return orderTableId === tableId;
    });
  }, [allOrders]);

  // Estado de mesa
  const getTableStatus = useCallback((tableId) => {
    const orders = getTableOrders(tableId);
    return orders.length > 0 ? 'occupied' : 'available';
  }, [getTableOrders]);

  // Resumen de mesa
  const getTableSummary = useCallback((tableId) => {
    const orders = getTableOrders(tableId);
    if (orders.length === 0) return null;
    
    const totalAmount = orders.reduce((sum, order) => 
      sum + parseFloat(order.total_amount || 0), 0
    );
    const totalItems = orders.reduce((sum, order) => 
      sum + (order.items?.length || 0), 0
    );
    
    return { orderCount: orders.length, totalAmount, totalItems };
  }, [getTableOrders]);

  // Seleccionar mesa
  const handleTableSelect = async (table) => {
    setSelectedTable(table);
    await loadTableOrders(table.id);
    setStep('orders');
  };

  // Crear nuevo pedido
  const handleCreateNewOrder = () => {
    setCart([]);
    setCurrentOrder(null);
    setStep('menu');
  };

  // Editar pedido existente
  const handleEditOrder = (order) => {
    setCurrentOrder(order);
    // CORRECCIÓN: No pre-llenar carrito con items existentes
    // El carrito debe empezar vacío para agregar NUEVOS items únicamente
    setCart([]);
    setStep('menu');
  };

  // Agregar al carrito
  const addToCart = (recipe) => {
    const existingIndex = cart.findIndex(item => item.recipe.id === recipe.id);
    
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].total_price = newCart[existingIndex].unit_price * newCart[existingIndex].quantity;
      setCart(newCart);
    } else {
      setCart([...cart, {
        recipe,
        quantity: 1,
        notes: '',
        is_takeaway: false,
        unit_price: parseFloat(recipe.base_price),
        total_price: parseFloat(recipe.base_price)
      }]);
    }
  };

  // Actualizar item del carrito
  const updateCartItem = (index, field, value) => {
    const newCart = [...cart];
    newCart[index][field] = value;
    
    if (field === 'quantity') {
      newCart[index].total_price = newCart[index].unit_price * value;
    }
    
    setCart(newCart);
  };

  // Eliminar del carrito
  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Total del carrito
  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.total_price, 0);
  };

  // Guardar pedido
  const saveOrder = async () => {
    if (cart.length === 0) {
      showToast('Agregue items al pedido', 'error');
      return;
    }

    try {
      setSaving(true);
      
      const orderData = {
        items_data: cart.map(item => ({
          recipe: item.recipe.id,
          quantity: item.quantity,
          notes: item.notes || '',
          is_takeaway: item.is_takeaway || false,
          has_taper: item.is_takeaway || false
        }))
      };
      
      if (currentOrder) {
        // Para órdenes existentes, agregar items uno por uno usando add_item endpoint
        for (const item of cart) {
          const itemData = {
            recipe: item.recipe.id,
            quantity: item.quantity,
            notes: item.notes || '',
            is_takeaway: item.is_takeaway || false,
            has_taper: item.is_takeaway || false
          };
          await api.post(`/orders/${currentOrder.id}/add_item/`, itemData);
        }
        showToast('Items agregados al pedido', 'success');
      } else {
        const newOrderData = {
          table: selectedTable.id,
          waiter: user?.username || 'Sistema',
          items: orderData.items_data
        };
        const response = await api.post('/orders/', newOrderData);
        // Agregar nuevo pedido al estado local
        const newOrder = response.data;
        setOrders([...orders, newOrder]);
        setAllOrders([...allOrders, newOrder]);
        showToast('Pedido creado', 'success');
      }

      await Promise.all([
        loadTableOrders(selectedTable.id),
        loadInitialData()
      ]);
      
      setCart([]);
      setCurrentOrder(null);
      setStep('orders');
    } catch (error) {
      // Manejo mejorado de errores del backend
      if (error.response?.status === 400) {
        const errorMsg = error.response.data?.error || 
                        error.response.data?.items?.[0] ||
                        error.response.data?.detail ||
                        'Error de validación';
        showToast(errorMsg, 'error');
      } else if (error.response?.status === 404) {
        showToast('Pedido no encontrado', 'error');
      } else if (error.response?.status === 422) {
        showToast('Datos inválidos en el pedido', 'error');
      } else {
        showToast('Error al guardar pedido', 'error');
      }
      console.error('Error saving order:', error);
    } finally {
      setSaving(false);
    }
  };

  // Filtrar recetas
  const filteredRecipes = useMemo(() => {
    let filtered = recipes;
    
    if (selectedGroup) {
      filtered = filtered.filter(r => r.group?.id === selectedGroup);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [recipes, selectedGroup, searchTerm]);

  // Agrupar mesas por zona
  const tablesByZone = useMemo(() => {
    return tables.reduce((acc, table) => {
      const zoneName = table.zone_name || table.zone?.name || 'Sin Zona';
      if (!acc[zoneName]) acc[zoneName] = [];
      acc[zoneName].push(table);
      return acc;
    }, {});
  }, [tables]);

  if (loading && step === 'tables') {
    return <div className="flex justify-center items-center h-screen">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header simple */}
      <div className="bg-white shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">
            {step === 'tables' && 'Mesas'}
            {step === 'orders' && `Mesa ${selectedTable?.table_number}`}
            {step === 'menu' && 'Menú'}
          </h1>
          
          {step !== 'tables' && (
            <button
              onClick={() => setStep(step === 'menu' ? 'orders' : 'tables')}
              className="text-blue-600 hover:text-blue-700"
            >
              Atrás
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* VISTA MESAS */}
        {step === 'tables' && (
          <div className="space-y-4">
            {Object.entries(tablesByZone).map(([zoneName, zoneTables]) => (
              <div key={zoneName}>
                <h2 className="text-sm font-semibold text-gray-700 mb-2">{zoneName}</h2>
                <div className="grid grid-cols-3 gap-2">
                  {zoneTables.map(table => {
                    const status = getTableStatus(table.id);
                    const summary = getTableSummary(table.id);
                    
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleTableSelect(table)}
                        className={`p-3 rounded border text-center ${
                          status === 'available' 
                            ? 'bg-white border-gray-300 hover:bg-gray-50' 
                            : 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                        }`}
                      >
                        <div className="font-bold">{table.table_number}</div>
                        {status === 'occupied' && summary && (
                          <div className="text-xs text-gray-600 mt-1">
                            {summary.orderCount} pedido{summary.orderCount > 1 ? 's' : ''}
                            <br />
                            S/ {summary.totalAmount.toFixed(2)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VISTA ÓRDENES */}
        {step === 'orders' && selectedTable && (
          <div className="space-y-4">
            <button
              onClick={handleCreateNewOrder}
              className="w-full bg-green-600 text-white p-3 rounded hover:bg-green-700"
            >
              Nuevo Pedido
            </button>

            {orders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay pedidos activos
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map(order => (
                  <div key={order.id} className="bg-white border rounded p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold">#{order.id}</span>
                        <span className="ml-2 text-sm text-gray-600">
                          {order.items?.length || 0} items
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">
                          S/ {parseFloat(order.grand_total || order.total_amount || 0).toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleEditOrder(order)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VISTA MENÚ */}
        {step === 'menu' && (
          <div>
            {/* Buscador */}
            <input
              type="text"
              placeholder="Buscar plato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border rounded mb-4"
            />

            {/* Filtros de grupo */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedGroup(null)}
                className={`px-3 py-1 rounded whitespace-nowrap ${
                  !selectedGroup ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                Todos
              </button>
              {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(group.id)}
                  className={`px-3 py-1 rounded whitespace-nowrap ${
                    selectedGroup === group.id ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}
                >
                  {group.name}
                </button>
              ))}
            </div>

            {/* Lista de recetas */}
            <div className="space-y-2 mb-20">
              {filteredRecipes.map(recipe => (
                <div key={recipe.id} className="bg-white border rounded p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{recipe.name}</div>
                      <div className="text-sm text-gray-600">
                        S/ {recipe.base_price}
                      </div>
                    </div>
                    <button
                      onClick={() => addToCart(recipe)}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Carrito flotante */}
            {cart.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
                <div className="max-h-40 overflow-y-auto mb-3">
                  {cart.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-1">
                      <div className="flex-1">
                        <span className="text-sm">{item.recipe.name}</span>
                        <span className="text-xs text-gray-600 ml-2">x{item.quantity}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          S/ {item.total_price.toFixed(2)}
                        </span>
                        <button
                          onClick={() => updateCartItem(index, 'quantity', Math.max(1, item.quantity - 1))}
                          className="w-6 h-6 bg-gray-200 rounded"
                        >
                          -
                        </button>
                        <button
                          onClick={() => updateCartItem(index, 'quantity', item.quantity + 1)}
                          className="w-6 h-6 bg-gray-200 rounded"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(index)}
                          className="text-red-600 ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-lg">S/ {getCartTotal().toFixed(2)}</span>
                  </div>
                  <button
                    onClick={saveOrder}
                    disabled={saving || cart.length === 0}
                    className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Guardando...' : (currentOrder ? 'Actualizar Pedido' : 'Crear Pedido')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TableOrderEcommerce;