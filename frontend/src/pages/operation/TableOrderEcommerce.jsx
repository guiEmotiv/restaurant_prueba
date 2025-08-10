import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Clock, ShoppingCart, Plus, Minus, Package, StickyNote, CreditCard } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const TableOrderEcommerce = () => {
  const [currentStep, setCurrentStep] = useState('tables'); // 'tables', 'menu', 'payment'
  const [tables, setTables] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [containers, setContainers] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [tablesData, recipesData, containersData] = await Promise.all([
        apiService.tables.getAll(),
        apiService.recipes.getAll({ is_active: true, is_available: true }),
        apiService.containers.getAll({ is_active: true })
      ]);
      
      setTables(Array.isArray(tablesData) ? tablesData : []);
      setRecipes(Array.isArray(recipesData) ? recipesData : []);
      setContainers(Array.isArray(containersData) ? containersData : []);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadTableOrders = async (tableId) => {
    try {
      const orders = await apiService.tables.getActiveOrders(tableId);
      return Array.isArray(orders) ? orders.filter(order => order.status === 'CREATED') : [];
    } catch (error) {
      console.error('Error loading table orders:', error);
      return [];
    }
  };

  const getTableStatus = async (table) => {
    const orders = await loadTableOrders(table.id);
    return orders.length > 0 ? 'occupied' : 'available';
  };

  const handleTableSelect = async (table) => {
    setSelectedTable(table);
    const orders = await loadTableOrders(table.id);
    
    if (orders.length > 0) {
      // Mesa ocupada - mostrar opción de continuar orden existente
      setCurrentOrder(orders[0]);
      // Cargar items existentes al carrito
      const existingItems = orders[0].items || [];
      const cartItems = existingItems.map(item => ({
        recipe: item.recipe,
        quantity: item.quantity,
        notes: item.notes || '',
        is_takeaway: item.is_takeaway || false,
        has_taper: item.has_taper || false,
        container: item.container || null
      }));
      setCart(cartItems);
    } else {
      // Mesa disponible - nueva orden
      setCurrentOrder(null);
      setCart([]);
    }
    
    setCurrentStep('menu');
  };

  const addToCart = (recipe) => {
    const existingItem = cart.find(item => 
      item.recipe.id === recipe.id && 
      !item.is_takeaway && 
      item.notes === ''
    );

    if (existingItem) {
      setCart(cart.map(item => 
        item === existingItem 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        recipe,
        quantity: 1,
        notes: '',
        is_takeaway: false,
        has_taper: false,
        container: null
      }]);
    }
  };

  const updateCartItem = (index, updates) => {
    setCart(cart.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const getCartTotal = () => {
    const itemsTotal = cart.reduce((sum, item) => sum + (item.recipe.base_price * item.quantity), 0);
    const containersTotal = cart.reduce((sum, item) => {
      if (item.has_taper && item.container) {
        return sum + (item.container.price * item.quantity);
      }
      return sum;
    }, 0);
    return itemsTotal + containersTotal;
  };

  const createOrder = async () => {
    if (!selectedTable || cart.length === 0) return;

    try {
      setLoading(true);
      
      // Crear orden
      const orderData = {
        table: selectedTable.id,
        waiter: 'Sistema', // Aquí podrías usar el usuario actual
      };

      const order = currentOrder || await apiService.orders.create(orderData);

      // Agregar items al pedido
      for (const cartItem of cart) {
        const itemData = {
          recipe: cartItem.recipe.id,
          quantity: cartItem.quantity,
          notes: cartItem.notes,
          is_takeaway: cartItem.is_takeaway,
          has_taper: cartItem.has_taper
        };

        await apiService.orders.addItem(order.id, itemData);

        // Si es para llevar y tiene envase, crear venta de envase
        if (cartItem.has_taper && cartItem.container) {
          await apiService.containerSales.create({
            order: order.id,
            container: cartItem.container.id,
            quantity: cartItem.quantity
          });
        }
      }

      showSuccess('Pedido creado exitosamente');
      setCart([]);
      setCurrentStep('payment');
      
      // Recargar orden para obtener datos actualizados
      const updatedOrder = await apiService.orders.getById(order.id);
      setCurrentOrder(updatedOrder);

    } catch (error) {
      console.error('Error creating order:', error);
      showError('Error al crear el pedido');
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async () => {
    if (!currentOrder) return;

    try {
      setLoading(true);

      // Crear pago por el total de la orden
      const paymentData = {
        order: currentOrder.id,
        payment_method: 'CASH', // Por defecto, luego se puede hacer más dinámico
        amount: currentOrder.total_amount || getCartTotal(),
        notes: 'Pago procesado desde vista ecommerce'
      };

      await apiService.payments.create(paymentData);
      
      showSuccess('Pago procesado exitosamente');
      
      // Volver a la selección de mesas
      setCurrentStep('tables');
      setSelectedTable(null);
      setCurrentOrder(null);
      setCart([]);
      
      // Recargar datos
      await loadInitialData();

    } catch (error) {
      console.error('Error processing payment:', error);
      showError('Error al procesar el pago');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    switch (currentStep) {
      case 'menu':
        setCurrentStep('tables');
        setSelectedTable(null);
        setCurrentOrder(null);
        setCart([]);
        break;
      case 'payment':
        setCurrentStep('menu');
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {currentStep !== 'tables' && (
                <button
                  onClick={goBack}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
              )}
              <h1 className="text-xl font-bold text-gray-900">
                {currentStep === 'tables' && 'Seleccionar Mesa'}
                {currentStep === 'menu' && `Mesa ${selectedTable?.table_number}`}
                {currentStep === 'payment' && 'Procesar Pago'}
              </h1>
            </div>
            
            {currentStep === 'menu' && (
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-600">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {currentStep === 'tables' && (
          <TableSelection 
            tables={tables}
            onTableSelect={handleTableSelect}
            getTableStatus={getTableStatus}
          />
        )}

        {currentStep === 'menu' && (
          <MenuSelection
            recipes={recipes}
            containers={containers}
            cart={cart}
            onAddToCart={addToCart}
            onUpdateCart={updateCartItem}
            onRemoveFromCart={removeFromCart}
            onCreateOrder={createOrder}
            getCartTotal={getCartTotal}
            loading={loading}
          />
        )}

        {currentStep === 'payment' && (
          <PaymentFlow
            order={currentOrder}
            onProcessPayment={processPayment}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

const TableSelection = ({ tables, onTableSelect, getTableStatus }) => {
  const [tableStatuses, setTableStatuses] = useState({});

  useEffect(() => {
    const loadStatuses = async () => {
      const statuses = {};
      for (const table of tables) {
        statuses[table.id] = await getTableStatus(table);
      }
      setTableStatuses(statuses);
    };
    
    if (tables.length > 0) {
      loadStatuses();
    }
  }, [tables]);

  // Agrupar mesas por zona
  const tablesByZone = tables.reduce((acc, table) => {
    const zoneName = table.zone_name || 'Sin Zona';
    if (!acc[zoneName]) acc[zoneName] = [];
    acc[zoneName].push(table);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(tablesByZone).map(([zoneName, zoneTables]) => (
        <div key={zoneName} className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            {zoneName}
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {zoneTables.map(table => {
              const status = tableStatuses[table.id] || 'loading';
              const isOccupied = status === 'occupied';
              
              return (
                <button
                  key={table.id}
                  onClick={() => onTableSelect(table)}
                  className={`
                    p-6 rounded-lg border-2 transition-all duration-200 hover:scale-105 active:scale-95
                    ${isOccupied 
                      ? 'bg-red-50 border-red-200 hover:border-red-300' 
                      : 'bg-green-50 border-green-200 hover:border-green-300'
                    }
                  `}
                >
                  <div className="text-center space-y-2">
                    <Users className={`h-8 w-8 mx-auto ${isOccupied ? 'text-red-600' : 'text-green-600'}`} />
                    <div className="font-bold text-lg text-gray-900">
                      {table.table_number}
                    </div>
                    <div className={`text-sm font-medium ${isOccupied ? 'text-red-700' : 'text-green-700'}`}>
                      {status === 'loading' ? 'Cargando...' : (isOccupied ? 'Ocupada' : 'Disponible')}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const MenuSelection = ({ 
  recipes, 
  containers, 
  cart, 
  onAddToCart, 
  onUpdateCart, 
  onRemoveFromCart, 
  onCreateOrder,
  getCartTotal,
  loading 
}) => {
  // Agrupar recetas por grupo
  const recipesByGroup = recipes.reduce((acc, recipe) => {
    const groupName = recipe.group_name || 'Sin Grupo';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(recipe);
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Menú */}
      <div className="lg:col-span-2 space-y-6">
        {Object.entries(recipesByGroup).map(([groupName, groupRecipes]) => (
          <div key={groupName} className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
              {groupName}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {groupRecipes.map(recipe => (
                <div key={recipe.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-gray-900">{recipe.name}</h3>
                      <span className="text-lg font-bold text-blue-600">
                        S/ {recipe.base_price}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>{recipe.preparation_time} min</span>
                    </div>
                    
                    <button
                      onClick={() => onAddToCart(recipe)}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Carrito */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 sticky top-4">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Carrito ({cart.reduce((sum, item) => sum + item.quantity, 0)})
            </h2>
          </div>
          
          <div className="p-4 space-y-4">
            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No hay items en el carrito
              </p>
            ) : (
              <>
                {cart.map((item, index) => (
                  <CartItem
                    key={index}
                    item={item}
                    index={index}
                    containers={containers}
                    onUpdate={onUpdateCart}
                    onRemove={onRemoveFromCart}
                  />
                ))}
                
                <div className="border-t pt-4 space-y-4">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total:</span>
                    <span>S/ {getCartTotal().toFixed(2)}</span>
                  </div>
                  
                  <button
                    onClick={onCreateOrder}
                    disabled={loading || cart.length === 0}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                  >
                    {loading ? 'Procesando...' : 'Crear Pedido'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CartItem = ({ item, index, containers, onUpdate, onRemove }) => {
  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-3">
      <div className="flex justify-between items-start">
        <h4 className="font-medium text-gray-900">{item.recipe.name}</h4>
        <button
          onClick={() => onRemove(index)}
          className="text-red-600 hover:text-red-700"
        >
          ×
        </button>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdate(index, { quantity: Math.max(1, item.quantity - 1) })}
            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="font-medium">{item.quantity}</span>
          <button
            onClick={() => onUpdate(index, { quantity: item.quantity + 1 })}
            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <span className="font-semibold">S/ {(item.recipe.base_price * item.quantity).toFixed(2)}</span>
      </div>

      {/* Notas */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-gray-500" />
          <label className="text-sm font-medium text-gray-700">Notas:</label>
        </div>
        <textarea
          value={item.notes}
          onChange={(e) => onUpdate(index, { notes: e.target.value })}
          placeholder="Agregar notas especiales..."
          className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={2}
        />
      </div>

      {/* Para llevar */}
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.is_takeaway}
            onChange={(e) => onUpdate(index, { 
              is_takeaway: e.target.checked,
              has_taper: e.target.checked ? item.has_taper : false 
            })}
            className="rounded"
          />
          <Package className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-medium">Para llevar</span>
        </label>

        {item.is_takeaway && (
          <div className="ml-6 space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.has_taper}
                onChange={(e) => onUpdate(index, { has_taper: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Con envase</span>
            </label>

            {item.has_taper && (
              <select
                value={item.container?.id || ''}
                onChange={(e) => {
                  const container = containers.find(c => c.id === parseInt(e.target.value));
                  onUpdate(index, { container });
                }}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seleccionar envase</option>
                {containers.map(container => (
                  <option key={container.id} value={container.id}>
                    {container.name} - S/ {container.price}
                  </option>
                ))}
              </select>
            )}

            {item.has_taper && item.container && (
              <div className="text-xs text-gray-600">
                + S/ {(item.container.price * item.quantity).toFixed(2)} por envase
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const PaymentFlow = ({ order, onProcessPayment, loading }) => {
  if (!order) return null;

  const allItemsServed = order.items?.every(item => item.status === 'SERVED') || false;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Resumen del Pedido #{order.id}
        </h2>

        <div className="space-y-4">
          <div className="border-b pb-4">
            <h3 className="font-semibold text-gray-900 mb-2">Items:</h3>
            {order.items?.map(item => (
              <div key={item.id} className="flex justify-between items-center py-2">
                <div>
                  <span className="font-medium">{item.recipe_name}</span>
                  <span className="text-gray-600"> x{item.quantity}</span>
                  {item.status === 'SERVED' && (
                    <span className="ml-2 text-green-600 text-sm">✓ Servido</span>
                  )}
                  {item.status === 'CREATED' && (
                    <span className="ml-2 text-orange-600 text-sm">⏱ En cocina</span>
                  )}
                </div>
                <span>S/ {item.total_price}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-xl font-bold">
            <span>Total:</span>
            <span>S/ {order.total_amount}</span>
          </div>

          {!allItemsServed && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                ⏱ Algunos items aún están en preparación. El pago estará disponible cuando todos los items sean servidos.
              </p>
            </div>
          )}

          {allItemsServed && (
            <button
              onClick={onProcessPayment}
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center gap-2"
            >
              <CreditCard className="h-5 w-5" />
              {loading ? 'Procesando pago...' : 'Procesar Pago'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableOrderEcommerce;