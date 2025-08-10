import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Clock, ShoppingCart, Plus, Minus, Package, StickyNote, CreditCard, Edit3, PlusCircle, Filter, X, Trash2 } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

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
  const { user } = useAuth();

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
        total: parseFloat(order.total_amount) || 0,
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

  const addToCart = (recipeData) => {
    // Si recipeData es solo una receta, crear el objeto completo
    if (recipeData.id) {
      setCart([...cart, {
        recipe: recipeData,
        quantity: 1,
        notes: '',
        is_takeaway: false,
        has_taper: false,
        container: null
      }]);
    } else {
      // Si ya viene como objeto completo del modal
      setCart([...cart, recipeData]);
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
    const itemsTotal = cart.reduce((sum, item) => sum + (parseFloat(item.recipe?.base_price || 0) * parseInt(item.quantity || 1)), 0);
    const containersTotal = cart.reduce((sum, item) => {
      if (item.has_taper && item.container) {
        return sum + (parseFloat(item.container.price || 0) * parseInt(item.quantity || 1));
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
        // Nueva cuenta - crear orden con items
        const itemsData = cart.map(cartItem => ({
          recipe: cartItem.recipe.id,
          quantity: cartItem.quantity,
          notes: cartItem.notes || '',
          is_takeaway: cartItem.is_takeaway || false,
          has_taper: cartItem.has_taper || false,
          selected_container: cartItem.has_taper && cartItem.container ? cartItem.container.id : null
        }));

        const orderData = {
          table: selectedTable.id,
          waiter: user?.username || 'Sistema',
          items: itemsData
        };

        order = await apiService.orders.create(orderData);
      }

      // Si la cuenta ya existía, agregar nuevos items
      if (currentAccount.id) {
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
      }

      // Actualizar la cuenta en el estado
      const updatedAccount = {
        ...currentAccount,
        id: order.id,
        items: [...(currentAccount.items || []), ...cart],
        total: parseFloat(currentAccount.total || 0) + parseFloat(getCartTotal() || 0)
      };

      const updatedAccounts = [...accounts];
      updatedAccounts[currentAccountIndex] = updatedAccount;
      setAccounts(updatedAccounts);

      showSuccess('Cuenta actualizada exitosamente');
      setCart([]);
      setCurrentStep('accounts');

    } catch (error) {
      console.error('Error saving account:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.error || 
                          JSON.stringify(error.response?.data) ||
                          'Error al guardar la cuenta';
      showError(errorMessage);
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
            notes: `Pago procesado por ${user?.username || 'Sistema'} desde vista ecommerce`
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
            {currentStep === 'menu' && `Cuenta ${currentAccountIndex + 1}`}
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
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'available', 'occupied'
  const [zoneFilter, setZoneFilter] = useState('all');

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

  // Obtener zonas únicas
  const zones = [...new Set(tables.map(table => table.zone_name || 'Sin Zona'))];

  // Filtrar mesas
  const filteredTables = tables.filter(table => {
    const status = tableStatuses[table.id];
    const statusMatch = statusFilter === 'all' || 
                       (statusFilter === 'available' && status === 'available') ||
                       (statusFilter === 'occupied' && status === 'occupied');
    
    const zoneMatch = zoneFilter === 'all' || 
                      (table.zone_name || 'Sin Zona') === zoneFilter;
    
    return statusMatch && zoneMatch;
  });

  const tablesByZone = filteredTables.reduce((acc, table) => {
    const zoneName = table.zone_name || 'Sin Zona';
    if (!acc[zoneName]) acc[zoneName] = [];
    acc[zoneName].push(table);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filtros:</span>
          </div>
          
          {/* Filtro de disponibilidad */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Todas las mesas</option>
            <option value="available">Solo disponibles</option>
            <option value="occupied">Solo ocupadas</option>
          </select>
          
          {/* Filtro de zonas */}
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Todas las zonas</option>
            {zones.map(zone => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </div>
      </div>

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
                      <span>S/ {(parseFloat(item.unit_price || 0) * parseInt(item.quantity || 1)).toFixed(2)}</span>
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
  const [groupFilter, setGroupFilter] = useState('all');
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // Obtener grupos únicos
  const groups = [...new Set(recipes.map(recipe => recipe.group_name || 'Sin Grupo'))];

  // Filtrar recetas por grupo
  const filteredRecipes = groupFilter === 'all' 
    ? recipes 
    : recipes.filter(recipe => (recipe.group_name || 'Sin Grupo') === groupFilter);

  const recipesByGroup = filteredRecipes.reduce((acc, recipe) => {
    const groupName = recipe.group_name || 'Sin Grupo';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(recipe);
    return acc;
  }, {});

  const handleRecipeClick = (recipe) => {
    setSelectedRecipe(recipe);
    setShowRecipeModal(true);
  };

  const handleAddRecipeWithOptions = (recipeData) => {
    onAddToCart(recipeData);
    setShowRecipeModal(false);
    setSelectedRecipe(null);
  };

  return (
    <div className="space-y-6">
      {/* Filtro de grupos */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filtrar por grupo:</span>
          </div>
          
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Todos los grupos</option>
            {groups.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Menú */}
      <div className="space-y-6">
        {Object.entries(recipesByGroup).map(([groupName, groupRecipes]) => (
          <div key={groupName} className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
              {groupName}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => onAddToCart(recipe)}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Agregar
                      </button>
                      <button
                        onClick={() => handleRecipeClick(recipe)}
                        className="flex-1 bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <StickyNote className="h-4 w-4" />
                        Con Nota
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Carrito flotante en inferior derecha */}
      <FloatingCart
        cart={cart}
        containers={containers}
        onUpdateCart={onUpdateCart}
        onRemoveFromCart={onRemoveFromCart}
        onSaveAccount={onSaveAccount}
        getCartTotal={getCartTotal}
        loading={loading}
      />

      {/* Modal de recetas */}
      {showRecipeModal && selectedRecipe && (
        <RecipeModal
          recipe={selectedRecipe}
          containers={containers}
          onAdd={handleAddRecipeWithOptions}
          onClose={() => {
            setShowRecipeModal(false);
            setSelectedRecipe(null);
          }}
        />
      )}
    </div>
  );
};

const FloatingCart = ({ 
  cart, 
  containers, 
  onUpdateCart, 
  onRemoveFromCart, 
  onSaveAccount, 
  getCartTotal, 
  loading 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (totalItems === 0) return null;

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-40 flex items-center gap-2"
      >
        <ShoppingCart className="h-6 w-6" />
        <span className="bg-white text-blue-600 rounded-full min-w-[24px] h-6 flex items-center justify-center text-sm font-bold">
          {totalItems}
        </span>
      </button>

      {/* Modal del carrito expandido */}
      {isExpanded && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsExpanded(false)}
          />
          <div className="fixed inset-x-4 bottom-4 top-20 bg-white rounded-lg shadow-xl z-50 flex flex-col max-w-md mx-auto">
            {/* Header del carrito */}
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Carrito ({totalItems})
              </h2>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            
            {/* Items del carrito - Solo mostrar y eliminar */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{item.recipe.name}</h4>
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <span>Cantidad: {item.quantity}</span>
                      <span>•</span>
                      <span>S/ {((parseFloat(item.recipe?.base_price || 0) * parseInt(item.quantity || 1)) + (item.container && item.has_taper ? (parseFloat(item.container.price || 0) * parseInt(item.quantity || 1)) : 0)).toFixed(2)}</span>
                    </div>
                    {item.is_takeaway && (
                      <div className="text-xs text-orange-600 flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Para llevar
                      </div>
                    )}
                    {item.notes && (
                      <div className="text-xs text-gray-500 mt-1">
                        Nota: {item.notes}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveFromCart(index)}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            
            {/* Footer con total y botón */}
            <div className="p-4 border-t space-y-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total:</span>
                <span>S/ {getCartTotal().toFixed(2)}</span>
              </div>
              
              <button
                onClick={() => {
                  onSaveAccount();
                  setIsExpanded(false);
                }}
                disabled={loading || cart.length === 0}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center gap-2"
              >
                <ShoppingCart className="h-5 w-5" />
                {loading ? 'Guardando...' : 'Guardar en Cuenta'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

const RecipeModal = ({ recipe, containers, onAdd, onClose }) => {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [isForTakeaway, setIsForTakeaway] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState(null);

  // Encontrar el envase recomendado para esta receta
  useEffect(() => {
    if (isForTakeaway && recipe.container && !selectedContainer) {
      const containerForRecipe = containers.find(c => c.id === recipe.container);
      if (containerForRecipe) {
        setSelectedContainer(containerForRecipe);
      }
    }
  }, [isForTakeaway, recipe.container, containers, selectedContainer]);

  const getTotal = () => {
    let total = parseFloat(recipe?.base_price || 0) * parseInt(quantity || 1);
    if (isForTakeaway && selectedContainer) {
      total += parseFloat(selectedContainer.price || 0) * parseInt(quantity || 1);
    }
    return total;
  };

  const handleAdd = () => {
    const recipeData = {
      recipe,
      quantity,
      notes,
      is_takeaway: isForTakeaway,
      has_taper: isForTakeaway && !!selectedContainer,
      container: isForTakeaway ? selectedContainer : null
    };
    onAdd(recipeData);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-x-4 top-20 bottom-20 bg-white rounded-lg shadow-xl z-50 flex flex-col max-w-md mx-auto">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{recipe.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Precio base */}
          <div className="text-center">
            <span className="text-2xl font-bold text-blue-600">S/ {recipe.base_price}</span>
            <div className="text-sm text-gray-600 flex items-center justify-center gap-2 mt-1">
              <Clock className="h-4 w-4" />
              <span>{recipe.preparation_time} min</span>
            </div>
          </div>

          {/* Cantidad */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Cantidad:</label>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-xl font-bold w-12 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Notas especiales:
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agregar instrucciones especiales..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {/* Para llevar */}
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isForTakeaway}
                onChange={(e) => setIsForTakeaway(e.target.checked)}
                className="rounded"
              />
              <Package className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">Para llevar</span>
            </label>

            {isForTakeaway && (
              <div className="ml-6 space-y-2">
                <label className="text-sm font-medium text-gray-700">Seleccionar envase:</label>
                <select
                  value={selectedContainer?.id || ''}
                  onChange={(e) => {
                    const container = containers.find(c => c.id === parseInt(e.target.value));
                    setSelectedContainer(container);
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="">Sin envase</option>
                  {containers.map(container => (
                    <option key={container.id} value={container.id}>
                      {container.name} - S/ {container.price}
                      {recipe.container === container.id ? ' (Recomendado)' : ''}
                    </option>
                  ))}
                </select>

                {selectedContainer && (
                  <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
                    + S/ {(parseFloat(selectedContainer.price || 0) * parseInt(quantity || 1)).toFixed(2)} por envase
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t space-y-4">
          <div className="flex justify-between items-center text-xl font-bold">
            <span>Total:</span>
            <span>S/ {parseFloat(getTotal() || 0).toFixed(2)}</span>
          </div>
          <button
            onClick={handleAdd}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Agregar al Carrito
          </button>
        </div>
      </div>
    </>
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
        <span className="font-semibold">S/ {(parseFloat(item.recipe?.base_price || 0) * parseInt(item.quantity || 1)).toFixed(2)}</span>
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
            {/* Botones específicos como solicitado en el requerimiento */}
            <div className="flex gap-2">
              <button
                onClick={() => onUpdate(index, { has_taper: true })}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  item.has_taper 
                    ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }`}
              >
                Agregar Receta
              </button>
              <button
                onClick={() => onUpdate(index, { 
                  is_takeaway: true, 
                  has_taper: item.has_taper,
                  notes: item.notes + (item.notes ? ' | ' : '') + 'Para llevar adicional'
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
                    + S/ {(parseFloat(item.container.price || 0) * parseInt(item.quantity || 1)).toFixed(2)} por envase
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