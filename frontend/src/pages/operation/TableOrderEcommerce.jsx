import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/api';
import bluetoothPrinter from '../../services/bluetoothPrinter';

const TableOrderEcommerce = () => {
  const { user, userRole, hasPermission } = useAuth();
  const { showToast } = useToast();


  // Estados principales
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [allOrders, setAllOrders] = useState([]); 
  const [recipes, setRecipes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('tables'); // 'tables', 'orders', 'menu', 'payment'
  
  // Estados para filtros de mesa
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('todos');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('todos'); // 'todos', 'disponibles', 'ocupadas'

  // Estados carrito
  const [cart, setCart] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Estados para modal de notas y para llevar
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [isTakeaway, setIsTakeaway] = useState(false);
  const [containers, setContainers] = useState([]);

  // Estados para paso de pago
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]); // Items seleccionados para pago
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [withPrinting, setWithPrinting] = useState(false);
  const [bluetoothConnected, setBluetoothConnected] = useState(false);
  const [connectingBluetooth, setConnectingBluetooth] = useState(false);

  // Helper functions para gestión de pedidos
  const canDeleteOrder = (order) => {
    // Se puede eliminar si:
    // 1. El pedido está vacío (sin items), O
    // 2. TODOS los items están en estado CREATED
    if (!order.items || order.items.length === 0) return true;
    
    const createdItems = order.items.filter(item => item.status === 'CREATED');
    
    // Solo se puede eliminar si TODOS los items están CREATED
    return createdItems.length === order.items.length;
  };

  const canProcessPayment = (order) => {
    if (!order || order.status === 'PAID' || !order.items || order.items.length === 0) {
      return false;
    }
    
    // Buscar items que estén SERVED y no pagados
    const servedUnpaidItems = order.items.filter(item => 
      item.status === 'SERVED' && !item.is_fully_paid
    );
    
    
    return servedUnpaidItems.length > 0;
  };

  // Cargar datos iniciales
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [tables, recipes, groups, allOrders, containers] = await Promise.all([
        apiService.tables.getAll(),
        apiService.recipes.getAll({ is_active: true, is_available: true }),
        apiService.groups.getAll(),
        apiService.orders.getAll(),
        apiService.containers.getAll()
      ]);
      
      setTables(tables || []);
      setRecipes(recipes || []);
      setGroups(groups || []);
      setContainers(containers || []);
      // Filtrar órdenes activas en frontend para mayor control
      setAllOrders(allOrders?.filter(o => o.status === 'CREATED') || []);
    } catch (error) {
      showToast(`Error al cargar datos: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInitialData();
    
    // Auto-refresh optimizado: solo cuando la ventana esté activa
    let interval = null;
    
    const startRefresh = () => {
      if (interval) return; // Evitar múltiples intervalos
      
      interval = setInterval(async () => {
        // Solo actualizar si el usuario está en la vista de mesas u órdenes
        if (step === 'tables' || step === 'orders') {
          try {
            const allOrders = await apiService.orders.getAll();
            const activeOrders = allOrders?.filter(o => o.status === 'CREATED') || [];
            
            // Solo actualizar si hay cambios reales (evita re-renders innecesarios)
            setAllOrders(prevOrders => {
              if (JSON.stringify(prevOrders.map(o => o.id).sort()) === 
                  JSON.stringify(activeOrders.map(o => o.id).sort())) {
                return prevOrders; // Sin cambios, no actualizar
              }
              return activeOrders;
            });
          } catch (error) {
          }
        }
      }, 15000); // Aumentamos a 15s para reducir carga
    };

    const stopRefresh = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    // Gestionar visibilidad de página
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopRefresh();
      } else {
        startRefresh();
      }
    };

    // Iniciar refresh y configurar listeners
    startRefresh();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      stopRefresh();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [step]); // Añadimos step como dependencia


  // Computed property para órdenes de la mesa actual
  const currentTableOrders = useMemo(() => {
    if (!selectedTable) return [];
    return allOrders.filter(order => {
      const orderTableId = order.table?.id || order.table || order.table_id;
      return orderTableId === selectedTable.id;
    });
  }, [allOrders, selectedTable]);

  // Cargar órdenes de mesa específica con items detallados (optimizado)
  const loadTableOrders = async (tableId) => {
    try {
      const orders = await apiService.tables.getActiveOrders(tableId);
      
      // Optimización: obtener IDs de órdenes sin items para hacer una sola llamada
      const orderIdsNeedingItems = (orders || [])
        .filter(order => !order.items || order.items.length === 0)
        .map(order => order.id);
      
      if (orderIdsNeedingItems.length === 0) {
        // Si todas las órdenes ya tienen items, usar las existentes
        setAllOrders(prevOrders => {
          const otherOrders = prevOrders.filter(order => {
            const orderTableId = order.table?.id || order.table || order.table_id;
            return orderTableId !== tableId;
          });
          return [...otherOrders, ...orders];
        });
        return;
      }

      // Cargar órdenes detalladas en lote (reduce N+1 queries)
      const detailedOrdersPromises = orderIdsNeedingItems.map(orderId => 
        apiService.orders.getById(orderId).catch(error => {
          return orders.find(o => o.id === orderId); // Fallback a la orden original
        })
      );
      
      const detailedOrders = await Promise.all(detailedOrdersPromises);
      
      // Combinar órdenes: las que ya tenían items + las detalladas
      const ordersWithItems = orders.map(order => {
        if (!order.items || order.items.length === 0) {
          return detailedOrders.find(detailed => detailed.id === order.id) || order;
        }
        return order;
      });
      
      // Actualizar allOrders con las órdenes detalladas de esta mesa
      setAllOrders(prevOrders => {
        const otherOrders = prevOrders.filter(order => {
          const orderTableId = order.table?.id || order.table || order.table_id;
          return orderTableId !== tableId;
        });
        return [...otherOrders, ...ordersWithItems];
      });
      
    } catch (error) {
      showToast(`Error al cargar pedidos de mesa: ${error.message}`, 'error');
    }
  };

  // Memoización optimizada: crear un Map de orders por table una sola vez
  const ordersByTable = useMemo(() => {
    const map = new Map();
    allOrders.forEach(order => {
      const orderTableId = order.table?.id || order.table || order.table_id;
      if (!map.has(orderTableId)) {
        map.set(orderTableId, []);
      }
      map.get(orderTableId).push(order);
    });
    return map;
  }, [allOrders]);

  // Obtener órdenes de una mesa (ahora O(1) en lugar de O(n))
  const getTableOrders = useCallback((tableId) => {
    return ordersByTable.get(tableId) || [];
  }, [ordersByTable]);

  // Estado de mesa optimizado
  const getTableStatus = useCallback((tableId) => {
    const orders = ordersByTable.get(tableId) || [];
    return orders.length > 0 ? 'occupied' : 'available';
  }, [ordersByTable]);

  // Resumen de mesa optimizado con un solo reduce
  const getTableSummary = useCallback((tableId) => {
    const orders = getTableOrders(tableId);
    if (orders.length === 0) return null;
    
    const summary = orders.reduce((acc, order) => ({
      orderCount: acc.orderCount + 1,
      totalAmount: acc.totalAmount + parseFloat(order.grand_total || order.total_amount || 0),
      totalItems: acc.totalItems + (order.items?.length || 0)
    }), { orderCount: 0, totalAmount: 0, totalItems: 0 });
    
    return summary;
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
    setIsCartOpen(false); // Cerrar carrito al crear nuevo pedido
    setStep('menu');
  };

  // Editar pedido existente
  const handleEditOrder = (order) => {
    setCurrentOrder(order);
    // CORRECCIÓN: No pre-llenar carrito con items existentes
    // El carrito debe empezar vacío para agregar NUEVOS items únicamente
    setCart([]);
    // NO abrir automáticamente - el usuario decide cuándo ver la lista
    setIsCartOpen(false);
    setStep('menu');
  };

  // Funciones para modal de notas
  const openNoteModal = (recipe) => {
    setSelectedRecipe(recipe);
    setNoteText('');
    setIsTakeaway(false);
    setIsNoteModalOpen(true);
  };

  const closeNoteModal = () => {
    setIsNoteModalOpen(false);
    setSelectedRecipe(null);
    setNoteText('');
    setIsTakeaway(false);
  };

  const handleAddWithNotes = () => {
    if (!selectedRecipe) return;
    
    const existingIndex = cart.findIndex(item => 
      item.recipe.id === selectedRecipe.id && 
      item.notes === noteText && 
      item.is_takeaway === isTakeaway
    );
    
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].total_price = newCart[existingIndex].unit_price * newCart[existingIndex].quantity;
      setCart(newCart);
    } else {
      let basePrice = parseFloat(selectedRecipe.price || selectedRecipe.base_price || 0);
      let containerPrice = 0;
      
      // Si es para llevar, agregar precio del contenedor
      if (isTakeaway && containers.length > 0) {
        // Usar el primer contenedor por defecto (puede mejorarse con selección)
        containerPrice = parseFloat(containers[0].price || 0);
      }
      
      const totalUnitPrice = basePrice + containerPrice;
      
      setCart([...cart, {
        recipe: selectedRecipe,
        quantity: 1,
        notes: noteText,
        is_takeaway: isTakeaway,
        unit_price: totalUnitPrice,
        total_price: totalUnitPrice,
        container_price: containerPrice
      }]);
    }
    
    closeNoteModal();
  };

  // Agregar al carrito con campo de precio consistente (función simple)
  const addToCart = (recipe) => {
    const existingIndex = cart.findIndex(item => 
      item.recipe.id === recipe.id && 
      item.notes === '' && 
      item.is_takeaway === false
    );
    
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].total_price = newCart[existingIndex].unit_price * newCart[existingIndex].quantity;
      setCart(newCart);
    } else {
      const price = parseFloat(recipe.price || recipe.base_price || 0);
      setCart([...cart, {
        recipe,
        quantity: 1,
        notes: '',
        is_takeaway: false,
        unit_price: price,
        total_price: price,
        container_price: 0
      }]);
    }
    
    // No abrir automáticamente - solo respuesta visual en el badge
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

  // Total del carrito (solo items nuevos)
  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.total_price, 0);
  };

  // Total del pedido existente (incluyendo envases)
  const getCurrentOrderTotal = () => {
    if (!currentOrder) return 0;
    // Usar grand_total si existe, sino calcular manualmente
    const grandTotal = currentOrder.grand_total;
    if (grandTotal && grandTotal > 0) {
      return parseFloat(grandTotal);
    }
    // Fallback: sumar total_amount + containers_total
    const totalAmount = parseFloat(currentOrder.total_amount || 0);
    const containersTotal = parseFloat(currentOrder.containers_total || 0);
    return totalAmount + containersTotal;
  };

  // Total completo (pedido existente + carrito)
  const getCompleteTotal = () => {
    return getCurrentOrderTotal() + getCartTotal();
  };

  // Eliminar pedido completo
  const handleDeleteOrder = async (order) => {
    if (!canDeleteOrder(order)) {
      showToast('No se puede eliminar: algunos items ya están en proceso', 'error');
      return;
    }

    const confirmed = window.confirm(`¿Estás seguro de eliminar el pedido #${order.id}?`);
    if (!confirmed) return;

    try {
      setSaving(true);
      await apiService.orders.delete(order.id);
      showToast('Pedido eliminado correctamente', 'success');
      loadTableOrders(selectedTable.id);
    } catch (error) {
      showToast('Error al eliminar pedido', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Procesar pago del pedido - Navegar a paso de pago
  const handleProcessPayment = (order) => {
    // Solo verificar que hay items SERVED para pago individual
    const servedItems = order.items.filter(item => item.status === 'SERVED');
    if (servedItems.length === 0) {
      showToast('No hay items listos para pago', 'error');
      return;
    }
    
    setSelectedOrderForPayment(order);
    // Resetear estados de pago
    setSelectedItems([]);
    setPaymentMethod('CASH');
    setPaymentDescription('');
    setWithPrinting(false);
    setBluetoothConnected(false);
    setConnectingBluetooth(false);
    setStep('payment');
  };

  // Manejar selección/deselección de items
  const handleItemSelection = (itemId) => {
    // Verificar que el item esté en estado SERVED y no esté ya pagado
    const item = selectedOrderForPayment.items.find(i => i.id === itemId);
    if (!item || item.status !== 'SERVED' || item.is_fully_paid) {
      showToast('Este item no está disponible para pago', 'error');
      return;
    }

    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  // Seleccionar/deseleccionar todos los items SERVED
  const handleSelectAllServedItems = () => {
    const servedItems = selectedOrderForPayment.items.filter(item => 
      item.status === 'SERVED' && !item.is_fully_paid
    );
    const allServedSelected = servedItems.every(item => selectedItems.includes(item.id));
    
    if (allServedSelected) {
      // Deseleccionar todos los SERVED
      setSelectedItems(prev => prev.filter(id => !servedItems.map(item => item.id).includes(id)));
    } else {
      // Seleccionar todos los SERVED no pagados
      const servedIds = servedItems.map(item => item.id);
      setSelectedItems(prev => [...new Set([...prev, ...servedIds])]);
    }
  };

  // Manejar conexión/desconexión Bluetooth
  const handleBluetoothToggle = async (enabled) => {
    if (enabled) {
      setConnectingBluetooth(true);
      try {
        if (!bluetoothPrinter.isBluetoothSupported()) {
          showToast(bluetoothPrinter.getBluetoothErrorMessage(), 'error');
          setWithPrinting(false);
          return;
        }

        await bluetoothPrinter.connect();
        setBluetoothConnected(true);
        showToast('Impresora Bluetooth conectada exitosamente', 'success');
      } catch (error) {
        setBluetoothConnected(false);
        setWithPrinting(false);
        showToast(`Error conectando impresora: ${error.message}`, 'error');
      } finally {
        setConnectingBluetooth(false);
      }
    } else {
      bluetoothPrinter.disconnect();
      setBluetoothConnected(false);
      showToast('Impresora Bluetooth desconectada', 'info');
    }
  };

  // Verificar si todos los items están pagados
  const areAllItemsPaid = (order) => {
    if (!order.items || order.items.length === 0) return false;
    return order.items.every(item => item.status === 'PAID' || item.is_fully_paid);
  };

  // Imprimir comprobante para items seleccionados
  const printSelectedItemsReceipt = async (paidItems) => {
    try {
      if (!bluetoothConnected) {
        await bluetoothPrinter.connect();
      }

      const receiptData = {
        order: {
          id: selectedOrderForPayment.id,
          table_number: selectedTable?.table_number,
          waiter: user?.username || user?.email || 'Usuario',
          created_at: selectedOrderForPayment.created_at,
          items: paidItems.map(item => ({
            recipe_name: item.recipe_name,
            quantity: item.quantity,
            total_price: parseFloat(item.total_with_container || item.total_price || 0).toFixed(2),
            is_takeaway: item.is_takeaway
          }))
        },
        payment: {
          created_at: new Date().toISOString()
        },
        amount: paidItems.reduce((sum, item) => sum + parseFloat(item.total_with_container || item.total_price || 0), 0)
      };

      await bluetoothPrinter.printPaymentReceipt(receiptData);
      showToast('Comprobante impreso exitosamente', 'success');
    } catch (error) {
      showToast(`Error al imprimir: ${error.message}`, 'error');
    }
  };

  // Imprimir comprobante completo del pedido
  const printFullReceipt = async () => {
    try {
      if (!bluetoothPrinter.isBluetoothSupported()) {
        showToast(bluetoothPrinter.getBluetoothErrorMessage(), 'error');
        return;
      }

      if (!bluetoothConnected) {
        await bluetoothPrinter.connect();
        setBluetoothConnected(true);
      }

      const allItems = selectedOrderForPayment.items;
      const receiptData = {
        order: {
          id: selectedOrderForPayment.id,
          table_number: selectedTable?.table_number,
          waiter: user?.username || user?.email || 'Usuario',
          created_at: selectedOrderForPayment.created_at,
          total_amount: selectedOrderForPayment.total_amount,
          items: allItems.map(item => ({
            recipe_name: item.recipe_name,
            quantity: item.quantity,
            total_price: parseFloat(item.total_with_container || item.total_price || 0).toFixed(2),
            is_takeaway: item.is_takeaway
          }))
        },
        payment: {
          created_at: new Date().toISOString()
        },
        amount: allItems.reduce((sum, item) => sum + parseFloat(item.total_with_container || item.total_price || 0), 0)
      };

      await bluetoothPrinter.printPaymentReceipt(receiptData);
      showToast('Comprobante completo impreso exitosamente', 'success');
    } catch (error) {
      showToast(`Error al imprimir comprobante completo: ${error.message}`, 'error');
    }
  };

  // Procesar pago de items seleccionados
  const handleProcessSelectedPayment = async () => {
    if (selectedItems.length === 0) {
      showToast('Debe seleccionar al menos un item para pagar', 'error');
      return;
    }

    // Validar que todos los items seleccionados sean válidos
    const invalidItems = selectedItems.filter(itemId => {
      const item = selectedOrderForPayment.items.find(i => i.id === itemId);
      return !item || item.status !== 'SERVED' || item.is_fully_paid;
    });

    if (invalidItems.length > 0) {
      showToast('Algunos items seleccionados no están disponibles para pago', 'error');
      return;
    }

    setPaymentProcessing(true);
    try {
      const paymentData = {
        payment_method: paymentMethod,
        payer_name: user?.username || user?.email || 'Usuario',
        notes: paymentDescription
      };

      // Procesar pago para cada item seleccionado secuencialmente para mejor manejo de errores
      const results = [];
      for (const itemId of selectedItems) {
        try {
          const result = await apiService.orderItems.processPayment(itemId, paymentData);
          results.push(result);
        } catch (itemError) {
          throw new Error(`Error en item ${itemId}: ${itemError.response?.data?.error || itemError.message}`);
        }
      }
      
      showToast(`Pago procesado exitosamente para ${selectedItems.length} item(s)`, 'success');
      
      // ACTUALIZACIÓN INMEDIATA - Forzar cambio visual antes de recargar backend
      const currentSelectedItems = [...selectedItems]; // Capturar los IDs antes de resetear
      
      setSelectedOrderForPayment(prevOrder => ({
        ...prevOrder,
        items: prevOrder.items.map(item => 
          currentSelectedItems.includes(item.id) 
            ? { ...item, status: 'PAID', is_fully_paid: true, paid_at: new Date().toISOString() }
            : item
        )
      }));
      
      // Resetear selección inmediatamente para limpiar los filtros
      setSelectedItems([]);
      
      // Si se seleccionó impresión, imprimir comprobante
      if (withPrinting && bluetoothConnected) {
        try {
          // Obtener los items que se acaban de pagar
          const paidItems = selectedOrderForPayment.items.filter(item => 
            currentSelectedItems.includes(item.id)
          );
          await printSelectedItemsReceipt(paidItems);
        } catch (printError) {
          showToast(`Error al imprimir: ${printError.message}`, 'error');
        }
      }
      
      // Recargar órdenes para reflejar cambios en el backend
      await loadTableOrders(selectedTable.id);
      
      // Actualizar la orden seleccionada para pago con los datos más recientes
      const updatedOrders = allOrders.filter(order => order.table === selectedTable.id);
      const updatedSelectedOrder = updatedOrders.find(order => order.id === selectedOrderForPayment.id);
      
      if (updatedSelectedOrder) {
        // Asegurar que los items pagados estén marcados correctamente
        const finalOrder = {
          ...updatedSelectedOrder,
          items: updatedSelectedOrder.items.map(item => 
            currentSelectedItems.includes(item.id) 
              ? { ...item, status: 'PAID', is_fully_paid: true, paid_at: item.paid_at || new Date().toISOString() }
              : item
          )
        };
        setSelectedOrderForPayment(finalOrder);
      } else {
        // Fallback: actualizar inmediatamente el estado local si no se encuentra la orden actualizada
        setSelectedOrderForPayment(prevOrder => ({
          ...prevOrder,
          items: prevOrder.items.map(item => 
            currentSelectedItems.includes(item.id) 
              ? { ...item, status: 'PAID', is_fully_paid: true, paid_at: new Date().toISOString() }
              : item
          )
        }));
      }
      
      // Resetear descripción
      setPaymentDescription('');
      
      return true;
    } catch (error) {
      
      // Manejo detallado de errores
      let errorMessage = 'Error desconocido al procesar pago';
      
      if (error.response) {
        // Error de respuesta del servidor
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 400) {
          errorMessage = data.error || data.message || 'Datos inválidos para el pago';
        } else if (status === 404) {
          errorMessage = 'Item no encontrado';
        } else if (status === 500) {
          errorMessage = 'Error interno del servidor';
        } else {
          errorMessage = data.error || data.message || `Error del servidor (${status})`;
        }
      } else if (error.request) {
        // Error de red
        errorMessage = 'Error de conexión con el servidor';
      } else {
        // Error de configuración
        errorMessage = error.message || 'Error de configuración';
      }
      
      showToast(`Error al procesar pago: ${errorMessage}`, 'error');
      return false;
    } finally {
      setPaymentProcessing(false);
    }
  };



  // Función unificada de mapeo de items del carrito
  const mapCartItemToOrderData = (item) => {
    const data = {
      recipe: item.recipe.id,
      quantity: item.quantity,
      notes: item.notes || '',
      is_takeaway: item.is_takeaway || false,
      has_taper: item.is_takeaway || false
    };
    
    // Si es para llevar y tenemos contenedores, agregar el primer contenedor
    if (item.is_takeaway && containers.length > 0) {
      data.selected_container = containers[0].id;
    }
    
    
    return data;
  };

  // Manejo especializado de errores
  const handleSaveOrderError = (error) => {
    
    if (error.response?.status === 400) {
      const errorDetails = error.response.data;
      if (errorDetails.details?.recipe) {
        showToast('Receta no válida o no disponible', 'error');
      } else if (errorDetails.details?.quantity) {
        showToast('Cantidad no válida', 'error');
      } else {
        showToast(errorDetails.error || 'Datos inválidos en el pedido', 'error');
      }
    } else if (error.response?.status === 404) {
      showToast('Pedido no encontrado', 'error');
    } else if (error.response?.status === 422) {
      showToast('No hay stock suficiente para el pedido', 'error');
    } else {
      showToast('Error al guardar pedido. Intente nuevamente.', 'error');
    }
  };

  // Guardar pedido optimizado
  const saveOrder = async () => {
    if (cart.length === 0) {
      showToast('Agregue items al pedido', 'error');
      return;
    }

    try {
      setSaving(true);
      
      if (currentOrder) {
        // Para órdenes existentes: usar add_item
        for (const item of cart) {
          const newItem = await apiService.orders.addItem(currentOrder.id, mapCartItemToOrderData(item));
          
          // Log de item creado (solo en desarrollo)
          if (import.meta.env.MODE === 'development') {
            console.log('🔔 Item creado por:', userRole, '- Item:', item.recipe.name);
          }
        }
        showToast('Items agregados al pedido', 'success');
      } else {
        // Para órdenes nuevas
        const newOrderData = {
          table: selectedTable.id,
          waiter: user?.username || 'Sistema',
          items: cart.map(mapCartItemToOrderData)
        };
        const newOrder = await apiService.orders.create(newOrderData);
        
        // Log de nuevo pedido creado (solo en desarrollo)
        if (import.meta.env.MODE === 'development') {
          console.log('🔔 Nuevo pedido creado por:', userRole, '- Items:', cart.length);
        }
        
        // Actualizar estado local eficientemente
        setAllOrders([...allOrders, newOrder]);
        showToast('Pedido creado', 'success');
      }

      // Recarga SOLO lo necesario
      await loadTableOrders(selectedTable.id);
      
      setCart([]);
      setCurrentOrder(null);
      setIsCartOpen(false); // Cerrar carrito después de guardar
      setStep('orders');
    } catch (error) {
      handleSaveOrderError(error);
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

  // Agrupar mesas por zona con manejo robusto
  const tablesByZone = useMemo(() => {
    return tables.reduce((acc, table) => {
      // Manejo robusto de diferentes estructuras de zona del backend
      const zoneName = table.zone?.name || table.zone_name || 'Sin Zona';
      if (!acc[zoneName]) acc[zoneName] = [];
      acc[zoneName].push(table);
      return acc;
    }, {});
  }, [tables]);

  // Crear un Map de estados de mesa para evitar recálculo en filtros
  const tableStatuses = useMemo(() => {
    const statusMap = new Map();
    tables.forEach(table => {
      const orders = ordersByTable.get(table.id) || [];
      statusMap.set(table.id, orders.length > 0 ? 'occupied' : 'available');
    });
    return statusMap;
  }, [tables, ordersByTable]);

  // Mesas filtradas por zona y estado (optimizado)
  const filteredTablesByZone = useMemo(() => {
    let filtered = { ...tablesByZone };
    
    // Filtro por zona (más eficiente)
    if (selectedZoneFilter !== 'todos') {
      const zoneData = filtered[selectedZoneFilter];
      filtered = zoneData ? { [selectedZoneFilter]: zoneData } : {};
    }
    
    // Filtro por estado de mesa (usando el Map precomputado)
    if (selectedStatusFilter !== 'todos') {
      const filteredEntries = Object.entries(filtered).map(([zoneName, zoneTables]) => {
        const filteredTables = zoneTables.filter(table => {
          const status = tableStatuses.get(table.id);
          return selectedStatusFilter === 'disponibles' ? status === 'available' : status === 'occupied';
        });
        return [zoneName, filteredTables];
      }).filter(([, tables]) => tables.length > 0); // Eliminar zonas vacías
      
      filtered = Object.fromEntries(filteredEntries);
    }
    
    return filtered;
  }, [tablesByZone, selectedZoneFilter, selectedStatusFilter, tableStatuses]);

  // Lista de zonas disponibles para el filtro
  const availableZones = useMemo(() => {
    return Object.keys(tablesByZone);
  }, [tablesByZone]);

  // Función para alternar carrito - DEBE estar antes de cualquier return condicional
  const toggleCart = useCallback(() => {
    setIsCartOpen(prev => !prev);
  }, []);

  // Helper para verificar si un item se puede eliminar
  const canDeleteItem = (item) => {
    return item.status === 'CREATED';
  };

  // Eliminar item individual del pedido existente
  const handleDeleteOrderItem = async (itemId) => {
    if (!currentOrder) return;

    const confirmed = window.confirm('¿Eliminar este item del pedido?');
    if (!confirmed) return;

    try {
      setSaving(true);
      await apiService.orderItems.delete(itemId);
      
      // Recargar el pedido actual para actualizar la lista
      const updatedOrder = await apiService.orders.getById(currentOrder.id);
      setCurrentOrder(updatedOrder);
      
      // También actualizar la lista general de órdenes
      await loadTableOrders(selectedTable.id);
      
      // Recargar datos para actualizar la vista de pedidos
      await loadInitialData();
      
      showToast('Item eliminado del pedido', 'success');
    } catch (error) {
      showToast('Error al eliminar item', 'error');
    } finally {
      setSaving(false);
    }
  };

  // TODOS los hooks deben estar antes de este return condicional
  if (loading && step === 'tables') {
    return <div className="flex justify-center items-center h-screen">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header responsive mejorado con breadcrumbs */}
      <div className="bg-white shadow-sm">
        <div className="px-3 sm:px-4 py-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <span className={step === 'tables' ? 'text-blue-600 font-medium' : ''}>
              Mesas
            </span>
            {step !== 'tables' && (
              <>
                <span>→</span>
                <span className={step === 'orders' ? 'text-blue-600 font-medium' : ''}>
                  Mesa {selectedTable?.table_number}
                </span>
              </>
            )}
            {step === 'menu' && (
              <>
                <span>→</span>
                <span className="text-blue-600 font-medium">
                  {currentOrder ? 'Agregar items' : 'Nuevo pedido'}
                </span>
              </>
            )}
            {step === 'payment' && (
              <>
                <span>→</span>
                <span className="text-blue-600 font-medium">
                  Procesar Pago
                </span>
              </>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <h1 className="text-base sm:text-lg font-bold truncate">
              {step === 'tables' && 'Seleccionar Mesa'}
              {step === 'orders' && 'Lista de Pedidos'}
              {step === 'menu' && (currentOrder ? `Pedido #${currentOrder.id}` : '')}
              {step === 'payment' && `Pagar Pedido #${selectedOrderForPayment?.id}`}
            </h1>
            
            {step !== 'tables' && (
              <button
                onClick={() => {
                  if (step === 'menu') {
                    setStep('orders');
                  } else if (step === 'payment') {
                    setStep('orders');
                    setSelectedOrderForPayment(null);
                    setSelectedItems([]);
                    setPaymentMethod('CASH');
                    setPaymentDescription('');
                    setWithPrinting(false);
                  } else {
                    setStep('tables');
                  }
                }}
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm"
              >
                ← Atrás
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4 pb-20">
        {/* VISTA MESAS */}
        {step === 'tables' && (
          <div className="space-y-4">
            
            {/* Filtros */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Filtro de Zona */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Zona</label>
                  <select
                    value={selectedZoneFilter}
                    onChange={(e) => setSelectedZoneFilter(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="todos">Todas las zonas</option>
                    {availableZones.map(zone => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                </div>
                
                {/* Filtro de Estado */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={selectedStatusFilter}
                    onChange={(e) => setSelectedStatusFilter(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="todos">Todas las mesas</option>
                    <option value="disponibles">Disponibles</option>
                    <option value="ocupadas">Ocupadas</option>
                  </select>
                </div>
                
              </div>
            </div>
            
            {Object.entries(filteredTablesByZone).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🏪</div>
                <p className="text-lg font-medium">No se encontraron mesas</p>
                <p className="text-sm">Intenta cambiar los filtros seleccionados</p>
              </div>
            ) : (
              Object.entries(filteredTablesByZone).map(([zoneName, zoneTables]) => (
                <div key={zoneName}>
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">{zoneName}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {zoneTables.map(table => {
                      const status = getTableStatus(table.id);
                      const summary = getTableSummary(table.id);
                      
                      // Determinar color basado en estado de items de los pedidos
                      const getTableButtonStyle = () => {
                        if (status === 'available' || !summary || summary.orderCount === 0) {
                          // Sin pedidos - Neutro
                          return 'bg-white border-gray-300 hover:bg-gray-50';
                        } 
                        
                        // Verificar el estado de todos los items de todos los pedidos de esta mesa
                        const tableOrders = getTableOrders(table.id);
                        let totalItems = 0;
                        let servedItems = 0;
                        
                        tableOrders.forEach(order => {
                          if (order.items && order.items.length > 0) {
                            totalItems += order.items.length;
                            servedItems += order.items.filter(item => item.status === 'SERVED').length;
                          }
                        });
                        
                        if (totalItems === 0) {
                          // No hay items - Neutro (mesa disponible)
                          return 'bg-white border-gray-300 hover:bg-gray-50';
                        } else if (servedItems === totalItems) {
                          // Todos los items están SERVED - Azul suave
                          return 'bg-blue-50 border-blue-300 hover:bg-blue-100';
                        } else {
                          // Algunos items pendientes - Rojo suave (necesita atención)
                          return 'bg-red-50 border-red-300 hover:bg-red-100';
                        }
                      };
                      
                      return (
                        <button
                          key={table.id}
                          onClick={() => handleTableSelect(table)}
                          className={`p-3 rounded border text-center ${getTableButtonStyle()}`}
                        >
                          <div className="font-bold">{table.table_number}</div>
                          {status === 'occupied' && summary && (
                            <div className="text-xs text-gray-600 mt-1">
                              {summary.orderCount} pedido{summary.orderCount > 1 ? 's' : ''}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* VISTA ÓRDENES */}
        {step === 'orders' && selectedTable && (
          <div className="space-y-4">
            {currentTableOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay pedidos activos
              </div>
            ) : (
              <div className="space-y-2">
                {currentTableOrders.map(order => (
                  <div key={order.id} className="bg-white border rounded p-3">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-sm">#{order.id}</span>
                        <span className="text-gray-500 text-sm">-</span>
                        <span className="text-gray-900 text-sm">
                          S/ {parseFloat(order.grand_total || order.total_amount || 0).toFixed(2)}
                        </span>
                        <span className="text-gray-500 text-sm">-</span>
                        <span className="text-gray-700 text-sm">
                          {order.waiter || 'Sin mesero'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditOrder(order)}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          title="Editar pedido"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        
                        {canDeleteOrder(order) && (
                          <button
                            onClick={() => handleDeleteOrder(order)}
                            disabled={saving}
                            className="w-8 h-8 flex items-center justify-center text-red-500 hover:text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Eliminar pedido"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                        
                        {canProcessPayment(order) && hasPermission('canManagePayments') && (
                          <button
                            onClick={() => handleProcessPayment(order)}
                            className="w-8 h-8 flex items-center justify-center text-green-600 hover:text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
                            title="Procesar pago"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* MOSTRAR ITEMS DEL PEDIDO */}
                    {order.items && order.items.length > 0 && (
                      <div className="border-t pt-2 mt-2">
                        <div className="space-y-1">
                          {order.items.map((item, index) => (
                            <div key={item.id || index} className="flex justify-between text-sm">
                              <div className="flex items-center space-x-2">
                                <div 
                                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    item.status === 'PAID' ? 'bg-gray-500' :
                                    item.status === 'SERVED' ? 'bg-blue-500' :
                                    item.status === 'PREPARING' ? 'bg-yellow-500' : 'bg-green-500'
                                  }`} 
                                  title={
                                    item.status === 'PAID' ? 'Pagado' :
                                    item.status === 'SERVED' ? 'Entregado' : 
                                    item.status === 'PREPARING' ? 'En Preparación' :
                                    item.status === 'CREATED' ? 'Pendiente' : 'Desconocido'
                                  }
                                />
                                <div className="flex items-center space-x-2 flex-1">
                                  <span className="text-gray-700">
                                    {item.recipe_name || item.recipe?.name} x{item.quantity}
                                    {item.notes && (
                                      <span className="text-gray-500 italic ml-1">({item.notes})</span>
                                    )}
                                  </span>
                                  {item.is_takeaway && (
                                    <div className="flex items-center bg-orange-100 text-orange-600 p-1 rounded-full" title="Para llevar">
                                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span className="text-gray-600">
                                S/ {parseFloat(item.total_with_container || item.total_price || 0).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Botón flotante "Nuevo Pedido" */}
            <div className="fixed bottom-4 right-4 z-40">
              <button
                onClick={handleCreateNewOrder}
                className="w-14 h-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white transform hover:scale-110 transition-all duration-300 flex items-center justify-center"
                title="Nuevo Pedido"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
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

            {/* Filtro de grupo */}
            <div className="mb-4">
              <select
                value={selectedGroup || ''}
                onChange={(e) => setSelectedGroup(e.target.value || null)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos los grupos</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Lista de recetas */}
            <div className="space-y-2 mb-20">
              {filteredRecipes.map(recipe => (
                <div key={recipe.id} className="bg-white border rounded p-3">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="font-semibold">{recipe.name}</div>
                      <div className="text-sm text-gray-600">
                        S/ {recipe.price || recipe.base_price || '0.00'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openNoteModal(recipe)}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700 border border-gray-600 rounded hover:bg-gray-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => addToCart(recipe)}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700 border border-gray-600 rounded hover:bg-gray-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Carrito flotante responsive con panel lateral */}
            <div className="fixed bottom-4 right-4 z-50">
              {/* Ícono del carrito siempre visible */}
              <div className="relative">
                <button
                  onClick={toggleCart}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center ${
                    cart.length > 0 || currentOrder
                      ? 'bg-blue-600 hover:bg-blue-700 text-white transform hover:scale-110' 
                      : 'bg-gray-300 text-gray-500'
                  }`}
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 1.5M7 13l-1.5 1.5M16.5 14.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm-9.75 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  </svg>
                  
                  {/* Badge con cantidad total */}
                  {(() => {
                    // Sumar cantidades del carrito (items pendientes)
                    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
                    // Contar items existentes del pedido
                    const orderCount = currentOrder?.items?.length || 0;
                    const totalCount = cartCount + orderCount;
                    
                    return totalCount > 0 && (
                      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center">
                        {totalCount}
                      </div>
                    );
                  })()}
                </button>
              </div>
            </div>

            {/* Panel lateral del carrito */}
            {isCartOpen && (
              <>
                {/* Overlay */}
                <div 
                  className="fixed inset-0 bg-black bg-opacity-50 z-40"
                  onClick={toggleCart}
                />
                
                {/* Panel lateral deslizante */}
                <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col">
                  {/* Header del panel lateral */}
                  <div className="bg-gray-50 px-4 py-4 border-b flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 flex items-center justify-center">
                        <h2 className="text-lg font-semibold text-gray-800">
                          {currentOrder ? `Pedido #${currentOrder.id}` : 'Nuevo Pedido'}
                        </h2>
                      </div>
                      <button
                        onClick={toggleCart}
                        className="text-gray-600 hover:text-gray-800 p-2 hover:bg-gray-100 rounded-full transition-colors"
                        title="Cerrar panel"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Lista unificada de todos los items */}
                  <div className="flex-1 flex flex-col min-h-0">
                    {((currentOrder && currentOrder.items && currentOrder.items.length > 0) || cart.length > 0) ? (
                      <div className="flex-1 overflow-y-auto">
                        {/* Items existentes del pedido */}
                        {currentOrder && currentOrder.items && currentOrder.items.map((item, index) => (
                          <div key={`existing-${item.id || index}`} className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              {/* Estado del item */}
                              <div 
                                className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                  item.status === 'PAID' ? 'bg-gray-500' :
                                  item.status === 'SERVED' ? 'bg-blue-500' :
                                  item.status === 'PREPARING' ? 'bg-yellow-500' : 'bg-green-500'
                                }`} 
                                title={
                                  item.status === 'PAID' ? 'Pagado' :
                                  item.status === 'SERVED' ? 'Entregado' : 
                                  item.status === 'PREPARING' ? 'En Preparación' :
                                  item.status === 'CREATED' ? 'Pendiente' : 'Desconocido'
                                }
                              />
                              
                              {/* Info del item */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-medium text-gray-900 truncate">
                                    {item.recipe_name || item.recipe?.name}
                                  </h4>
                                  {item.is_takeaway && (
                                    <div className="flex items-center bg-orange-100 text-orange-600 p-1.5 rounded-full" title="Para llevar">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">
                                  x{item.quantity} • S/ {parseFloat(item.total_with_container || item.total_price || 0).toFixed(2)}
                                  {item.notes && (
                                    <span className="text-blue-600 italic ml-1">• {item.notes}</span>
                                  )}
                                </p>
                              </div>
                              
                              {/* Botón eliminar solo si está CREATED */}
                              {canDeleteItem(item) && (
                                <button
                                  onClick={() => handleDeleteOrderItem(item.id)}
                                  disabled={saving}
                                  className="w-7 h-7 bg-red-50 hover:bg-red-100 text-red-500 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {/* Items nuevos en carrito */}
                        {cart.map((item, index) => (
                          <div key={`cart-${index}`} className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              {/* Indicador de nuevo item */}
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0 bg-blue-500" 
                                title="Nuevo item"
                              />
                              
                              {/* Info del item */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-medium text-gray-900 truncate">
                                    {item.recipe.name}
                                  </h4>
                                  {item.is_takeaway && (
                                    <div className="flex items-center bg-orange-100 text-orange-600 p-1.5 rounded-full" title="Para llevar">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">
                                  x{item.quantity} • S/ {(item.unit_price * item.quantity).toFixed(2)}
                                  {item.notes && (
                                    <span className="text-blue-600 italic ml-1">• {item.notes}</span>
                                  )}
                                </p>
                              </div>
                              
                              {/* Botón eliminar */}
                              <div className="flex items-center">
                                <button
                                  onClick={() => removeFromCart(index)}
                                  className="w-7 h-7 bg-red-50 hover:bg-red-100 text-red-500 rounded-full flex items-center justify-center transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 1.5M7 13l-1.5 1.5M16.5 14.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm-9.75 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                          </svg>
                          <p className="text-sm">El carrito está vacío</p>
                          <p className="text-xs mt-1">Agrega items desde el menú</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer con total y botón de acción - Estilo negro minimalista */}
                  <div className="p-4 bg-gray-50 flex-shrink-0">
                    {/* Total con estilo minimalista */}
                    <div className="bg-gray-50 rounded-xl p-3 mb-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total</span>
                        <span className="text-lg font-semibold text-gray-900">
                          S/ {getCompleteTotal().toFixed(2)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Botón de acción estilo negro */}
                    {cart.length > 0 && (
                      <button
                        onClick={saveOrder}
                        disabled={saving}
                        className={`w-full py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 font-medium text-sm ${
                          !saving
                            ? 'bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-700'
                            : 'bg-gray-700 text-gray-400'
                        } disabled:opacity-50`}
                      >
                        {saving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            <span>Guardando...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{currentOrder ? 'Actualizar Pedido' : 'Crear Pedido'}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* VISTA PAGO */}
        {step === 'payment' && selectedOrderForPayment && (
          <div className="space-y-3">
            {/* Información del pedido minimalista */}
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-gray-900">
                Pedido #{selectedOrderForPayment.id} - Mesa {selectedTable?.table_number}
              </span>
              <span className="text-gray-600">
                Total: S/ {selectedOrderForPayment.items
                  ?.reduce((sum, item) => sum + parseFloat(item.total_with_container || item.total_price || 0), 0)
                  .toFixed(2) || '0.00'}
              </span>
            </div>

            {/* Lista de items minimalista */}
            <div className="bg-white border border-gray-200">
              {selectedOrderForPayment.items.filter(item => item.status === 'SERVED' && !item.is_fully_paid).length > 0 && (
                <div className="p-2 border-b bg-gray-50 flex justify-between items-center">
                  <span className="text-xs text-gray-600">Seleccionar para pago</span>
                  <button
                    onClick={handleSelectAllServedItems}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    {selectedOrderForPayment.items
                      .filter(item => item.status === 'SERVED' && !item.is_fully_paid)
                      .every(item => selectedItems.includes(item.id))
                      ? 'Deseleccionar' 
                      : 'Seleccionar todos'
                    }
                  </button>
                </div>
              )}

              <div className="divide-y">
                {/* Items SERVED (disponibles para pago) */}
                {selectedOrderForPayment.items
                  .filter(item => item.status === 'SERVED' && !item.is_fully_paid)
                  .map(item => (
                    <div key={item.id} className="p-2 hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => handleItemSelection(item.id)}
                          className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                        />
                        <div 
                          className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" 
                          title="Entregado"
                        />
                        <div className="flex-1 min-w-0 flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 truncate">
                              {item.quantity}x {item.recipe_name}
                              {item.is_takeaway && (
                                <span className="text-xs text-blue-600 ml-1">(para llevar)</span>
                              )}
                            </div>
                            {item.notes && (
                              <div className="text-xs text-gray-500 italic truncate">{item.notes}</div>
                            )}
                          </div>
                          <div className="text-sm font-medium text-gray-900 ml-2">
                            S/ {parseFloat(item.total_with_container || item.total_price || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                }

                {/* Items ya PAID (bloqueados) */}
                {selectedOrderForPayment.items
                  .filter(item => item.status === 'PAID' || item.is_fully_paid)
                  .map(item => (
                    <div key={item.id} className="p-2 bg-gray-50 opacity-70">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled
                          checked={false}
                          className="h-3 w-3 text-gray-400 border-gray-300 rounded opacity-50 cursor-not-allowed"
                        />
                        <div 
                          className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0" 
                          title="Pagado"
                        />
                        <div className="flex-1 min-w-0 flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-600 truncate">
                              {item.quantity}x {item.recipe_name}
                              {item.is_takeaway && (
                                <span className="text-xs text-blue-600 ml-1">(para llevar)</span>
                              )}
                            </div>
                            {item.notes && (
                              <div className="text-xs text-gray-500 italic truncate">{item.notes}</div>
                            )}
                          </div>
                          <div className="text-sm font-medium text-gray-600 ml-2">
                            S/ {parseFloat(item.total_with_container || item.total_price || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                }

                {/* Items PREPARING (no disponibles) */}
                {selectedOrderForPayment.items
                  .filter(item => item.status === 'PREPARING')
                  .map(item => (
                    <div key={item.id} className="p-2 bg-gray-50 opacity-60">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled
                          checked={false}
                          className="h-3 w-3 text-gray-400 border-gray-300 rounded opacity-50 cursor-not-allowed"
                        />
                        <div 
                          className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" 
                          title="En Preparación"
                        />
                        <div className="flex-1 min-w-0 flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-600 truncate">
                              {item.quantity}x {item.recipe_name}
                              {item.is_takeaway && (
                                <span className="text-xs text-blue-600 ml-1">(para llevar)</span>
                              )}
                            </div>
                            {item.notes && (
                              <div className="text-xs text-gray-500 italic truncate">{item.notes}</div>
                            )}
                          </div>
                          <div className="text-sm font-medium text-gray-600 ml-2">
                            S/ {parseFloat(item.total_with_container || item.total_price || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                }

                {/* Items CREATED (no disponibles) */}
                {selectedOrderForPayment.items
                  .filter(item => item.status === 'CREATED')
                  .map(item => (
                    <div key={item.id} className="p-2 bg-gray-50 opacity-60">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled
                          checked={false}
                          className="h-3 w-3 text-gray-400 border-gray-300 rounded opacity-50 cursor-not-allowed"
                        />
                        <div 
                          className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" 
                          title="Pendiente"
                        />
                        <div className="flex-1 min-w-0 flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-600 truncate">
                              {item.quantity}x {item.recipe_name}
                              {item.is_takeaway && (
                                <span className="text-xs text-blue-600 ml-1">(para llevar)</span>
                              )}
                            </div>
                            {item.notes && (
                              <div className="text-xs text-gray-500 italic truncate">{item.notes}</div>
                            )}
                          </div>
                          <div className="text-sm font-medium text-gray-600 ml-2">
                            S/ {parseFloat(item.total_with_container || item.total_price || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>

              {selectedOrderForPayment.items.filter(item => item.status === 'SERVED' && !item.is_fully_paid).length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  {selectedOrderForPayment.items.filter(item => item.is_fully_paid).length > 0 
                    ? 'Todos los items disponibles ya han sido pagados'
                    : 'No hay items listos para pago'
                  }
                </div>
              )}
            </div>

            {/* Configuración de pago minimalista */}
            {selectedItems.length > 0 && (
              <div className="bg-white border border-gray-200 p-3 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{selectedItems.length} item(s)</span>
                  <span className="font-medium text-gray-900">
                    S/ {selectedOrderForPayment.items
                      .filter(item => selectedItems.includes(item.id))
                      .reduce((sum, item) => sum + parseFloat(item.total_with_container || item.total_price || 0), 0)
                      .toFixed(2)
                    }
                  </span>
                </div>

                {/* Método de pago */}
                <div>
                  <div className="flex gap-1">
                    {[
                      { value: 'CASH', label: 'Efectivo' },
                      { value: 'CARD', label: 'Tarjeta' },
                      { value: 'YAPE_PLIN', label: 'Yape' },
                      { value: 'TRANSFER', label: 'Transfer' }
                    ].map(method => (
                      <button
                        key={method.value}
                        onClick={() => setPaymentMethod(method.value)}
                        className={`flex-1 py-1 px-2 text-xs border ${
                          paymentMethod === method.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descripción/Notas minimalista */}
                <div>
                  <input
                    type="text"
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 focus:border-blue-500 outline-none"
                    placeholder="Notas adicionales..."
                  />
                </div>

                {/* Opciones minimalistas */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="withPrinting"
                      checked={withPrinting}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setWithPrinting(checked);
                        handleBluetoothToggle(checked);
                      }}
                      disabled={connectingBluetooth}
                      className="h-3 w-3 text-blue-600 border-gray-300 disabled:opacity-50"
                    />
                    <label htmlFor="withPrinting" className="text-gray-700">
                      Imprimir
                    </label>
                    {/* Estado de conexión Bluetooth */}
                    {withPrinting && (
                      <span className="text-xs">
                        {connectingBluetooth ? (
                          <span className="text-yellow-600">Conectando...</span>
                        ) : bluetoothConnected ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-red-600">✗</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Botón procesar pago */}
                <button
                  onClick={handleProcessSelectedPayment}
                  disabled={paymentProcessing}
                  className="w-full bg-green-600 text-white py-2 px-3 text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {paymentProcessing ? 'Procesando...' : 'Procesar Pago'}
                </button>
              </div>
            )}

            {/* Botón imprimir comprobante completo cuando todo está pagado */}
            {areAllItemsPaid(selectedOrderForPayment) && (
              <div className="mt-2">
                <button
                  onClick={printFullReceipt}
                  className="w-full bg-blue-600 text-white py-2 px-3 text-sm hover:bg-blue-700"
                >
                  Imprimir Comprobante Completo
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal ultra-minimalista para móviles */}
      {isNoteModalOpen && (
        <>
          {/* Overlay optimizado */}
          <div 
            className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
            onClick={closeNoteModal}
          />
          
          {/* Modal responsive */}
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-sm mx-auto rounded-t-3xl sm:rounded-2xl shadow-2xl transform transition-all duration-300 ease-out">
              {/* Header ultra-compacto */}
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                  {selectedRecipe?.name}
                </h3>
                <button
                  onClick={closeNoteModal}
                  className="p-2 -m-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content compacto */}
              <div className="px-4 py-4 space-y-4">
                {/* Campo de notas optimizado para móvil */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Comentario
                  </label>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Ej: Sin cebolla, extra salsa..."
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent transition-all"
                    rows="2"
                    style={{
                      fontSize: '16px', // Prevent zoom on iOS
                      WebkitAppearance: 'none',
                      minHeight: '60px'
                    }}
                  />
                </div>

                {/* Para llevar compacto */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-800">Para llevar</span>
                    {containers.length > 0 && isTakeaway && (
                      <span className="text-xs text-gray-500 ml-2">+S/{containers[0].price || 0}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setIsTakeaway(!isTakeaway)}
                    className={`relative w-10 h-6 rounded-full transition-all duration-200 ${
                      isTakeaway ? 'bg-gray-800' : 'bg-gray-200'
                    }`}
                  >
                    <div
                      className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                        isTakeaway ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Precio minimalista */}
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total</span>
                    <span className="text-lg font-semibold text-gray-900">
                      S/ {(
                        parseFloat(selectedRecipe?.price || selectedRecipe?.base_price || 0) +
                        (isTakeaway && containers.length > 0 ? parseFloat(containers[0].price || 0) : 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones optimizados para móvil */}
              <div className="px-4 pb-4 pt-2">
                <div className="flex gap-2">
                  <button
                    onClick={closeNoteModal}
                    className="flex-1 py-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 active:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddWithNotes}
                    className="flex-1 py-3 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-800 active:bg-gray-700 transition-colors"
                  >
                    Agregar
                  </button>
                </div>
                {/* Safe area para móviles */}
                <div className="h-2 sm:hidden" />
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
};

export default TableOrderEcommerce;