import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Clock, ShoppingCart, Plus, Minus, Package, StickyNote, CreditCard, Edit3, PlusCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const TableOrderEcommerce = () => {
  const [currentStep, setCurrentStep] = useState('tables'); // 'tables', 'accounts', 'menu', 'payment'
  const [tables, setTables] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [containers, setContainers] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [accounts, setAccounts] = useState([]); // Múltiples cuentas por mesa
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
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
      // Mesa ocupada - cargar cuentas existentes
      setAccounts(orders.map(order => ({
        id: order.id,
        items: order.items || [],
        total: order.total_amount || 0,
        created_at: order.created_at
      })));
    } else {
      // Mesa disponible - preparar para nuevas cuentas
      setAccounts([]);
    }
    
    setCurrentStep('accounts');
  };

  const createNewAccount = () => {
    const newAccount = {
      id: null, // Se asignará al crear la orden
      items: [],
      total: 0,
      created_at: new Date().toISOString()
    };
    setAccounts([...accounts, newAccount]);
    setCurrentAccountIndex(accounts.length);
    setCart([]);
    setCurrentStep('menu');
  };

  const editAccount = (accountIndex) => {
    setCurrentAccountIndex(accountIndex);
    const account = accounts[accountIndex];
    // Convertir items existentes al formato de carrito
    const cartItems = account.items.map(item => ({
      recipe: item.recipe,
      quantity: item.quantity,
      notes: item.notes || '',
      is_takeaway: item.is_takeaway || false,
      has_taper: item.has_taper || false,
      container: item.container || null
    }));
    setCart(cartItems);
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

  const saveCurrentAccount = async () => {
    if (!selectedTable || cart.length === 0) return;

    try {
      setLoading(true);
      
      const currentAccount = accounts[currentAccountIndex];
      let order;

      if (currentAccount.id) {
        // Cuenta existente - actualizar
        order = await apiService.orders.getById(currentAccount.id);
      } else {
        // Nueva cuenta - crear orden
        const orderData = {
          table: selectedTable.id,
          waiter: 'Sistema',
        };
        order = await apiService.orders.create(orderData);
      }

      // Agregar nuevos items al pedido
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

      // Actualizar la cuenta en el estado
      const updatedAccount = {
        ...currentAccount,
        id: order.id,
        items: [...(currentAccount.items || []), ...cart],
        total: (currentAccount.total || 0) + getCartTotal()
      };

      const updatedAccounts = [...accounts];
      updatedAccounts[currentAccountIndex] = updatedAccount;
      setAccounts(updatedAccounts);

      showSuccess('Cuenta actualizada exitosamente');
      setCart([]);
      setCurrentStep('accounts');

    } catch (error) {
      console.error('Error saving account:', error);
      showError('Error al guardar la cuenta');
    } finally {
      setLoading(false);
    }
  };

  const checkAllItemsDelivered = async () => {
    // Verificar que todos los items de todas las cuentas estén entregados
    for (const account of accounts) {
      if (account.id) {
        try {
          const order = await apiService.orders.getById(account.id);
          const hasUndeliveredItems = order.items?.some(item => item.status === 'CREATED');
          if (hasUndeliveredItems) {
            return false;
          }
        } catch (error) {
          console.error('Error checking order status:', error);
          return false;
        }
      }
    }
    return true;
  };

  const processPayment = async () => {
    try {
      setLoading(true);

      // Procesar pago para todas las cuentas
      for (const account of accounts) {
        if (account.id && account.total > 0) {
          const paymentData = {
            order: account.id,
            payment_method: 'CASH',
            amount: account.total,
            notes: 'Pago procesado desde vista ecommerce'
          };

          await apiService.payments.create(paymentData);
        }
      }
      
      showSuccess('Pago procesado exitosamente para todas las cuentas');
      
      // Limpiar estado y volver a selección de mesas
      setCurrentStep('tables');
      setSelectedTable(null);
      setAccounts([]);
      setCart([]);
      setCurrentAccountIndex(0);
      
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
      case 'accounts':
        setCurrentStep('tables');
        setSelectedTable(null);
        setAccounts([]);
        break;
      case 'menu':
        setCurrentStep('accounts');
        setCart([]);
        break;
      case 'payment':
        setCurrentStep('accounts');
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
      {/* Header con título centrado y navegación debajo */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-4">
            {currentStep === 'tables' && 'Seleccionar Mesa'}
            {currentStep === 'accounts' && `Mesa ${selectedTable?.table_number} - Cuentas`}
            {currentStep === 'menu' && `Cuenta ${currentAccountIndex + 1} - Menú`}
            {currentStep === 'payment' && 'Procesar Pago'}
          </h1>
          
          {/* Botones de navegación centrados debajo del título */}
          <div className="flex justify-center gap-4">
            {currentStep !== 'tables' && (
              <button
                onClick={goBack}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </button>
            )}
            
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

        {currentStep === 'accounts' && (
          <AccountsManagement
            accounts={accounts}
            onCreateNewAccount={createNewAccount}
            onEditAccount={editAccount}
            onProcessPayment={processPayment}
            checkAllItemsDelivered={checkAllItemsDelivered}
            loading={loading}
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
            onSaveAccount={saveCurrentAccount}
            getCartTotal={getCartTotal}
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

const AccountsManagement = ({ 
  accounts, 
  onCreateNewAccount, 
  onEditAccount, 
  onProcessPayment, 
  checkAllItemsDelivered,
  loading 
}) => {
  const [allItemsDelivered, setAllItemsDelivered] = useState(false);

  useEffect(() => {
    const checkDeliveryStatus = async () => {
      if (accounts.length > 0) {
        const delivered = await checkAllItemsDelivered();
        setAllItemsDelivered(delivered);
      }
    };
    
    checkDeliveryStatus();
  }, [accounts, checkAllItemsDelivered]);

  return (
    <div className="space-y-6">
      {/* Botón para crear nueva cuenta */}
      <div className="text-center">
        <button
          onClick={onCreateNewAccount}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
        >
          <PlusCircle className="h-5 w-5" />
          Crear Nueva Cuenta
        </button>
      </div>

      {/* Lista de cuentas existentes */}
      {accounts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Cuentas Existentes</h3>
          <div className="grid gap-4">
            {accounts.map((account, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">Cuenta {index + 1}</h4>
                    <p className="text-sm text-gray-600">
                      {account.items.length} items - S/ {account.total.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => onEditAccount(index)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Edit3 className="h-4 w-4" />
                    <ShoppingCart className="h-4 w-4" />
                  </button>
                </div>
                
                {/* Items de la cuenta */}
                <div className="space-y-2">
                  {account.items.slice(0, 3).map((item, itemIndex) => (
                    <div key={itemIndex} className="flex justify-between text-sm">
                      <span>{item.recipe?.name} x{item.quantity}</span>
                      <span>S/ {(item.unit_price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  {account.items.length > 3 && (
                    <p className="text-sm text-gray-500">
                      ... y {account.items.length - 3} items más
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón de procesar pago */}
      {accounts.length > 0 && (
        <div className="text-center">
          {!allItemsDelivered && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800 text-sm">
                ⏱ Algunos items aún están en preparación. El pago estará disponible cuando todos los items sean servidos.
              </p>
            </div>
          )}

          {allItemsDelivered && (
            <button
              onClick={onProcessPayment}
              disabled={loading}
              className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold flex items-center gap-2 mx-auto"
            >
              <CreditCard className="h-5 w-5" />
              {loading ? 'Procesando pago...' : 'Procesar Pago de Todas las Cuentas'}
            </button>
          )}
        </div>
      )}
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
  onSaveAccount,
  getCartTotal,
  loading 
}) => {
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
                    onClick={onSaveAccount}
                    disabled={loading || cart.length === 0}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="h-5 w-5" />
                    {loading ? 'Guardando...' : 'Guardar en Cuenta'}
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

      {/* Para llevar con botones específicos */}
      <div className="space-y-3">
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
          <div className="ml-6 space-y-3">
            {/* Botones específicos para para llevar */}
            <div className="flex gap-2">
              <button
                onClick={() => onUpdate(index, { has_taper: true })}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  item.has_taper 
                    ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }`}
              >
                Agregar Envase
              </button>
              <button
                onClick={() => onUpdate(index, { 
                  is_takeaway: true, 
                  has_taper: item.has_taper,
                  notes: item.notes + (item.notes ? ' | ' : '') + 'Para llevar'
                })}
                className="flex-1 py-2 px-3 rounded-lg text-sm font-medium bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
              >
                Agregar Más
              </button>
            </div>

            {item.has_taper && (
              <>
                <select
                  value={item.container?.id || ''}
                  onChange={(e) => {
                    const container = containers.find(c => c.id === parseInt(e.target.value));
                    onUpdate(index, { container });
                  }}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="">Seleccionar envase</option>
                  {containers.map(container => (
                    <option key={container.id} value={container.id}>
                      {container.name} - S/ {container.price}
                    </option>
                  ))}
                </select>

                {item.container && (
                  <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                    + S/ {(item.container.price * item.quantity).toFixed(2)} por envase
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TableOrderEcommerce;