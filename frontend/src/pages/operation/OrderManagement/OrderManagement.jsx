import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { apiService } from '../../../services/api';
import { ArrowLeft, Home, ShoppingBag, Trash2 } from 'lucide-react';

// Hooks personalizados
import { useTableOrders } from './hooks/useTableOrders';
import { useCart } from './hooks/useCart';
import { usePayment } from './hooks/usePayment';

// Componentes
import OrderMenuCatalog from './components/OrderMenuCatalog';
import OrderShoppingCartContainer from './components/ShoppingCart/OrderShoppingCartContainer';

// Utilidades
import { 
  getItemStatusColor, 
  canCancelItem,
  canDeleteOrder, 
  canProcessPayment,
  canCloseOrder,
  filterActiveItems,
  filterActiveOrders
} from './utils/orderHelpers';
import { validateTakeawayContainer, validateOrder } from './utils/validations';

const OrderManagement = () => {
  
  // Simple mounting reference for polling
  const mountRef = useRef(false);
  useEffect(() => {
    mountRef.current = true;
    return () => {
      mountRef.current = false;
    };
  }, []);
  
  const { user, userRole, hasPermission } = useAuth();
  const { showToast } = useToast();

  // Estados agrupados para mejor rendimiento
  const [orderState, setOrderState] = useState({
    step: 'zones', // 'zones', 'tables', 'menu' - No hay payment aquí
    selectedZone: null,
    saving: false,
    isCartOpen: false
  });
  
  
  // Actualizar título del documento según el paso actual
  useEffect(() => {
    const titles = {
      zones: 'Seleccionar Zona',
      tables: 'Seleccionar Mesa',
      menu: 'Gestión de Pedido'
    };
    document.title = `${titles[orderState.step] || 'Gestión de Pedidos'} | Restaurant`;
  }, [orderState.step]);
  
  
  // Estados para datos del menú (menos volátiles)
  const [menuData, setMenuData] = useState({
    recipes: [],
    groups: [],
    containers: []
  });
  
  // Estados para modales (agrupados)
  const [modals, setModals] = useState({
    // Modal de notas
    isNoteModalOpen: false,
    selectedRecipe: null,
    noteText: '',
    isTakeaway: false,
    // Modal de cancelación
    isCancelModalOpen: false,
    cancelTarget: null, // {type: 'order'|'item', id: number}
    cancelReason: ''
  });

  // Hooks personalizados
  const orderTableHook = useTableOrders(showToast);
  const orderCartHook = useCart();
  const orderPaymentHook = usePayment(showToast);

  // Simple loading state
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Estado para detectar conectividad de internet
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Estado de la impresora de etiquetas HTTP (Dev-Prod parity)

  // Detectar cambios en la conectividad de internet
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('🌐 Conexión a internet restaurada', 'success');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      showToast('⚠️ Sin conexión a internet', 'error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  // Load only essential data initially - defer menu data loading
  useEffect(() => {
    if (!orderTableHook.loadInitialData) {
      return; // Esperar hasta que el hook esté listo
    }
    
    const loadMinimalData = async () => {
      try {
        // Load just tables first - defer heavy data
        await orderTableHook.loadInitialData();
        setInitialLoading(false);
      } catch (error) {
        showToast('Error al cargar datos iniciales', 'error');
        setInitialLoading(false);
      }
    };

    loadMinimalData();
  }, [orderTableHook.loadInitialData, showToast]); // Dependencia del método para asegurar que está disponible

  // Load menu data when needed (lazy loading)
  const loadMenuData = useCallback(async () => {
    try {
      const [recipesData, groupsData, containersData] = await Promise.all([
        apiService.recipes.getAll({ is_active: true, is_available: true }),
        apiService.groups.getAll(),
        apiService.containers.getAll()
      ]);
      
      setMenuData({
        recipes: recipesData || [],
        groups: groupsData || [],
        containers: containersData || []
      });
    } catch (error) {
      // Silently handle error
    }
  }, []);

  // Simple polling for zones and tables view
  useEffect(() => {
    if (!['zones', 'tables'].includes(orderState.step)) {
      return;
    }
    
    const interval = setInterval(async () => {
      if (mountRef.current && !orderState.saving) {
        try {
          await orderTableHook.loadDataSilently();
        } catch (error) {
          // Silently handle error
        }
      }
    }, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [orderState.step, orderState.saving]); // ✅ Removido orderTableHook de dependencias

  // Navegación optimizada - solo cambiar estado sin recargas innecesarias
  const navigateToStep = useCallback((newStep, stateUpdate = {}) => {
    setOrderState(prev => ({ 
      ...prev, 
      step: newStep,
      ...stateUpdate 
    }));
  }, []);

  // Cargar datos específicos solo cuando sea necesario
  const loadDataIfNeeded = useCallback(async (dataType, force = false) => {
    switch (dataType) {
      case 'zones':
        // Solo recargar si no tenemos datos o se fuerza
        if (!orderTableHook.tables || orderTableHook.tables.length === 0 || force) {
          await orderTableHook.loadInitialData();
        }
        break;
      case 'menu':
        // Solo cargar menú si no lo tenemos
        if (menuData.recipes.length === 0 || force) {
          await loadMenuData();
        }
        break;
      default:
        break;
    }
  }, [orderTableHook, menuData.recipes.length, loadMenuData]);

  // Handlers para navegación
  const handleZoneSelect = useCallback(async (zone) => {
    // Navegación inmediata para mejor UX
    navigateToStep('tables', { 
      selectedZone: zone, 
      isCartOpen: false 
    });
    
    // Cargar órdenes activas en segundo plano si es necesario
    try {
      await orderTableHook.loadActiveOrders();
    } catch (error) {
      // Silently handle error
    }
  }, [navigateToStep, orderTableHook]);

  const handleTableSelect = useCallback(async (table) => {
    // Navegación inmediata para mejor UX
    navigateToStep('menu', { isCartOpen: false });
    
    // Configurar mesa seleccionada inmediatamente
    orderTableHook.setSelectedTable(table);
    
    // Cargar datos en paralelo para mejor rendimiento
    const promises = [
      orderTableHook.loadTableOrders(table.id),
      loadDataIfNeeded('menu') // Solo cargar menú si no lo tenemos
    ];
    
    try {
      await Promise.all(promises);
      
      // Verificar si la mesa tiene un pedido activo para cargarlo automáticamente
      const existingOrders = orderTableHook.getTableOrders(table.id);
      
      console.log('🔍 [ORDER-MANAGEMENT] Orders encontradas para mesa', table.id, ':', existingOrders);
      
      if (existingOrders.length > 0) {
        // Mesa tiene pedido activo - cargar para edición
        const activeOrder = existingOrders[0];
        console.log('🔍 [ORDER-MANAGEMENT] Cargando order activa:', {
          id: activeOrder.id,
          customer_name: activeOrder.customer_name,
          party_size: activeOrder.party_size,
          status: activeOrder.status,
          fullOrder: activeOrder
        });
        orderCartHook.setCurrentOrder(activeOrder);
        orderCartHook.clearCart(); // Limpiar carrito para mostrar solo los items del pedido existente
      } else {
        // Mesa vacía - preparar para nuevo pedido
        console.log('🔍 [ORDER-MANAGEMENT] Mesa vacía, preparando para nuevo pedido');
        orderCartHook.setCurrentOrder(null);
        orderCartHook.clearCart();
      }
    } catch (error) {
      showToast(`Error al cargar datos de la mesa: ${error.message}`, 'error');
    }
  }, [navigateToStep, orderTableHook, orderCartHook, loadDataIfNeeded]);

  const handleBackToZones = useCallback(() => {
    // Navegación inmediata sin recargas innecesarias
    navigateToStep('zones', { 
      selectedZone: null, 
      isCartOpen: false 
    });
  }, [navigateToStep]);




  // Handlers para carrito
  const handleAddToCart = useCallback((recipe) => {
    console.log('[ORDER-LOG] 📝 Agregando item al carrito:', {
      recipe: recipe.name,
      recipeId: recipe.id,
      tableNumber: orderTableHook.selectedTable?.table_number,
      tableId: orderTableHook.selectedTable?.id,
      currentCartSize: orderCartHook.cart.length,
      hasCurrentOrder: !!orderCartHook.currentOrder,
      timestamp: new Date().toISOString()
    });
    
    orderCartHook.addToCart(recipe, '', false, 0, null); // Parámetros explícitos para evitar confusión
    showToast(`✅ ${recipe.name} agregado al carrito (Mesa ${orderTableHook.selectedTable?.table_number || '?'})`, 'success', 1000);
    
    // Reproducir sonido de agregar al carrito
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzKJ0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwiBzKJ0fLNeSsF')
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ignorar errores si no se puede reproducir
    } catch (error) {
      // Ignorar errores de audio
    }
  }, [orderCartHook, showToast]);

  const openNoteModal = useCallback((recipe) => {
    setModals(prev => ({
      ...prev,
      selectedRecipe: recipe,
      noteText: '',
      isTakeaway: false,
      isNoteModalOpen: true
    }));
  }, []);

  const closeNoteModal = useCallback(() => {
    setModals(prev => ({
      ...prev,
      isNoteModalOpen: false,
      selectedRecipe: null,
      noteText: '',
      isTakeaway: false
    }));
  }, []);

  const handleAddWithNotes = useCallback(() => {
    if (!modals.selectedRecipe) return;
    
    let containerPrice = 0;
    
    // Validar si es para llevar
    let containerId = null;
    if (modals.isTakeaway) {
      const validation = validateTakeawayContainer(modals.selectedRecipe, menuData.containers);
      if (!validation.isValid) {
        showToast(validation.message, 'error');
        return;
      }
      containerPrice = parseFloat(validation.container.price || 0);
      containerId = validation.container.id;
    }
    
    orderCartHook.addToCart(modals.selectedRecipe, modals.noteText, modals.isTakeaway, containerPrice, containerId);
    showToast(`✅ ${modals.selectedRecipe.name} ${modals.isTakeaway ? '(Para llevar)' : '(Para mesa)'} agregado al carrito`, 'success', 1000);
    
    // Reproducir sonido de agregar al carrito
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzKJ0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwiBzKJ0fLNeSsF')
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ignorar errores si no se puede reproducir
    } catch (error) {
      // Ignorar errores de audio
    }
    
    closeNoteModal();
  }, [modals.selectedRecipe, modals.noteText, modals.isTakeaway, menuData.containers, orderCartHook, showToast, closeNoteModal]);

  // Handler para cerrar pedido (cambiar items PREPARING a SERVED)
  const handleCloseOrder = useCallback(async (orderId) => {
    console.log('🟣 [ORDER-MANAGEMENT] handleCloseOrder LLAMADO:', {
      orderId,
      currentOrderId: orderCartHook.currentOrder?.id,
      currentOrderStatus: orderCartHook.currentOrder?.status,
      saving: orderState.saving,
      timestamp: new Date().toISOString()
    });
    
    try {
      console.log('🟣 [ORDER-MANAGEMENT] Iniciando actualización de estado del pedido a SERVED...');
      setOrderState(prev => ({ ...prev, saving: true }));
      
      console.log('🟣 [ORDER-MANAGEMENT] Llamando apiService.orders.updateStatus con orderId:', orderId);
      const response = await apiService.orders.updateStatus(orderId, 'SERVED');
      console.log('🟣 [ORDER-MANAGEMENT] Respuesta de updateStatus:', response);
      
      showToast(`🍽️ Pedido #${orderId} servido y listo para cobrar`, 'success');
      console.log('🟣 [ORDER-MANAGEMENT] Toast de éxito mostrado');
      
      // Clean up and navigate
      console.log('🟣 [ORDER-MANAGEMENT] Limpiando estado...');
      orderCartHook.setCurrentOrder(null);
      orderCartHook.clearCart();
      orderTableHook.setSelectedTable(null);
      console.log('🟣 [ORDER-MANAGEMENT] Estado limpiado');
      
      // Navegación optimizada sin recargas innecesarias
      console.log('🟣 [ORDER-MANAGEMENT] Navegando a vista de zonas...');
      navigateToStep('zones', { 
        selectedZone: null, 
        isCartOpen: false 
      });
      console.log('🟣 [ORDER-MANAGEMENT] Navegación completada');
      
      // Los datos se actualizarán automáticamente con el polling de 15s
      // No es necesario recargar manualmente
      
    } catch (error) {
      console.error('❌ [ORDER-MANAGEMENT] Error al cerrar pedido:', error);
      console.error('❌ [ORDER-MANAGEMENT] Error response:', error.response?.data);
      console.error('❌ [ORDER-MANAGEMENT] Error status:', error.response?.status);
      showToast(`❌ Error al cerrar pedido #${orderId}: ${error.message}`, 'error');
    } finally {
      console.log('🟣 [ORDER-MANAGEMENT] Finalizando handleCloseOrder, estableciendo saving=false');
      setOrderState(prev => ({ ...prev, saving: false }));
    }
  }, [showToast, orderTableHook, orderCartHook, navigateToStep, orderState.saving]);

  // Handler para guardar pedido (optimizado)
  const handleSaveOrder = useCallback(async (orderInfo = {}) => {
    console.log('[ORDER-LOG] 💾 Iniciando guardado de orden:', {
      isAutoNavigate: !!orderInfo._autoNavigate,
      cartItems: orderCartHook.cart.length,
      currentOrder: orderCartHook.currentOrder?.id,
      table: orderTableHook.selectedTable?.table_number,
      customerInfo: {
        name: orderInfo.customerName,
        partySize: orderInfo.partySize
      },
      timestamp: new Date().toISOString()
    });
    
    // Auto-navigation flow
    if (!orderInfo._autoNavigate) {
      const validation = validateOrder(orderCartHook.cart, orderTableHook.selectedTable);
      if (!validation.isValid) {
        console.log('[ORDER-LOG] ❌ Validación fallida:', validation.message);
        showToast(validation.message, 'error');
        return;
      }
    }

    try {
      setOrderState(prev => ({ ...prev, saving: true }));
      
      // Si es navegación automática, saltear validación de carrito y ir directo a navegación
      if (orderInfo._autoNavigate) {
        // Limpiar carrito al final del flujo completo
        orderCartHook.clearCart();
        orderCartHook.setCurrentOrder(null);
        orderTableHook.setSelectedTable(null);
        
        // Navegación optimizada
        navigateToStep('zones', { 
          selectedZone: null, 
          isCartOpen: false 
        });
        
        showToast('✅ Pedido actualizado exitosamente. Items enviados a impresión.', 'success');
        return;
      }
      
      // Check cart has items for new orders
      if (orderCartHook.cart.length === 0) {
        showToast('El carrito está vacío', 'error');
        setOrderState(prev => ({ ...prev, saving: false }));
        return;
      }
      
      let createdOrder = null;
      let itemsProcessedCount = orderCartHook.cart.length;
      
      // Distinguir entre crear nuevo pedido vs agregar items a pedido existente
      if (orderCartHook.currentOrder && orderCartHook.currentOrder.id) {
        // ACTUALIZAR PEDIDO EXISTENTE - Agregar nuevos items usando addItem
        console.log('[ORDER-LOG] 🔄 Agregando items a pedido existente:', {
          orderId: orderCartHook.currentOrder.id,
          itemsToAdd: orderCartHook.cart.length,
          items: orderCartHook.cart.map(item => ({
            recipe: item.recipe.name,
            quantity: item.quantity,
            notes: item.notes
          }))
        });
        
        // Agregar cada item del carrito al pedido existente
        const addPromises = orderCartHook.cart.map(item => 
          apiService.orders.addItem(orderCartHook.currentOrder.id, {
            recipe: item.recipe.id,
            quantity: item.quantity,
            notes: item.notes,
            is_takeaway: item.is_takeaway,
            has_taper: item.is_takeaway, // Los items para llevar requieren taper
            selected_container: item.is_takeaway ? (item.selected_container || null) : null
          })
        );
        
        // Ejecutar todas las adiciones en paralelo
        const addResults = await Promise.all(addPromises);
        console.log('[ORDER-LOG] ✅ Items agregados exitosamente:', addResults);
        
        // Obtener el pedido actualizado desde el servidor
        createdOrder = await apiService.orders.get(orderCartHook.currentOrder.id);
        
      } else {
        // CREAR NUEVO PEDIDO
        const orderData = {
          table: orderTableHook.selectedTable.id,
          waiter: user?.first_name || user?.username || user?.name || 'Usuario actual',
          items: orderCartHook.cart.map(item => ({
            recipe: item.recipe.id,
            quantity: item.quantity,
            notes: item.notes,
            is_takeaway: item.is_takeaway,
            has_taper: item.is_takeaway, // Los items para llevar requieren taper
            selected_container: item.is_takeaway ? (item.selected_container || null) : null
          }))
        };

        // Agregar información del cliente solo para nuevos pedidos
        if (orderInfo) {
          if (orderInfo.customerName) {
            orderData.customer_name = orderInfo.customerName;
          }
          if (orderInfo.partySize) {
            orderData.party_size = orderInfo.partySize;
          }
        }

        console.log('[ORDER-LOG] 🚀 Creando nuevo pedido:', {
          orderData,
          itemCount: orderData.items.length
        });
        
        createdOrder = await apiService.orders.create(orderData);
      }
      const currentOrderForProcessing = createdOrder;
      
      console.log('[ORDER-LOG] ✅ Orden creada/actualizada exitosamente:', {
        orderId: createdOrder.id,
        orderStatus: createdOrder.status,
        itemsInOrder: createdOrder.items?.length || 0,
        totalAmount: createdOrder.grand_total,
        tableNumber: orderTableHook.selectedTable?.table_number,
        isUpdate: !!orderCartHook.currentOrder
      });
      
      if (orderCartHook.currentOrder) {
        showToast(`✅ Pedido #${createdOrder.id} actualizado - ${itemsProcessedCount} items agregados`, 'success');
      } else {
        showToast(`✅ Pedido #${createdOrder.id} creado para Mesa ${orderTableHook.selectedTable?.table_number || '?'} - ${itemsProcessedCount} items`, 'success');
      }
      
      // Reload specific table orders first (faster)
      await orderTableHook.loadTableOrders(orderTableHook.selectedTable.id);
      
      // Reload all data in background
      orderTableHook.loadInitialData();
      
      if (currentOrderForProcessing) {
        // Find updated order or use created one
        let updatedOrder = null;
        if (orderTableHook.orders && Array.isArray(orderTableHook.orders)) {
          updatedOrder = orderTableHook.orders.find(o => o.id === currentOrderForProcessing.id);
        }
        
        const orderToUse = updatedOrder || currentOrderForProcessing;
        orderCartHook.setCurrentOrder(orderToUse);
        orderCartHook.clearCart();
        
        showToast('✅ Pedido creado exitosamente. Items enviados a impresión.', 'success');
        return;
      }
      
      // Si llegamos aquí es porque no hay pedido para procesar, navegamos normalmente
      orderTableHook.setSelectedTable(null);
      navigateToStep('zones', { 
        selectedZone: null, 
        isCartOpen: false 
      });
      
    } catch (error) {
      // Error already shown via showToast
      showToast(`❌ Error al ${orderCartHook.currentOrder ? 'actualizar' : 'crear'} pedido: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setOrderState(prev => ({ ...prev, saving: false }));
    }
  }, [orderCartHook, orderTableHook, showToast]);


  // Handler para abrir modal de cancelación
  const openCancelModal = useCallback((type, id) => {
    setModals(prev => ({
      ...prev,
      cancelTarget: { type, id },
      cancelReason: '',
      isCancelModalOpen: true
    }));
  }, []);

  const closeCancelModal = useCallback(() => {
    setModals(prev => ({
      ...prev,
      isCancelModalOpen: false,
      cancelTarget: null,
      cancelReason: ''
    }));
  }, []);

  // Handler para cancelar pedido completamente (cuando todos los items están CANCELED)
  const handleOrderCanceled = useCallback(async (orderId) => {
    console.log('🚫 [ORDER-MANAGEMENT] handleOrderCanceled LLAMADO:', {
      orderId,
      currentOrderId: orderCartHook.currentOrder?.id,
      saving: orderState.saving,
      timestamp: new Date().toISOString()
    });
    
    try {
      console.log('🚫 [ORDER-MANAGEMENT] Pedido cancelado exitosamente, limpiando estado...');
      
      // Clean up and navigate
      orderCartHook.setCurrentOrder(null);
      orderCartHook.clearCart();
      orderTableHook.setSelectedTable(null);
      
      // Navegación optimizada sin recargas innecesarias
      console.log('🚫 [ORDER-MANAGEMENT] Navegando a vista de zonas...');
      navigateToStep('zones', { 
        selectedZone: null, 
        isCartOpen: false 
      });
      
      // Los datos se actualizarán automáticamente con el polling de 15s
      // No es necesario recargar manualmente
      
    } catch (error) {
      console.error('❌ [ORDER-MANAGEMENT] Error al manejar cancelación de pedido:', error);
      showToast(`❌ Error al procesar cancelación del pedido: ${error.message}`, 'error');
    }
  }, [showToast, orderTableHook, orderCartHook, navigateToStep]);

  // Handler para manejar cambios de estado automáticos de OrderItems y navegación
  const handleOrderItemStatusChange = useCallback(async (itemId, newStatus) => {
    console.log('🔄 [ORDER-MANAGEMENT] handleOrderItemStatusChange LLAMADO:', {
      itemId,
      newStatus,
      orderId: orderCartHook.currentOrder?.id,
      timestamp: new Date().toISOString()
    });

    try {
      // Actualizar el estado localmente primero
      orderCartHook.updateCurrentOrderItemStatus(itemId, newStatus);
      
      // Recargar los datos de la mesa para obtener el estado actualizado del servidor
      if (orderTableHook.selectedTable?.id) {
        await orderTableHook.loadTableOrders(orderTableHook.selectedTable.id);
        
        // Obtener la orden actualizada
        const updatedOrders = orderTableHook.getTableOrders(orderTableHook.selectedTable.id);
        const updatedOrder = updatedOrders.find(order => order.id === orderCartHook.currentOrder?.id);
        
        if (updatedOrder) {
          orderCartHook.setCurrentOrder(updatedOrder);
          
          // Verificar si todos los items activos (NO CANCELED) están en PREPARING
          const activeItems = updatedOrder.items?.filter(item => item.status !== 'CANCELED') || [];
          const allItemsPreparing = activeItems.length > 0 && 
            activeItems.every(item => item.status === 'PREPARING');
          
          console.log('🔍 [ORDER-MANAGEMENT] Verificando estado de items:', {
            orderId: updatedOrder.id,
            totalItems: updatedOrder.items?.length || 0,
            activeItems: activeItems.length,
            itemStatuses: activeItems.map(item => `${item.id}:${item.status}`),
            allItemsPreparing,
            hasNoCartItems: orderCartHook.cart.length === 0
          });
          
          // AUTO-NAVEGACIÓN: Si todos los items activos están PREPARING y no hay items en carrito
          if (allItemsPreparing && orderCartHook.cart.length === 0) {
            console.log('🚀 [ORDER-MANAGEMENT] AUTO-NAVEGACIÓN: Todos los items están PREPARING → navegando a zonas');
            
            showToast(`✅ Pedido #${updatedOrder.id} - Todos los items están en preparación. Liberando mesa...`, 'success');
            
            // Clean up and navigate
            orderCartHook.setCurrentOrder(null);
            orderCartHook.clearCart();
            orderTableHook.setSelectedTable(null);
            
            // Navegación automática a vista de zonas
            navigateToStep('zones', { 
              selectedZone: null, 
              isCartOpen: false 
            });
          }
        }
      }
      
    } catch (error) {
      console.error('❌ [ORDER-MANAGEMENT] Error en handleOrderItemStatusChange:', error);
      showToast(`❌ Error al procesar cambio de estado: ${error.message}`, 'error');
    }
  }, [orderCartHook, orderTableHook, navigateToStep, showToast]);

  // Handler para confirmar cancelación
  const handleConfirmCancel = useCallback(async () => {
    if (!modals.cancelReason.trim()) {
      showToast('❌ El motivo de cancelación es requerido', 'error');
      return;
    }

    try {
      setOrderState(prev => ({ ...prev, saving: true }));
      
      if (modals.cancelTarget.type === 'order') {
        // Cancelar la orden con el motivo
        await apiService.orders.updateStatus(modals.cancelTarget.id, 'CANCELED', modals.cancelReason);
        showToast(`✅ Pedido #${modals.cancelTarget.id} cancelado: ${modals.cancelReason}`, 'success');
        
        // Limpiar estado y volver a la vista de zonas
        orderTableHook.setSelectedTable(null);
        orderCartHook.setCurrentOrder(null);
        orderCartHook.clearCart();
        
        // Navegación optimizada
        navigateToStep('zones', { 
          selectedZone: null, 
          isCartOpen: false 
        });
        
        // Los datos se actualizarán automáticamente con el polling de 15s
        // No es necesario recargar manualmente
      } else if (modals.cancelTarget.type === 'item') {
        console.log('[ORDER-LOG] 🚫 Cancelando item de orden:', {
          itemId: modals.cancelTarget.id,
          reason: modals.cancelReason,
          orderId: orderCartHook.currentOrder?.id,
          tableNumber: orderTableHook.selectedTable?.table_number,
          timestamp: new Date().toISOString()
        });
        
        // Actualización optimista del UI primero
        orderTableHook.updateOrderItemStatus(modals.cancelTarget.id, 'CANCELED', modals.cancelReason);
        orderCartHook.updateCurrentOrderItemStatus(modals.cancelTarget.id, 'CANCELED', modals.cancelReason);
        showToast(`✅ Item cancelado: ${modals.cancelReason}`, 'success');
        
        try {
          // Enviar al backend en segundo plano
          await apiService.orderItems.cancel(modals.cancelTarget.id, modals.cancelReason);
          console.log('[ORDER-LOG] ✅ Cancelación de item sincronizada con servidor:', {
            itemId: modals.cancelTarget.id,
            success: true
          });
          
          // Forzar refresh del estado de impresión después de 500ms para dar tiempo al backend
          setTimeout(() => {
            console.log('[ORDER-LOG] 🔄 Disparando refresh de estados de impresión post-cancelación');
            window.dispatchEvent(new CustomEvent('refreshPrintStatus'));
          }, 500);
        } catch (error) {
          console.log('[ORDER-LOG] ❌ Error al sincronizar cancelación con servidor:', {
            itemId: modals.cancelTarget.id,
            error: error.message,
            willReload: true
          });
          
          // Si falla el backend, revertir la actualización optimista
          // Error already shown via showToast
          // Recargar datos para sincronizar estado real
          await orderTableHook.loadTableOrders(orderTableHook.selectedTable.id);
          showToast(`⚠️ Item cancelado localmente pero falló sincronización con servidor: ${error.message}`, 'warning');
        }
      }
      
      setModals(prev => ({
        ...prev,
        isCancelModalOpen: false,
        cancelTarget: null,
        cancelReason: ''
      }));
    } catch (error) {
      // Error already shown via showToast
      
      // Manejar diferentes formatos de error
      let errorMessage = 'Error al cancelar';
      if (error.response?.data) {
        if (error.response.data.status) {
          errorMessage = Array.isArray(error.response.data.status) 
            ? error.response.data.status[0] 
            : error.response.data.status;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        }
      }
      
      showToast(`❌ ${errorMessage}`, 'error');
    } finally {
      setOrderState(prev => ({ ...prev, saving: false }));
    }
  }, [modals.cancelTarget, modals.cancelReason, showToast, orderTableHook, orderCartHook]);


  // Calcular total completo (carrito + pedido actual) - solo items activos
  const completeTotal = useMemo(() => {
    const cartTotal = orderCartHook.getCartTotal();
    const activeItems = orderCartHook.currentOrder?.items ? filterActiveItems(orderCartHook.currentOrder.items) : [];
    const orderTotal = activeItems.reduce((sum, item) => 
      sum + parseFloat(item.total_with_container || item.total_price || 0), 0);
    return cartTotal + orderTotal;
  }, [orderCartHook.cart, orderCartHook.currentOrder?.items]);

  // Obtener zonas únicas disponibles
  const availableZones = useMemo(() => {
    if (!orderTableHook.tables || orderTableHook.tables.length === 0) {
      return [];
    }
    
    const zonesMap = new Map();
    orderTableHook.tables.forEach(table => {
      const zoneName = table.zone_name || table.zone_detail?.name || 'Sin zona';
      const zoneId = table.zone || table.zone_detail?.id;
      
      if (!zonesMap.has(zoneName)) {
        const tablesInZone = orderTableHook.tables.filter(t => 
          (t.zone_name || t.zone_detail?.name || 'Sin zona') === zoneName
        );
        const occupiedTables = tablesInZone.filter(t => 
          orderTableHook.getTableStatus(t.id) === 'occupied'
        ).length;
        
        zonesMap.set(zoneName, {
          id: zoneId,
          name: zoneName,
          totalTables: tablesInZone.length,
          occupiedTables,
          availableTables: tablesInZone.length - occupiedTables
        });
      }
    });
    
    return Array.from(zonesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [orderTableHook.tables, orderTableHook.allOrders]);

  // Obtener mesas de la zona seleccionada
  const selectedZoneTables = useMemo(() => {
    if (!orderState.selectedZone || !orderTableHook.tables) return [];
    
    return orderTableHook.tables
      .filter(table => 
        (table.zone_name || table.zone_detail?.name || 'Sin zona') === orderState.selectedZone.name
      )
      .sort((a, b) => {
        const aNum = parseInt(a.table_number.replace(/\D/g, '')) || 0;
        const bNum = parseInt(b.table_number.replace(/\D/g, '')) || 0;
        return aNum - bNum;
      });
  }, [orderState.selectedZone, orderTableHook.tables]);

  // Pantalla sin internet
  if (!isOnline) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center px-6 py-8 max-w-md">
          <div className="mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636L5.636 18.364m0-12.728L18.364 18.364M12 2a10 10 0 100 20 10 10 0 000-20z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Sin Conexión a Internet</h1>
            <p className="text-gray-600 mb-6 leading-relaxed">
              No se puede acceder al sistema de gestión de mesas porque no hay conexión a internet. 
              Verifica tu conexión Wi-Fi o datos móviles e intenta nuevamente.
            </p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={async () => {
                try {
                  // Reintentar carga de datos sin recargar la página
                  await orderTableHook.loadInitialData();
                  // Si la carga es exitosa, el estado isOnline debería cambiar automáticamente
                } catch (error) {
                  // Silently handle error
                }
              }}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              🔄 Reintentar Conexión
            </button>
            
            <div className="text-sm text-gray-500">
              <p className="mb-2">💡 Consejos para reconectar:</p>
              <ul className="text-left space-y-1 ml-4">
                <li>• Verifica tu conexión Wi-Fi</li>
                <li>• Revisa los datos móviles</li>
                <li>• Contacta al administrador de red</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Optimized loading state without debug logs
  const shouldShowLoading = initialLoading || (orderTableHook.loading && (orderState.step === 'zones' || orderState.step === 'tables'));
  
  if (shouldShowLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white flex flex-col" data-order-management>
      {/* Header fijo unificado para todas las vistas con mejor navegación */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        {/* Progress indicator */}
        <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
          <div className="flex items-center justify-center space-x-2">
            {/* Step 1: Zona */}
            <div className={`flex items-center ${orderState.step === 'zones' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                orderState.step === 'zones' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-white'
              }`}>1</div>
              <span className="ml-1 hidden sm:inline text-xs">Zona</span>
            </div>
            
            {/* Separator */}
            <div className="w-8 h-0.5 bg-gray-300"></div>
            
            {/* Step 2: Mesa */}
            <div className={`flex items-center ${orderState.step === 'tables' ? 'text-blue-600 font-medium' : orderState.step === 'zones' ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                orderState.step === 'tables' ? 'bg-blue-600 text-white' : 
                orderState.step === 'zones' ? 'bg-gray-200 text-gray-400' : 'bg-gray-300 text-white'
              }`}>2</div>
              <span className="ml-1 hidden sm:inline text-xs">Mesa</span>
            </div>
            
            {/* Separator */}
            <div className="w-8 h-0.5 bg-gray-300"></div>
            
            {/* Step 3: Menú */}
            <div className={`flex items-center ${orderState.step === 'menu' ? 'text-blue-600 font-medium' : ['zones', 'tables'].includes(orderState.step) ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                orderState.step === 'menu' ? 'bg-blue-600 text-white' : 
                ['zones', 'tables'].includes(orderState.step) ? 'bg-gray-200 text-gray-400' : 'bg-gray-300 text-white'
              }`}>3</div>
              <span className="ml-1 hidden sm:inline text-xs">Menú</span>
            </div>
            
            {/* Separator */}
          </div>
        </div>

        {/* Breadcrumb navigation */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center">
              <span className="font-medium">
                {orderState.step === 'zones' && 'Seleccionar Zona'}
                {orderState.step === 'tables' && 'Seleccionar Mesa'}
                {orderState.step === 'menu' && 'Gestión de Pedido'}
              </span>
            {orderState.step !== 'zones' && (
              <>
                <span className="mx-2">›</span>
                <span className={orderState.step === 'tables' ? 'font-medium text-gray-700' : ''}>{orderState.selectedZone?.name || 'Zona'}</span>
              </>
            )}
            {orderState.step === 'menu' && orderTableHook.selectedTable && (
              <>
                <span className="mx-2">›</span>
                <span>Mesa {orderTableHook.selectedTable.table_number}</span>
              </>
            )}
            {orderState.step === 'menu' && orderCartHook.currentOrder && (
              <>
                <span className="mx-2">›</span>
                <span className={orderState.step === 'menu' ? 'font-medium text-gray-700' : ''}>Pedido #{orderCartHook.currentOrder.id}</span>
              </>
            )}
            </div>
            
            {/* Indicadores de conectividad */}
            <div className="flex items-center gap-3">
              {/* Estado de Internet */}
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-xs ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {isOnline ? 'Internet' : 'Sin red'}
                </span>
              </div>
              
            </div>
          </div>
        </div>

        {/* Main header */}
        <div className="px-4 py-3 relative flex items-center">
          {/* Botón Atrás mejorado */}
          {orderState.step !== 'zones' && (
            <button
              onClick={() => {
                if (orderState.step === 'tables') {
                  handleBackToZones();
                } else if (orderState.step === 'menu') {
                  navigateToStep('tables', { isCartOpen: false });
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors mr-4"
              title="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Volver</span>
            </button>
          )}

          {/* Espacio central para equilibrar el layout */}
          <div className="flex-1"></div>

          {/* Botón de reiniciar pedidos (solo para admins) */}
          {userRole === 'administradores' && (
            <button
              onClick={async () => {
                if (window.confirm('⚠️ ¿Estás seguro de que quieres reiniciar TODOS los pedidos?\n\n• Se eliminarán todas las órdenes\n• Se eliminarán todos los pagos\n• Se eliminará la cola de impresión\n• Las configuraciones de impresoras se conservarán\n• Se reiniciarán los contadores de ID\n\nEsta acción no se puede deshacer.')) {
                  try {
                    setOrderState(prev => ({ ...prev, saving: true }));
                    await apiService.orders.resetAll();
                    showToast('✅ Sistema reiniciado: Todos los pedidos y cola de impresión eliminados (configuraciones de impresoras conservadas)', 'success');
                    
                    // Limpiar estado y volver a la vista de zonas
                    orderTableHook.setSelectedTable(null);
                    orderCartHook.clearCart();
                    navigateToStep('zones', { 
                      selectedZone: null, 
                      isCartOpen: false 
                    });
                    
                    // Recargar datos en segundo plano sin bloquear UI
                    orderTableHook.loadInitialData();
                  } catch (error) {
                    // Error already shown via showToast
                    showToast(`❌ Error al reiniciar sistema de pedidos: ${error.message}`, 'error');
                  } finally {
                    setOrderState(prev => ({ ...prev, saving: false }));
                  }
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors mr-2"
              title="Reiniciar todos los pedidos, cola de impresión y contadores (mantiene configuraciones de impresoras)"
              disabled={orderState.saving}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Reset DB</span>
            </button>
          )}

          {/* Botón de limpiar base de datos de producción (solo para admins) */}
          {userRole === 'administradores' && (
            <button
              onClick={async () => {
                if (window.confirm('🚨 ATENCIÓN: LIMPIAR BASE DE DATOS DE PRODUCCIÓN\n\n⚠️ Esta acción eliminará TODOS los pedidos del servidor en producción:\n\n• Se eliminarán todas las órdenes del servidor EC2\n• Se eliminarán todos los pagos del servidor EC2\n• Se eliminará la cola de impresión del servidor EC2\n• Las configuraciones de impresoras se conservarán\n• Se reiniciarán los contadores de ID del servidor EC2\n• Afectará a todos los usuarios conectados\n\n🔴 ESTA ACCIÓN NO SE PUEDE DESHACER\n\n¿Estás COMPLETAMENTE seguro de proceder?')) {
                  if (window.confirm('🔴 CONFIRMACIÓN FINAL\n\n¿Realmente quieres ELIMINAR TODOS los datos de producción?\n\nEscribe "CONFIRMAR" en el siguiente diálogo para continuar.')) {
                    const confirmation = window.prompt('Por seguridad, escribe "CONFIRMAR" para proceder:');
                    if (confirmation === 'CONFIRMAR') {
                      try {
                        setOrderState(prev => ({ ...prev, saving: true }));
                        await apiService.orders.resetAll();
                        showToast('🚨 BASE DE DATOS DE PRODUCCIÓN LIMPIADA: Todos los pedidos y cola de impresión eliminados (configuraciones de impresoras conservadas)', 'success');
                        
                        // Limpiar estado y volver a la vista de zonas
                        orderTableHook.setSelectedTable(null);
                        orderCartHook.clearCart();
                        navigateToStep('zones', { 
                          selectedZone: null, 
                          isCartOpen: false 
                        });
                        
                        // Recargar datos en segundo plano sin bloquear UI
                        orderTableHook.loadInitialData();
                      } catch (error) {
                        // Error already shown via showToast
                        showToast(`❌ Error al limpiar base de datos de producción: ${error.message}`, 'error');
                      } finally {
                        setOrderState(prev => ({ ...prev, saving: false }));
                      }
                    } else {
                      showToast('❌ Operación cancelada - Confirmación incorrecta', 'error');
                    }
                  } else {
                    showToast('❌ Operación cancelada por el usuario', 'info');
                  }
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-700 text-white hover:bg-red-800 transition-colors mr-2 border-2 border-red-900"
              title="⚠️ LIMPIAR base de datos del servidor de producción (EC2)"
              disabled={orderState.saving}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">🚨 Reset PROD</span>
            </button>
          )}

          {/* Botón de resetear TODA la base de datos (solo para admins) */}
          {userRole === 'administradores' && (
            <button
              onClick={async () => {
                if (window.confirm('🔥 PELIGRO EXTREMO: ELIMINAR TODA LA BASE DE DATOS\n\n💀 Esta acción eliminará ABSOLUTAMENTE TODO:\n\n• Todas las órdenes y pagos\n• Todas las recetas e ingredientes\n• Todas las mesas, zonas y configuración\n• Todas las impresoras y cola de impresión\n• Todos los contenedores y unidades\n• TODA la configuración del sistema\n\n🚨 EL SISTEMA QUEDARÁ COMPLETAMENTE VACÍO\n🔴 ESTA ACCIÓN NO SE PUEDE DESHACER\n🔴 TENDRÁS QUE RECONFIGURAR TODO DESDE CERO\n\n¿Estás ABSOLUTAMENTE seguro de proceder?')) {
                  if (window.confirm('💀 CONFIRMACIÓN DE DESTRUCCIÓN TOTAL\n\n🔥 Esto eliminará TODA la base de datos\n🔥 Tendrás que volver a crear recetas, mesas, etc.\n\nEscribe "DESTRUIR TODO" en el siguiente diálogo para continuar.')) {
                    const confirmation = window.prompt('Por seguridad máxima, escribe exactamente "DESTRUIR TODO" para proceder:');
                    if (confirmation === 'DESTRUIR TODO') {
                      try {
                        setOrderState(prev => ({ ...prev, saving: true }));
                        await apiService.orders.resetAllTables();
                        showToast('💀 BASE DE DATOS COMPLETAMENTE ELIMINADA: Sistema limpiado por completo - Reconfiguración necesaria', 'success');
                        
                        // Limpiar estado y volver a la vista de zonas
                        orderTableHook.setSelectedTable(null);
                        orderCartHook.clearCart();
                        navigateToStep('zones', { 
                          selectedZone: null, 
                          isCartOpen: false 
                        });
                        
                        // Recargar datos en segundo plano sin bloquear UI
                        orderTableHook.loadInitialData();
                      } catch (error) {
                        // Error already shown via showToast
                        showToast(`❌ Error al eliminar toda la base de datos: ${error.message}`, 'error');
                      } finally {
                        setOrderState(prev => ({ ...prev, saving: false }));
                      }
                    } else {
                      showToast('❌ Operación cancelada - Confirmación incorrecta', 'error');
                    }
                  } else {
                    showToast('❌ Operación cancelada por el usuario', 'info');
                  }
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black text-red-500 hover:bg-red-900 hover:text-white transition-colors mr-2 border-2 border-red-500"
              title="💀 ELIMINAR TODA LA BASE DE DATOS - Sistema completamente vacío"
              disabled={orderState.saving}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">💀 NUKE DB</span>
            </button>
          )}

          {/* Carrito solo en vista menu - ahora posicionado correctamente */}
          {orderState.step === 'menu' && (
            <button
              onClick={() => setOrderState(prev => ({ ...prev, isCartOpen: !prev.isCartOpen }))}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 ml-4 ${
                orderCartHook.cart.length > 0 || orderCartHook.currentOrder
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
              title="Ver pedido"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Pedido</span>
              
              {/* Badge con cantidad total */}
              {(() => {
                const cartCount = orderCartHook.getCartItemCount();
                // Solo contar items que no están cancelados
                const activeOrderItems = orderCartHook.currentOrder?.items?.filter(item => item.status !== 'CANCELED') || [];
                const orderCount = activeOrderItems.length;
                const totalCount = cartCount + orderCount;
                
                return totalCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {totalCount}
                  </div>
                );
              })()}
            </button>
          )}
        </div>
      </div>


      {/* Contenido principal */}
      <div className="flex-1 overflow-hidden">
        {/* Vista Zonas - Diseño minimalista */}
        {orderState.step === 'zones' && (
          <div className="flex items-center justify-center h-full p-6">
            <div className="w-full max-w-lg space-y-6">
              {availableZones.map(zone => (
                <button
                  key={zone.id || zone.name}
                  onClick={() => handleZoneSelect(zone)}
                  className="w-full h-32 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-all duration-200 hover:border-gray-300 flex items-center justify-center"
                >
                  <div className="text-center w-full">
                    <h3 className="text-3xl font-bold text-gray-900 mb-2">
                      {zone.name}
                    </h3>
                    <div className="text-lg text-gray-600">
                      {zone.availableTables} mesas disponibles
                    </div>
                  </div>
                </button>
              ))}
              
              {availableZones.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p>No hay zonas disponibles</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vista Mesas - Diseño minimalista */}
        {orderState.step === 'tables' && (
          <div className="h-full p-6 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 max-w-5xl mx-auto">
              {selectedZoneTables.map(table => {
                const status = orderTableHook.getTableStatus(table.id);
                const summary = orderTableHook.getTableSummary(table.id);
                
                return (
                  <button
                    key={table.id}
                    onClick={() => handleTableSelect(table)}
                    className={`h-32 p-4 rounded-lg border transition-all duration-200 flex items-center justify-center ${
                      status === 'occupied' 
                        ? 'border-orange-300 bg-orange-50 hover:bg-orange-100' 
                        : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-center w-full">
                      {/* Nombre de la mesa */}
                      <div className="font-bold text-2xl text-gray-900 mb-2">
                        Mesa {table.table_number}
                      </div>
                      
                      {/* Si la mesa está ocupada, mostrar información adicional */}
                      {summary && (
                        <div className="space-y-1">
                          {/* Nombre del mesero */}
                          <div className="text-base font-medium text-gray-700">
                            {summary.waiterName}
                          </div>
                          
                          {/* Tiempo transcurrido */}
                          <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{summary.elapsedTime}</span>
                          </div>
                          
                          {/* Nombre del cliente */}
                          <div className="text-sm text-gray-500">
                            {summary.customerName}
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            
            {selectedZoneTables.length === 0 && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center text-gray-400">
                  <p>No hay mesas en esta zona</p>
                </div>
              </div>
            )}
          </div>
        )}


        {/* Vista Menú */}
        {orderState.step === 'menu' && (
          <div className="h-full overflow-y-auto p-4">
            <OrderMenuCatalog
              recipes={menuData.recipes}
              groups={menuData.groups}
              onAddToCart={handleAddToCart}
              onOpenNoteModal={openNoteModal}
            />
            
            {/* Carrito lateral */}
            <OrderShoppingCartContainer
              isOpen={orderState.isCartOpen}
              onToggle={() => setOrderState(prev => ({ ...prev, isCartOpen: !prev.isCartOpen }))}
              cart={orderCartHook.cart}
              currentOrder={orderCartHook.currentOrder}
              onRemoveFromCart={orderCartHook.removeFromCart}
              onSaveOrder={handleSaveOrder}
              onCloseOrder={handleCloseOrder}
              onCancelOrderItem={(id) => openCancelModal('item', id)}
              onCancelOrder={(id) => openCancelModal('order', id)}
              onOrderCanceled={handleOrderCanceled}
              onOrderItemStatusChange={handleOrderItemStatusChange}
              onUpdateCurrentOrder={orderCartHook.setCurrentOrder}
              onNavigateToZones={() => {
                console.log('🚀 [ORDER-MANAGEMENT] Navegando a vista de zonas...');
                setOrderState(prev => ({ 
                  ...prev, 
                  step: 'zones',
                  selectedZone: null,
                  isCartOpen: false 
                }));
                orderCartHook.setCurrentOrder(null);
                orderCartHook.clearCart();
              }}
              saving={orderState.saving}
              userRole={userRole}
              canCancelItem={canCancelItem}
              canCloseOrder={canCloseOrder}
              filterActiveItems={filterActiveItems}
            />
          </div>
        )}


      </div>

      {/* Modal de notas */}
      {modals.isNoteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              Agregar al pedido
            </h3>
            
            <div className="mb-6">
              <p className="font-semibold text-gray-900 text-xl">{modals.selectedRecipe?.name}</p>
              <p className="text-lg text-gray-600 mt-2">S/ {modals.selectedRecipe?.price || modals.selectedRecipe?.base_price}</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-3">
                  Notas especiales
                </label>
                <textarea
                  value={modals.noteText}
                  onChange={(e) => setModals(prev => ({ ...prev, noteText: e.target.value }))}
                  className="w-full p-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Sin cebolla, extra queso, etc..."
                />
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={modals.isTakeaway}
                    onChange={(e) => setModals(prev => ({ ...prev, isTakeaway: e.target.checked }))}
                    className="h-6 w-6 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="ml-3 text-lg text-gray-700">Delivery</span>
                </label>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={closeNoteModal}
                className="flex-1 px-6 py-4 text-lg bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddWithNotes}
                className="flex-1 px-6 py-4 text-lg bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Agregar al pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de cancelación */}
      {modals.isCancelModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {modals.cancelTarget?.type === 'order' ? 'Cancelar Pedido' : 'Cancelar Producto'}
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  {modals.cancelTarget?.type === 'order' 
                    ? 'Se cancelará todo el pedido. Esta acción no se puede deshacer.'
                    : 'Se cancelará este producto del pedido. Esta acción no se puede deshacer.'
                  }
                </p>
                
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de cancelación *
                </label>
                <textarea
                  value={modals.cancelReason}
                  onChange={(e) => setModals(prev => ({ ...prev, cancelReason: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows={4}
                  placeholder="Ingresa el motivo de la cancelación..."
                  required
                />
                
                {!modals.cancelReason.trim() && (
                  <p className="text-red-500 text-xs mt-1">El motivo de cancelación es obligatorio</p>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={closeCancelModal}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmCancel}
                  disabled={!modals.cancelReason.trim()}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    modals.cancelReason.trim()
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {modals.cancelTarget?.type === 'order' ? 'Cancelar Pedido' : 'Cancelar Producto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;