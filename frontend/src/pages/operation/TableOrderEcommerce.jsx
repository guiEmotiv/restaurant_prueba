import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { ArrowLeft, Users, Clock, ShoppingCart, Plus, Minus, Package, StickyNote, CreditCard, Edit3, PlusCircle, Filter, X, Trash2 } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const TableOrderEcommerce = () => {
  // Version 2025.01.10.1 - Fix getItemPrice error in unused CartItem component
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
  }, [loadInitialData]);

  const loadInitialData = useCallback(async () => {
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
  }, [showError]);

  const loadTableOrders = useCallback(async (tableId) => {
    try {
      const orders = await apiService.tables.getActiveOrders(tableId);
      return Array.isArray(orders) ? orders.filter(order => order.status === 'CREATED') : [];
    } catch (error) {
      console.error('Error loading table orders:', error);
      return [];
    }
  }, []);

  const getTableStatus = useCallback(async (table) => {
    const orders = await loadTableOrders(table.id);
    return orders.length > 0 ? 'occupied' : 'available';
  }, [loadTableOrders]);

  const handleTableSelect = useCallback(async (table) => {
    setSelectedTable(table);
    const orders = await loadTableOrders(table.id);
    
    if (orders.length > 0) {
      // Mesa ocupada - cargar cuentas existentes ordenadas por fecha descendente
      const sortedOrders = orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setAccounts(sortedOrders.map(order => ({
        id: order.id,
        items: order.items || [],
        total: parseFloat(order.grand_total || order.total_amount || 0),
        containers_total: parseFloat(order.containers_total || 0),
        created_at: order.created_at
      })));
    } else {
      // Mesa disponible - preparar para nuevas cuentas
      setAccounts([]);
    }
    
    setCurrentStep('accounts');
  }, [loadTableOrders]);

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

  const editAccount = async (accountIndex) => {
    setCurrentAccountIndex(accountIndex);
    const account = accounts[accountIndex];
    
    // Si la cuenta tiene ID, recargar desde el backend para tener datos actualizados
    if (account.id) {
      try {
        const updatedOrder = await apiService.orders.getById(account.id);
        
        // ===== CONVERSIÓN ARQUITECTÓNICA: BACKEND → FRONTEND =====
        
        // 1. Convertir items manteniendo orden de creación (created_at)
        const sortedItems = updatedOrder.items.sort((a, b) => 
          new Date(a.created_at || 0) - new Date(b.created_at || 0)
        );
        
        const cartItems = sortedItems.map(item => ({
          // Datos del item (INMUTABLES del backend)
          recipe: {
            id: item.recipe,
            name: item.recipe_name,
            base_price: item.unit_price,
            preparation_time: item.recipe_preparation_time
          },
          quantity: item.quantity,
          notes: item.notes || '',
          is_takeaway: item.is_takeaway || false,
          has_taper: item.has_taper || false,
          
          // Estado inmutable del backend
          status: item.status || 'CREATED',
          id: item.id,
          total_price: item.total_price, // FIJO del backend - NO recalcular
          created_at: item.created_at, // Para ordenamiento
          
          // Container info: Items existentes NO tienen container individual
          container: null, 
          container_price: 0 // Containers están en ContainerSales de ORDER
        }));

        // 2. Containers están separados en container_sales (nivel ORDER)
        // NO asignar containers a items individuales - arquitectura incorrecta
        
        // Actualizar la cuenta con datos frescos del backend
        const updatedAccount = {
          ...account,
          items: updatedOrder.items || [],
          total: parseFloat(updatedOrder.grand_total || updatedOrder.total_amount || 0),
          containers_total: parseFloat(updatedOrder.containers_total || 0)
        };
        
        const updatedAccounts = [...accounts];
        updatedAccounts[accountIndex] = updatedAccount;
        setAccounts(updatedAccounts);
        
        setCart(cartItems);
      } catch (error) {
        console.error('Error loading account details:', error);
        showError('Error al cargar los detalles de la cuenta');
      }
    } else {
      // Nueva cuenta, solo convertir items locales
      const cartItems = account.items.map(item => ({
        recipe: item.recipe,
        quantity: item.quantity,
        notes: item.notes || '',
        is_takeaway: item.is_takeaway || false,
        has_taper: item.has_taper || false,
        container: item.container || null,
        status: item.status || 'CREATED',
        id: item.id
      }));
      setCart(cartItems);
    }
    
    setCurrentStep('menu');
  };

  const addToCart = (recipeData) => {
    let newItem;
    
    // Si recipeData es solo una receta, crear el objeto completo
    if (recipeData.id) {
      newItem = {
        recipe: recipeData,
        quantity: 1,
        notes: '',
        is_takeaway: false,
        has_taper: false,
        container: null
      };
    } else {
      // Si ya viene como objeto completo del modal
      newItem = recipeData;
    }

    // Buscar si ya existe un item similar (misma receta, notas, opciones)
    // Solo agrupar items completamente nuevos (sin ID y sin status)
    const existingIndex = cart.findIndex(item => 
      item.recipe?.id === newItem.recipe?.id &&
      item.notes === newItem.notes &&
      item.is_takeaway === newItem.is_takeaway &&
      item.has_taper === newItem.has_taper &&
      item.container?.id === newItem.container?.id &&
      !item.id && !item.status // Solo agrupar items completamente nuevos
    );

    if (existingIndex >= 0 && !newItem.id && !newItem.status) {
      // Si existe un item nuevo similar, incrementar cantidad
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += newItem.quantity;
      setCart(updatedCart);
    } else {
      // Si no existe o es un item existente, agregar como nuevo
      setCart([...cart, newItem]);
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

  // ===== ARQUITECTURA RESTAURANTE: CÁLCULOS BASADOS EN BACKEND =====
  
  /**
   * PRINCIPIO: El backend es la fuente única de verdad
   * - Order.total_amount = Solo comida (OrderItems)
   * - Order.get_containers_total() = Solo envases (ContainerSales)  
   * - Order.get_grand_total() = Total completo
   */

  // ===== VALORES MEMOIZADOS PARA PERFORMANCE =====
  
  const newItems = useMemo(() => 
    cart.filter(item => item.status !== 'SERVED'), 
    [cart]
  );

  const existingItems = useMemo(() => 
    cart.filter(item => item.status === 'SERVED' || item.id), 
    [cart]
  );

  // ===== FUNCIONES MEMOIZADAS PARA PERFORMANCE =====
  
  const getItemFoodPrice = useCallback((item) => {
    // REGLA FUNDAMENTAL: Items existentes NUNCA se recalculan
    if (item.id && item.total_price !== undefined) {
      return parseFloat(item.total_price);
    }
    
    // Para items nuevos: calcular precio base * cantidad
    const quantity = parseInt(item.quantity || 1);
    const unitPrice = parseFloat(item.recipe?.base_price || 0);
    return unitPrice * quantity;
  }, []);

  const getItemContainerPrice = useCallback((item) => {
    // REGLA FUNDAMENTAL: Solo items NUEVOS calculan containers individualmente
    // Items existentes: containers están en ContainerSales a nivel de ORDER
    if (!item.id && item.has_taper && item.container) {
      const quantity = parseInt(item.quantity || 1);
      const containerPrice = parseFloat(item.container.price || 0);
      return containerPrice * quantity;
    }
    
    // Items existentes: CERO (containers están separados en el backend)
    return 0;
  }, []);

  // Nueva función: obtener containers de orden existente
  const getOrderContainerTotal = useCallback(() => {
    const currentAccount = accounts[currentAccountIndex];
    if (currentAccount && currentAccount.containers_total) {
      return parseFloat(currentAccount.containers_total);
    }
    return 0;
  }, [accounts, currentAccountIndex]);

  const getItemTotalPrice = useCallback((item) => {
    return getItemFoodPrice(item) + getItemContainerPrice(item);
  }, [getItemFoodPrice, getItemContainerPrice]);

  const getCartTotals = useCallback(() => {
    const foodTotal = cart.reduce((sum, item) => sum + getItemFoodPrice(item), 0);
    
    // Containers: suma items NUEVOS + containers de la ORDEN existente
    const newItemsContainerTotal = cart.reduce((sum, item) => sum + getItemContainerPrice(item), 0);
    const orderContainerTotal = getOrderContainerTotal();
    const containerTotal = newItemsContainerTotal + orderContainerTotal;
    
    const grandTotal = foodTotal + containerTotal;
    
    return {
      food: foodTotal,
      containers: containerTotal,
      newItemsContainers: newItemsContainerTotal,
      orderContainers: orderContainerTotal,
      grand: grandTotal
    };
  }, [cart, getItemFoodPrice, getItemContainerPrice, getOrderContainerTotal]);

  const getNewItemsTotal = useCallback(() => {
    // Total solo de items nuevos (para procesar)
    const itemsTotal = newItems.reduce((sum, item) => sum + (parseFloat(item.recipe?.base_price || 0) * parseInt(item.quantity || 1)), 0);
    const containersTotal = newItems.reduce((sum, item) => {
      if (item.has_taper && item.container) {
        return sum + (parseFloat(item.container.price || 0) * parseInt(item.quantity || 1));
      }
      return sum;
    }, 0);
    return itemsTotal + containersTotal;
  }, [newItems]);

  const saveCurrentAccount = async () => {
    if (!selectedTable?.id || cart.length === 0) {
      showError('Debe seleccionar una mesa y tener items en el carrito');
      return;
    }
    
    // Validar que todos los items nuevos del carrito tengan recipe válida
    // Solo validar items que no están entregados (los entregados no se procesarán)
    const invalidItems = newItems.filter(item => !item.recipe?.id);
    if (invalidItems.length > 0) {
      showError('Algunos items nuevos del carrito no tienen receta válida');
      return;
    }

    try {
      setLoading(true);
      
      const currentAccount = accounts[currentAccountIndex] || {};
      let order;

      // Solo procesar items nuevos (no entregados) - usar items memoizados
      const newCartItems = newItems;

      if (currentAccount.id) {
        // Cuenta existente - actualizar
        order = await apiService.orders.getById(currentAccount.id);
      } else {
        // Nueva cuenta - crear orden con items
        const itemsData = newCartItems.map(cartItem => ({
          recipe: cartItem.recipe?.id,
          quantity: cartItem.quantity,
          notes: cartItem.notes || '',
          is_takeaway: cartItem.is_takeaway || false,
          has_taper: cartItem.has_taper || false,
          selected_container: cartItem.has_taper && cartItem.container ? cartItem.container.id : null
        }));

        const orderData = {
          table: selectedTable?.id,
          waiter: user?.username || 'Sistema',
          items: itemsData
        };

        order = await apiService.orders.create(orderData);
      }

      // Si la cuenta ya existía, agregar nuevos items
      if (currentAccount.id) {
        for (const cartItem of newCartItems) {
          const itemData = {
            recipe: cartItem.recipe?.id,
            quantity: cartItem.quantity,
            notes: cartItem.notes,
            is_takeaway: cartItem.is_takeaway,
            has_taper: cartItem.has_taper,
            selected_container: cartItem.has_taper && cartItem.container ? cartItem.container.id : null
          };

          await apiService.orders.addItem(order.id, itemData);
          // NO crear ContainerSale aquí - el backend ya lo maneja en addItem
        }
      }

      // Calcular total solo de items nuevos
      const newItemsTotal = newCartItems.reduce((sum, item) => {
        const itemTotal = parseFloat(item.recipe?.base_price || 0) * parseInt(item.quantity || 1);
        const containerTotal = item.has_taper && item.container ? parseFloat(item.container.price || 0) * parseInt(item.quantity || 1) : 0;
        return sum + itemTotal + containerTotal;
      }, 0);

      // Validar que la orden tenga ID antes de recargar
      if (!order?.id) {
        throw new Error('Error: La orden no fue creada correctamente o no tiene ID válido');
      }

      // Recargar la orden actualizada desde el backend para obtener el total correcto
      const updatedOrder = await apiService.orders.getById(order.id);

      // Actualizar la cuenta en el estado con datos reales del backend
      const updatedAccount = {
        ...currentAccount,
        id: order.id,
        items: updatedOrder.items || [],
        total: parseFloat(updatedOrder.grand_total || updatedOrder.total_amount || 0),
        containers_total: parseFloat(updatedOrder.containers_total || 0)
      };

      const updatedAccounts = [...accounts];
      updatedAccounts[currentAccountIndex] = updatedAccount;
      setAccounts(updatedAccounts);

      // ===== LIMPIEZA ARQUITECTÓNICA DEL STATE =====
      
      showSuccess(`Cuenta ${currentAccount.id ? 'actualizada' : 'creada'} exitosamente`);
      
      // 1. Limpiar carrito completamente (evita estados inconsistentes)
      setCart([]);
      
      // 2. Recargar TODAS las cuentas desde el backend (fuente de verdad)
      if (selectedTable) {
        const orders = await loadTableOrders(selectedTable.id);
        if (orders.length > 0) {
          const sortedOrders = orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          setAccounts(sortedOrders.map(order => ({
            id: order.id,
            items: order.items || [],
            total: parseFloat(order.grand_total || order.total_amount || 0), // Backend es fuente de verdad
            containers_total: parseFloat(order.containers_total || 0),
            created_at: order.created_at
          })));
        }
      }
      
      // 3. Volver a cuentas con estado limpio
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
        // Si el carrito está vacío y la cuenta actual no tiene ID, eliminarla
        const currentAccount = accounts[currentAccountIndex] || {};
        if (cart.length === 0 && !currentAccount.id) {
          const updatedAccounts = accounts.filter((_, index) => index !== currentAccountIndex);
          setAccounts(updatedAccounts);
          // Ajustar el índice si es necesario
          if (currentAccountIndex >= updatedAccounts.length && updatedAccounts.length > 0) {
            setCurrentAccountIndex(updatedAccounts.length - 1);
          } else if (updatedAccounts.length === 0) {
            setCurrentAccountIndex(0);
          }
        }
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
            {currentStep === 'accounts' && `Mesa ${selectedTable?.table_number}`}
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
            {currentStep === 'accounts' && (
              <button
                onClick={() => {
                  setCurrentAccountIndex(accounts.length);
                  setCurrentStep('menu');
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                Nueva Cuenta
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
            getCartTotals={getCartTotals}
            getItemFoodPrice={getItemFoodPrice}
            getItemContainerPrice={getItemContainerPrice}
            getItemTotalPrice={getItemTotalPrice}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

const TableSelection = memo(({ tables, onTableSelect, getTableStatus }) => {
  const [tableStatuses, setTableStatuses] = useState({});
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'available', 'occupied'
  const [zoneFilter, setZoneFilter] = useState('all');

  useEffect(() => {
    const loadStatuses = async () => {
      if (tables.length === 0) return;
      
      // Cargar estados en paralelo para mayor velocidad
      const statusPromises = tables.map(async (table) => {
        const status = await getTableStatus(table);
        return { tableId: table.id, status };
      });
      
      const results = await Promise.all(statusPromises);
      const statuses = {};
      results.forEach(({ tableId, status }) => {
        statuses[tableId] = status;
      });
      setTableStatuses(statuses);
    };
    
    if (tables.length > 0) {
      loadStatuses();
      
      // Actualización en tiempo real cada 10 segundos
      const interval = setInterval(loadStatuses, 10000);
      return () => clearInterval(interval);
    }
  }, [tables, getTableStatus]);

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
});

const AccountsManagement = memo(({ 
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

  // Función para verificar si todos los items de una cuenta están entregados
  const isAccountReadyForPayment = (account) => {
    if (!account.items || account.items.length === 0) return false;
    return account.items.every(item => item.status === 'SERVED');
  };

  return (
    <div className="space-y-6">

      {/* Lista de cuentas existentes */}
      {accounts.length > 0 && (
        <div className="space-y-4">
          <div className="grid gap-4">
            {accounts.map((account, index) => {
              const readyForPayment = isAccountReadyForPayment(account);
              const servedItems = account.items?.filter(item => item.status === 'SERVED').length || 0;
              const pendingItems = account.items?.filter(item => item.status !== 'SERVED').length || 0;
              const totalItems = account.items?.length || 0;
              
              return (
                <div key={index} className={`bg-white rounded-lg border border-gray-200 p-6 relative ${readyForPayment ? 'pb-16' : ''}`}>
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">Cuenta {index + 1}</h4>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-2xl font-bold text-blue-600">S/ {account.total.toFixed(2)}</span>
                        <div className="flex items-center gap-2 text-sm">
                          {readyForPayment ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                              <span className="font-medium">Todo listo</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-orange-600">
                              <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
                              <span className="font-medium">En preparación</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onEditAccount(index)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                      <span className="font-medium">Editar</span>
                    </button>
                  </div>

                  {/* Resumen de estado */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{totalItems}</div>
                        <div className="text-sm text-gray-600">Total Items</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{servedItems}</div>
                        <div className="text-sm text-gray-600">Entregados</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-orange-600">{pendingItems}</div>
                        <div className="text-sm text-gray-600">Pendientes</div>
                      </div>
                    </div>
                  </div>


                  {/* Botón procesar pago - esquina inferior derecha */}
                  {readyForPayment && (
                    <div className="absolute bottom-4 right-4">
                      <button
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-lg"
                        onClick={() => {
                          // TODO: Implementar procesamiento de pago individual
                          console.log('Procesar pago de cuenta:', index + 1);
                        }}
                      >
                        <CreditCard className="h-4 w-4" />
                        <span className="font-medium">Procesar Pago</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
});

const MenuSelection = memo(({ 
  recipes, 
  containers, 
  cart, 
  onAddToCart, 
  onUpdateCart, 
  onRemoveFromCart, 
  onSaveAccount,
  getCartTotals,
  getItemFoodPrice,
  getItemContainerPrice,
  getItemTotalPrice,
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
        getCartTotals={getCartTotals}
        getItemFoodPrice={getItemFoodPrice}
        getItemContainerPrice={getItemContainerPrice}
        getItemTotalPrice={getItemTotalPrice}
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
});

const FloatingCart = memo(({ 
  cart, 
  containers, 
  onUpdateCart, 
  onRemoveFromCart, 
  onSaveAccount, 
  getCartTotals,
  getItemFoodPrice,
  getItemContainerPrice,
  getItemTotalPrice,
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
        {totalItems > 0 && (
          <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded-full">
            S/ {getCartTotals().grand.toFixed(2)}
          </span>
        )}
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
              {cart
                .slice() // Crear copia para no mutar el array original
                .sort((a, b) => {
                  // ARQUITECTURA CORRECTA: Items nuevos primero (más recientes)
                  // Luego items existentes por orden de creación (1, 2, 3...)
                  
                  // 1. Items nuevos (sin ID) siempre primero
                  if (!a.id && b.id) return -1;
                  if (a.id && !b.id) return 1;
                  
                  // 2. Entre items nuevos: más recientes primero (orden inverso de adición)
                  if (!a.id && !b.id) return 0; // Mantener orden de adición
                  
                  // 3. Entre items existentes: orden de creación (1, 2, 3...)
                  if (a.id && b.id) {
                    if (a.created_at && b.created_at) {
                      return new Date(a.created_at) - new Date(b.created_at);
                    }
                  }
                  
                  // 4. Items entregados al final
                  if (a.status === 'SERVED' && b.status !== 'SERVED') return 1;
                  if (a.status !== 'SERVED' && b.status === 'SERVED') return -1;
                  
                  return 0;
                })
                .map((item, index) => (
                <div key={index} className={`rounded-lg p-3 flex justify-between items-center ${
                  item.status === 'SERVED' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                }`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-gray-200 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <h4 className="font-medium text-gray-900">{item.recipe.name}</h4>
                      {item.status === 'SERVED' ? (
                        <div className="flex items-center gap-1 text-green-600 text-xs">
                          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                          <span>Entregado</span>
                        </div>
                      ) : item.status === 'CREATED' && item.id ? (
                        <div className="flex items-center gap-1 text-orange-600 text-xs">
                          <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
                          <span>Preparando</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-blue-600 text-xs">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          <span>Nuevo</span>
                        </div>
                      )}
                    </div>
                    {/* ===== ARQUITECTURA RESTAURANTE: DESGLOSE POR COMPONENTES ===== */}
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <span>Cantidad: {item.quantity}</span>
                        <span>•</span>
                        <span>Comida: S/ {getItemFoodPrice(item).toFixed(2)}</span>
                      </div>
                      
                      {/* Mostrar envase solo si tiene precio calculable */}
                      {getItemContainerPrice(item) > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <Package className="h-3 w-3 text-orange-600" />
                          <span>Envase: S/ {getItemContainerPrice(item).toFixed(2)}</span>
                        </div>
                      )}
                      
                      {/* Para items existentes con envase: mostrar info arquitectónica */}
                      {item.has_taper && item.id && (
                        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
                          <Package className="h-3 w-3 text-blue-600" />
                          <span>✅ Envase incluido en total de orden</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 font-medium">
                        <span>Total item: S/ {getItemTotalPrice(item).toFixed(2)}</span>
                      </div>
                    </div>
                    {item.is_takeaway && (
                      <div className="text-xs text-orange-600 flex items-center gap-1 mt-1">
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
                  {item.status === 'SERVED' ? (
                    <div className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                      No se puede eliminar
                    </div>
                  ) : (
                    <button
                      onClick={() => onRemoveFromCart(index)}
                      className="text-red-600 hover:text-red-700 p-1"
                      title={item.id ? "Eliminar item existente" : "Eliminar item nuevo"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {/* ===== FOOTER ARQUITECTÓNICO: TOTALES SEPARADOS ===== */}
            <div className="p-4 border-t space-y-4">
              {(() => {
                const totals = getCartTotals();
                
                return (
                  <div className="space-y-2">
                    {/* Subtotal comida */}
                    <div className="flex justify-between items-center text-sm text-gray-600">
                      <span>🍽️ Subtotal comida:</span>
                      <span>S/ {totals.food.toFixed(2)}</span>
                    </div>
                    
                    {/* Subtotal envases: desglosado por fuente */}
                    {totals.containers > 0 && (
                      <div className="space-y-1">
                        {/* Envases de items nuevos */}
                        {totals.newItemsContainers > 0 && (
                          <div className="flex justify-between items-center text-xs text-orange-600">
                            <span>📦 Envases nuevos:</span>
                            <span>S/ {totals.newItemsContainers.toFixed(2)}</span>
                          </div>
                        )}
                        
                        {/* Envases de orden existente */}
                        {totals.orderContainers > 0 && (
                          <div className="flex justify-between items-center text-xs text-blue-600">
                            <span>📦 Envases de orden:</span>
                            <span>S/ {totals.orderContainers.toFixed(2)}</span>
                          </div>
                        )}
                        
                        {/* Total envases */}
                        <div className="flex justify-between items-center text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded">
                          <span>📦 Total envases:</span>
                          <span>S/ {totals.containers.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Total general */}
                    <div className="flex justify-between items-center text-lg font-bold border-t pt-2 text-green-700">
                      <span>💰 TOTAL GENERAL:</span>
                      <span>S/ {totals.grand.toFixed(2)}</span>
                    </div>
                    
                    {/* Información arquitectónica para debugging */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-50 rounded">
                        <div>📊 Food={totals.food.toFixed(2)} + New={totals.newItemsContainers.toFixed(2)} + Order={totals.orderContainers.toFixed(2)} = {totals.grand.toFixed(2)}</div>
                      </div>
                    )}
                  </div>
                );
              })()}
              
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
});

const RecipeModal = memo(({ recipe, containers, onAdd, onClose }) => {
  const [notes, setNotes] = useState('');
  const [isForTakeaway, setIsForTakeaway] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState(null);

  // Cuando se selecciona "para llevar", automáticamente asignar el envase de la receta
  useEffect(() => {
    if (isForTakeaway && recipe.container && !selectedContainer) {
      const containerForRecipe = containers.find(c => c.id === recipe.container);
      if (containerForRecipe) {
        setSelectedContainer(containerForRecipe);
      }
    } else if (!isForTakeaway) {
      setSelectedContainer(null);
    }
  }, [isForTakeaway, recipe.container, containers, selectedContainer]);

  const getTotal = () => {
    let total = parseFloat(recipe?.base_price || 0);
    if (isForTakeaway && selectedContainer) {
      total += parseFloat(selectedContainer.price || 0);
    }
    return total;
  };

  const handleAdd = () => {
    const recipeData = {
      recipe,
      quantity: 1,
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

            {isForTakeaway && selectedContainer && (
              <div className="ml-6 space-y-2">
                <div className="text-sm font-medium text-gray-700">Envase incluido:</div>
                <div className="bg-orange-50 border border-orange-200 p-3 rounded-md">
                  <div className="font-medium text-gray-900">{selectedContainer.name}</div>
                  <div className="text-sm text-orange-600">+ S/ {parseFloat(selectedContainer.price || 0).toFixed(2)}</div>
                </div>
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
});

// CartItem component removed - was causing getItemPrice ReferenceError

export default TableOrderEcommerce;