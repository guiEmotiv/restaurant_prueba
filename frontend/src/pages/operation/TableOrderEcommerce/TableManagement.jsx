import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { apiService } from '../../../services/api';
import { ArrowLeft, Home, ShoppingBag, Trash2 } from 'lucide-react';

// Hooks personalizados
import { useTableOrders } from './hooks/useTableOrders';
import { useCart } from './hooks/useCart';
import { usePayment } from './hooks/usePayment';

// Componentes
import MenuCatalog from './components/MenuCatalog';
import ShoppingCart from './components/ShoppingCart';
import PaymentProcess from './components/PaymentProcess';

// Utilidades
import { 
  getItemStatusColor, 
  canCancelItem,
  canDeleteOrder, 
  canProcessPayment,
  filterActiveItems,
  filterActiveOrders
} from './utils/orderHelpers';
import { validateTakeawayContainer, validateOrder } from './utils/validations';

const TableManagement = () => {
  const { user, userRole, hasPermission } = useAuth();
  const { showToast } = useToast();

  // Estados agrupados para mejor rendimiento
  const [appState, setAppState] = useState({
    step: 'zones', // 'zones', 'tables', 'menu'
    selectedZone: null,
    saving: false,
    isCartOpen: false
  });
  
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
  const tableOrdersHook = useTableOrders(showToast);
  const cartHook = useCart();
  const paymentHook = usePayment(showToast);

  // Estado de carga inicial optimizado
  const [initialLoading, setInitialLoading] = useState(true);

  // Cargar datos iniciales con skeleton loading
  useEffect(() => {
    const loadData = async () => {
      try {
        // Cargar datos en paralelo con indicador de carga
        const [, recipesData, groupsData, containersData] = await Promise.all([
          tableOrdersHook.loadInitialData(),
          apiService.recipes.getAll({ is_active: true, is_available: true }),
          apiService.groups.getAll(),
          apiService.containers.getAll()
        ]);
        
        // Batch update para evitar múltiples renders
        setMenuData({
          recipes: recipesData || [],
          groups: groupsData || [],
          containers: containersData || []
        });
        
        // Pequeño delay para evitar flash de contenido
        setTimeout(() => setInitialLoading(false), 100);
      } catch (error) {
        setInitialLoading(false);
        showToast(`Error al cargar menú y configuración: ${error.message}`, 'error');
      }
    };

    loadData();
  }, []);

  // Polling optimizado - solo cuando es necesario
  useEffect(() => {
    // Solo hacer polling en vista de zonas y mesas para ver estado actualizado
    if (['zones', 'tables'].includes(appState.step)) {
      const interval = setInterval(async () => {
        // No hacer polling si estamos guardando
        if (appState.saving) return;
        
        try {
          await tableOrdersHook.loadInitialData();
        } catch (error) {
          // Error en actualización automática (ignorado)
        }
      }, 15000); // Menos frecuente: cada 15 segundos

      return () => clearInterval(interval);
    }
  }, [appState.step, appState.saving, tableOrdersHook]);

  // Navegación optimizada - recargar solo cuando sea necesario
  const navigateWithDataReload = useCallback(async (newStep, additionalActions = null, skipReload = false) => {
    // Ejecutar acciones adicionales si se proporcionan
    if (additionalActions) {
      await additionalActions();
    }
    
    // Solo recargar datos si cambiamos a zones/tables o si se especifica explícitamente
    const needsReload = ['zones', 'tables'].includes(newStep) && !skipReload;
    if (needsReload) {
      await tableOrdersHook.loadInitialData();
    }
    
    // Cambiar al nuevo paso usando el estado agrupado
    setAppState(prev => ({ ...prev, step: newStep }));
  }, [tableOrdersHook]);

  // Handlers para navegación
  const handleZoneSelect = useCallback(async (zone) => {
    await navigateWithDataReload('tables', async () => {
      setAppState(prev => ({ ...prev, selectedZone: zone, isCartOpen: false }));
    });
  }, [navigateWithDataReload]);

  const handleTableSelect = useCallback(async (table) => {
    await navigateWithDataReload('menu', async () => {
      // Cerrar carrito inmediatamente al seleccionar una mesa diferente
      setAppState(prev => ({ ...prev, isCartOpen: false }));
      
      tableOrdersHook.setSelectedTable(table);
      await tableOrdersHook.loadTableOrders(table.id);
      
      // Verificar si la mesa tiene un pedido activo para cargarlo automáticamente
      const existingOrders = tableOrdersHook.getTableOrders(table.id);
      
      if (existingOrders.length > 0) {
        // Mesa tiene pedido activo - cargar para edición
        const activeOrder = existingOrders[0];
        cartHook.setCurrentOrder(activeOrder);
        cartHook.clearCart(); // Limpiar carrito para mostrar solo los items del pedido existente
        // Mesa tiene pedido activo - cargando para edición
      } else {
        // Mesa vacía - preparar para nuevo pedido
        cartHook.setCurrentOrder(null);
        cartHook.clearCart();
        // Mesa disponible - preparar para nuevo pedido
      }
    });
  }, [navigateWithDataReload, tableOrdersHook, cartHook]);

  const handleBackToZones = useCallback(async () => {
    await navigateWithDataReload('zones', async () => {
      setAppState(prev => ({ ...prev, selectedZone: null, isCartOpen: false }));
    });
  }, [navigateWithDataReload]);



  const handlePayOrder = useCallback(async (order) => {
    await navigateWithDataReload('payment', async () => {
      paymentHook.setSelectedOrderForPayment(order);
    });
  }, [navigateWithDataReload, paymentHook]);

  // Handlers para carrito
  const handleAddToCart = useCallback((recipe) => {
    cartHook.addToCart(recipe, '', false, 0, null); // Parámetros explícitos para evitar confusión
    showToast(`✅ ${recipe.name} agregado al carrito (Mesa ${tableOrdersHook.selectedTable?.table_number || '?'})`, 'success', 1000);
    
    // Reproducir sonido de agregar al carrito
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzKJ0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwiBzKJ0fLNeSsF')
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ignorar errores si no se puede reproducir
    } catch (error) {
      // Ignorar errores de audio
    }
  }, [cartHook, showToast]);

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
    
    cartHook.addToCart(modals.selectedRecipe, modals.noteText, modals.isTakeaway, containerPrice, containerId);
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
  }, [modals.selectedRecipe, modals.noteText, modals.isTakeaway, menuData.containers, cartHook, showToast, closeNoteModal]);

  // Handler para cerrar pedido (cambiar items PREPARING a SERVED)
  const handleCloseOrder = useCallback(async (orderId) => {
    try {
      setAppState(prev => ({ ...prev, saving: true }));
      
      // Cambiar estado del pedido a SERVED (esto actualizará automáticamente los order items PREPARING a SERVED)
      await apiService.orders.updateStatus(orderId, 'SERVED');
      
      showToast(`🍽️ Pedido #${orderId} de Mesa ${tableOrdersHook.selectedTable?.table_number || '?'} servido y listo para cobrar`, 'success');
      
      // Actualizar datos
      await tableOrdersHook.loadInitialData();
      
      // Limpiar el pedido actual del carrito ya que ha sido cerrado
      cartHook.setCurrentOrder(null);
      cartHook.clearCart();
      
      // Volver al paso de zonas sin recargar de nuevo
      await navigateWithDataReload('zones', async () => {
        setAppState(prev => ({ ...prev, selectedZone: null, isCartOpen: false }));
        tableOrdersHook.setSelectedTable(null);
      }, true); // true = skipReload
      
    } catch (error) {
      showToast(`❌ Error al cerrar pedido #${orderId}: ${error.message}`, 'error');
    } finally {
      setAppState(prev => ({ ...prev, saving: false }));
    }
  }, [apiService, showToast, tableOrdersHook]);

  // Handler para guardar pedido
  const handleSaveOrder = useCallback(async (orderInfo = {}) => {
    const validation = validateOrder(cartHook.cart, tableOrdersHook.selectedTable);
    if (!validation.isValid) {
      showToast(validation.message, 'error');
      return;
    }

    try {
      setAppState(prev => ({ ...prev, saving: true }));
      
      const orderData = {
        table: tableOrdersHook.selectedTable.id,
        waiter: user?.first_name || user?.username || user?.name || 'Usuario actual',
        items: cartHook.cart.map(item => ({
          recipe: item.recipe.id,
          quantity: item.quantity,
          notes: item.notes,
          is_takeaway: item.is_takeaway,
          has_taper: item.is_takeaway, // Los items para llevar requieren taper
          selected_container: item.is_takeaway ? (item.selected_container || null) : null
        }))
      };

      // Agregar información del cliente solo para nuevos pedidos
      if (!cartHook.currentOrder && orderInfo) {
        if (orderInfo.customer_name) {
          orderData.customer_name = orderInfo.customer_name;
        }
        if (orderInfo.party_size) {
          orderData.party_size = orderInfo.party_size;
        }
      }


      if (cartHook.currentOrder) {
        // Actualizar pedido existente - agregar items uno por uno
        for (const item of orderData.items) {
          await apiService.orders.addItem(cartHook.currentOrder.id, item);
        }
        showToast(`✅ Pedido #${cartHook.currentOrder.id} actualizado - ${orderData.items.length} items agregados`, 'success');
      } else {
        // Crear nuevo pedido
        // Creando nuevo pedido
        const createdOrder = await apiService.orders.create(orderData);
        // Pedido creado exitosamente
        showToast(`✅ Pedido #${createdOrder.id} creado para Mesa ${tableOrdersHook.selectedTable?.table_number || '?'} - ${orderData.items.length} items`, 'success');
      }

      // Limpiar carrito
      cartHook.clearCart();
      
      // Recargar datos en paralelo para mejorar el rendimiento
      await Promise.all([
        tableOrdersHook.loadTableOrders(tableOrdersHook.selectedTable.id),
        tableOrdersHook.loadInitialData()
      ]);
      
      // Navegar sin recargar de nuevo (ya lo hicimos arriba)
      await navigateWithDataReload('zones', async () => {
        setAppState(prev => ({ ...prev, selectedZone: null, isCartOpen: false }));
        tableOrdersHook.setSelectedTable(null);
      }, true); // true = skipReload
      
    } catch (error) {
      console.error(`[TableManagement] ❌ Error al ${cartHook.currentOrder ? 'actualizar' : 'crear'} pedido:`, error);
      console.error('[TableManagement] ❌ Respuesta del servidor:', error.response);
      console.error('[TableManagement] ❌ Datos del error:', error.response?.data);
      console.error('[TableManagement] ❌ Objeto de error completo:', JSON.stringify(error, null, 2));
      showToast(`❌ Error al ${cartHook.currentOrder ? 'actualizar' : 'crear'} pedido: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setAppState(prev => ({ ...prev, saving: false }));
    }
  }, [cartHook, tableOrdersHook, showToast]);


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

  // Handler para confirmar cancelación
  const handleConfirmCancel = useCallback(async () => {
    if (!modals.cancelReason.trim()) {
      showToast('❌ El motivo de cancelación es requerido', 'error');
      return;
    }

    try {
      setAppState(prev => ({ ...prev, saving: true }));
      
      if (modals.cancelTarget.type === 'order') {
        // Cancelar la orden con el motivo
        await apiService.orders.updateStatus(modals.cancelTarget.id, 'CANCELED', modals.cancelReason);
        showToast(`✅ Pedido #${modals.cancelTarget.id} cancelado: ${modals.cancelReason}`, 'success');
        
        // Actualizar datos y volver a la vista de zonas
        await tableOrdersHook.loadInitialData();
        setAppState(prev => ({ ...prev, selectedZone: null, step: 'zones', isCartOpen: false }));
        tableOrdersHook.setSelectedTable(null);
        cartHook.setCurrentOrder(null);
        cartHook.clearCart();
      } else if (modals.cancelTarget.type === 'item') {
        // Actualización optimista del UI primero
        tableOrdersHook.updateOrderItemStatus(modals.cancelTarget.id, 'CANCELED', modals.cancelReason);
        cartHook.updateCurrentOrderItemStatus(modals.cancelTarget.id, 'CANCELED', modals.cancelReason);
        showToast(`✅ Item cancelado: ${modals.cancelReason}`, 'success');
        
        try {
          // Enviar al backend en segundo plano
          await apiService.orderItems.cancel(modals.cancelTarget.id, modals.cancelReason);
        } catch (error) {
          // Si falla el backend, revertir la actualización optimista
          console.error(`[TableManagement] Error al cancelar item #${modals.cancelTarget.id} en backend:`, error);
          // Recargar datos para sincronizar estado real
          await tableOrdersHook.loadTableOrders(tableOrdersHook.selectedTable.id);
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
      console.error('Error cancelando:', error);
      console.error('Detalles del error:', error.response?.data);
      
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
      setAppState(prev => ({ ...prev, saving: false }));
    }
  }, [modals.cancelTarget, modals.cancelReason, showToast, tableOrdersHook, cartHook]);


  // Calcular total completo (carrito + pedido actual) - solo items activos
  const completeTotal = useMemo(() => {
    const cartTotal = cartHook.getCartTotal();
    const activeItems = cartHook.currentOrder?.items ? filterActiveItems(cartHook.currentOrder.items) : [];
    const orderTotal = activeItems.reduce((sum, item) => 
      sum + parseFloat(item.total_with_container || item.total_price || 0), 0);
    return cartTotal + orderTotal;
  }, [cartHook, filterActiveItems]);

  // Obtener zonas únicas disponibles
  const availableZones = useMemo(() => {
    if (!tableOrdersHook.tables || tableOrdersHook.tables.length === 0) {
      return [];
    }
    
    const zonesMap = new Map();
    tableOrdersHook.tables.forEach(table => {
      const zoneName = table.zone_name || table.zone_detail?.name || 'Sin zona';
      const zoneId = table.zone || table.zone_detail?.id;
      
      if (!zonesMap.has(zoneName)) {
        const tablesInZone = tableOrdersHook.tables.filter(t => 
          (t.zone_name || t.zone_detail?.name || 'Sin zona') === zoneName
        );
        const occupiedTables = tablesInZone.filter(t => 
          tableOrdersHook.getTableStatus(t.id) === 'occupied'
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
  }, [tableOrdersHook.tables, tableOrdersHook.getTableStatus]);

  // Obtener mesas de la zona seleccionada
  const selectedZoneTables = useMemo(() => {
    if (!appState.selectedZone || !tableOrdersHook.tables) return [];
    
    return tableOrdersHook.tables
      .filter(table => 
        (table.zone_name || table.zone_detail?.name || 'Sin zona') === appState.selectedZone.name
      )
      .sort((a, b) => {
        const aNum = parseInt(a.table_number.replace(/\D/g, '')) || 0;
        const bNum = parseInt(b.table_number.replace(/\D/g, '')) || 0;
        return aNum - bNum;
      });
  }, [appState.selectedZone, tableOrdersHook.tables]);

  // Loading state mejorado
  if (initialLoading || (tableOrdersHook.loading && (appState.step === 'zones' || appState.step === 'tables'))) {
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
    <div className="fixed inset-0 bg-white flex flex-col">
      {/* Header fijo unificado para todas las vistas con mejor navegación */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        {/* Progress indicator */}
        <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
          <div className="flex items-center justify-center space-x-2">
            {/* Step 1: Zona */}
            <div className={`flex items-center ${appState.step === 'zones' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                appState.step === 'zones' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-white'
              }`}>1</div>
              <span className="ml-1 hidden sm:inline text-xs">Zona</span>
            </div>
            
            {/* Separator */}
            <div className="w-8 h-0.5 bg-gray-300"></div>
            
            {/* Step 2: Mesa */}
            <div className={`flex items-center ${appState.step === 'tables' ? 'text-blue-600 font-medium' : appState.step === 'zones' ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                appState.step === 'tables' ? 'bg-blue-600 text-white' : 
                appState.step === 'zones' ? 'bg-gray-200 text-gray-400' : 'bg-gray-300 text-white'
              }`}>2</div>
              <span className="ml-1 hidden sm:inline text-xs">Mesa</span>
            </div>
            
            {/* Separator */}
            <div className="w-8 h-0.5 bg-gray-300"></div>
            
            {/* Step 3: Menú */}
            <div className={`flex items-center ${appState.step === 'menu' ? 'text-blue-600 font-medium' : ['zones', 'tables'].includes(appState.step) ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                appState.step === 'menu' ? 'bg-blue-600 text-white' : 
                ['zones', 'tables'].includes(appState.step) ? 'bg-gray-200 text-gray-400' : 'bg-gray-300 text-white'
              }`}>3</div>
              <span className="ml-1 hidden sm:inline text-xs">Menú</span>
            </div>
            
            {/* Separator */}
          </div>
        </div>

        {/* Breadcrumb navigation */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center text-xs text-gray-600">
            <span className="font-medium">Gestión de Mesas</span>
            {appState.step !== 'zones' && (
              <>
                <span className="mx-2">›</span>
                <span className={appState.step === 'tables' ? 'font-medium text-gray-700' : ''}>{appState.selectedZone?.name || 'Zona'}</span>
              </>
            )}
            {appState.step === 'menu' && tableOrdersHook.selectedTable && (
              <>
                <span className="mx-2">›</span>
                <span>Mesa {tableOrdersHook.selectedTable.table_number}</span>
              </>
            )}
            {appState.step === 'menu' && cartHook.currentOrder && (
              <>
                <span className="mx-2">›</span>
                <span className={appState.step === 'menu' ? 'font-medium text-gray-700' : ''}>Pedido #{cartHook.currentOrder.id}</span>
              </>
            )}
          </div>
        </div>

        {/* Main header */}
        <div className="px-4 py-3 relative flex items-center">
          {/* Botón Atrás mejorado */}
          {appState.step !== 'zones' && (
            <button
              onClick={async () => {
                if (appState.step === 'tables') {
                  await handleBackToZones();
                } else if (appState.step === 'menu') {
                  await navigateWithDataReload('tables', async () => {
                    setAppState(prev => ({ ...prev, isCartOpen: false }));
                  });
                } else if (appState.step === 'payment') {
                  await navigateWithDataReload('menu', async () => {
                    setAppState(prev => ({ ...prev, isCartOpen: false }));
                  });
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
                if (window.confirm('⚠️ ¿Estás seguro de que quieres reiniciar TODOS los pedidos?\n\n• Se eliminarán todas las órdenes\n• Se eliminarán todos los pagos\n• Se reiniciarán los contadores de ID\n\nEsta acción no se puede deshacer.')) {
                  try {
                    setAppState(prev => ({ ...prev, saving: true }));
                    await apiService.orders.resetAll();
                    showToast('✅ Sistema reiniciado: Todos los pedidos eliminados y contadores restablecidos', 'success');
                    
                    // Recargar datos
                    await tableOrdersHook.loadInitialData();
                    
                    // Volver a la vista de zonas
                    await navigateWithDataReload('zones', async () => {
                      setAppState(prev => ({ ...prev, selectedZone: null, isCartOpen: false }));
                      tableOrdersHook.setSelectedTable(null);
                      cartHook.clearCart();
                    }, true);
                  } catch (error) {
                    console.error('[TableManagement] Error al reiniciar sistema de pedidos:', error);
                    showToast(`❌ Error al reiniciar sistema de pedidos: ${error.message}`, 'error');
                  } finally {
                    setSaving(false);
                  }
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors mr-2"
              title="Reiniciar todos los pedidos y contadores"
              disabled={appState.saving}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Reset DB</span>
            </button>
          )}

          {/* Botón de limpiar base de datos de producción (solo para admins) */}
          {userRole === 'administradores' && (
            <button
              onClick={async () => {
                if (window.confirm('🚨 ATENCIÓN: LIMPIAR BASE DE DATOS DE PRODUCCIÓN\n\n⚠️ Esta acción eliminará TODOS los pedidos del servidor en producción:\n\n• Se eliminarán todas las órdenes del servidor EC2\n• Se eliminarán todos los pagos del servidor EC2\n• Se reiniciarán los contadores de ID del servidor EC2\n• Afectará a todos los usuarios conectados\n\n🔴 ESTA ACCIÓN NO SE PUEDE DESHACER\n\n¿Estás COMPLETAMENTE seguro de proceder?')) {
                  if (window.confirm('🔴 CONFIRMACIÓN FINAL\n\n¿Realmente quieres ELIMINAR TODOS los datos de producción?\n\nEscribe "CONFIRMAR" en el siguiente diálogo para continuar.')) {
                    const confirmation = window.prompt('Por seguridad, escribe "CONFIRMAR" para proceder:');
                    if (confirmation === 'CONFIRMAR') {
                      try {
                        setAppState(prev => ({ ...prev, saving: true }));
                        await apiService.orders.resetAll();
                        showToast('🚨 BASE DE DATOS DE PRODUCCIÓN LIMPIADA: Todos los pedidos del servidor eliminados', 'success');
                        
                        // Recargar datos
                        await tableOrdersHook.loadInitialData();
                        
                        // Volver a la vista de zonas
                        await navigateWithDataReload('zones', async () => {
                          setAppState(prev => ({ ...prev, selectedZone: null, isCartOpen: false }));
                          tableOrdersHook.setSelectedTable(null);
                          cartHook.clearCart();
                        }, true);
                      } catch (error) {
                        console.error('[TableManagement] Error al limpiar base de datos de producción:', error);
                        showToast(`❌ Error al limpiar base de datos de producción: ${error.message}`, 'error');
                      } finally {
                        setSaving(false);
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
              disabled={appState.saving}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">🚨 Reset PROD</span>
            </button>
          )}

          {/* Carrito solo en vista menu - ahora posicionado correctamente */}
          {appState.step === 'menu' && (
            <button
              onClick={() => setAppState(prev => ({ ...prev, isCartOpen: !prev.isCartOpen }))}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 ml-4 ${
                cartHook.cart.length > 0 || cartHook.currentOrder
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
              title="Ver pedido"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Pedido</span>
              
              {/* Badge con cantidad total */}
              {(() => {
                const cartCount = cartHook.getCartItemCount();
                // Solo contar items que no están cancelados
                const activeOrderItems = cartHook.currentOrder?.items?.filter(item => item.status !== 'CANCELED') || [];
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
        {appState.step === 'zones' && (
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
        {appState.step === 'tables' && (
          <div className="h-full p-6 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 max-w-5xl mx-auto">
              {selectedZoneTables.map(table => {
                const status = tableOrdersHook.getTableStatus(table.id);
                const summary = tableOrdersHook.getTableSummary(table.id);
                
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
        {appState.step === 'menu' && (
          <div className="h-full overflow-y-auto p-4">
            <MenuCatalog
              recipes={menuData.recipes}
              groups={menuData.groups}
              onAddToCart={handleAddToCart}
              onOpenNoteModal={openNoteModal}
            />
            
            {/* Carrito lateral */}
            <ShoppingCart
              isOpen={appState.isCartOpen}
              onToggle={() => setAppState(prev => ({ ...prev, isCartOpen: !prev.isCartOpen }))}
              cart={cartHook.cart}
              currentOrder={cartHook.currentOrder}
              onRemoveFromCart={cartHook.removeFromCart}
              onSaveOrder={handleSaveOrder}
              onCloseOrder={handleCloseOrder}
              onCancelOrderItem={(id) => openCancelModal('item', id)}
              onCancelOrder={(id) => openCancelModal('order', id)}
              saving={appState.saving}
              userRole={userRole}
              getItemStatusColor={getItemStatusColor}
              canCancelItem={canCancelItem}
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

export default TableManagement;