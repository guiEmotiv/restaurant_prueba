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

  // Estados de la aplicación
  const [step, setStep] = useState('zones'); // 'zones', 'tables', 'menu'
  const [selectedZone, setSelectedZone] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [containers, setContainers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Estados para modal de notas
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [isTakeaway, setIsTakeaway] = useState(false);
  
  // Estados para modal de cancelación
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null); // {type: 'order'|'item', id: number}
  const [cancelReason, setCancelReason] = useState('');

  // Hooks personalizados
  const tableOrdersHook = useTableOrders(showToast);
  const cartHook = useCart();
  const paymentHook = usePayment(showToast);

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        const [recipesData, groupsData, containersData] = await Promise.all([
          apiService.recipes.getAll({ is_active: true, is_available: true }),
          apiService.groups.getAll(),
          apiService.containers.getAll()
        ]);
        
        setRecipes(recipesData || []);
        setGroups(groupsData || []);
        setContainers(containersData || []);
      } catch (error) {
        showToast(`Error al cargar datos del menú: ${error.message}`, 'error');
      }
    };

    tableOrdersHook.loadInitialData();
    loadData();
  }, []);

  // Polling optimizado - solo cuando es necesario
  useEffect(() => {
    // Solo hacer polling en vista de zonas y mesas para ver estado actualizado
    if (['zones', 'tables'].includes(step)) {
      const interval = setInterval(async () => {
        // No hacer polling si estamos guardando
        if (saving) return;
        
        try {
          await tableOrdersHook.loadInitialData();
        } catch (error) {
          console.log('Polling error (ignored):', error.message);
        }
      }, 15000); // Menos frecuente: cada 15 segundos

      return () => clearInterval(interval);
    }
  }, [step, saving, tableOrdersHook]);

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
    
    // Cambiar al nuevo paso
    setStep(newStep);
  }, [tableOrdersHook]);

  // Handlers para navegación
  const handleZoneSelect = useCallback(async (zone) => {
    await navigateWithDataReload('tables', async () => {
      setSelectedZone(zone);
    });
  }, [navigateWithDataReload]);

  const handleTableSelect = useCallback(async (table) => {
    await navigateWithDataReload('menu', async () => {
      tableOrdersHook.setSelectedTable(table);
      await tableOrdersHook.loadTableOrders(table.id);
      
      // Verificar si la mesa tiene un pedido activo para cargarlo automáticamente
      const existingOrders = tableOrdersHook.getTableOrders(table.id);
      if (existingOrders.length > 0) {
        // Mesa tiene pedido activo - cargar para edición
        const activeOrder = existingOrders[0];
        cartHook.setCurrentOrder(activeOrder);
        cartHook.clearCart(); // Limpiar carrito para mostrar solo los items del pedido existente
        console.log('Mesa con pedido activo detectada - cargando para edición:', activeOrder);
      } else {
        // Mesa vacía - preparar para nuevo pedido
        cartHook.setCurrentOrder(null);
        cartHook.clearCart();
        console.log('Mesa disponible - preparar para nuevo pedido');
      }
    });
  }, [navigateWithDataReload, tableOrdersHook, cartHook]);

  const handleBackToZones = useCallback(async () => {
    await navigateWithDataReload('zones', async () => {
      setSelectedZone(null);
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
    showToast(`✅ ${recipe.name} agregado al pedido`, 'success', 1000);
    
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
    setSelectedRecipe(recipe);
    setNoteText('');
    setIsTakeaway(false);
    setIsNoteModalOpen(true);
  }, []);

  const closeNoteModal = useCallback(() => {
    setIsNoteModalOpen(false);
    setSelectedRecipe(null);
    setNoteText('');
    setIsTakeaway(false);
  }, []);

  const handleAddWithNotes = useCallback(() => {
    if (!selectedRecipe) return;
    
    let containerPrice = 0;
    
    // Validar si es para llevar
    let containerId = null;
    if (isTakeaway) {
      const validation = validateTakeawayContainer(selectedRecipe, containers);
      if (!validation.isValid) {
        showToast(validation.message, 'error');
        return;
      }
      containerPrice = parseFloat(validation.container.price || 0);
      containerId = validation.container.id;
    }
    
    cartHook.addToCart(selectedRecipe, noteText, isTakeaway, containerPrice, containerId);
    showToast(`✅ ${selectedRecipe.name} agregado al pedido`, 'success', 1000);
    
    // Reproducir sonido de agregar al carrito
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzKJ0fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwiBzKJ0fLNeSsF')
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ignorar errores si no se puede reproducir
    } catch (error) {
      // Ignorar errores de audio
    }
    
    closeNoteModal();
  }, [selectedRecipe, noteText, isTakeaway, containers, cartHook, showToast, closeNoteModal]);

  // Handler para cerrar pedido (cambiar a SERVED)
  const handleCloseOrder = useCallback(async (orderId) => {
    try {
      setSaving(true);
      
      // Cambiar estado del pedido a SERVED (esto actualizará automáticamente los order items)
      await apiService.orders.updateStatus(orderId, 'SERVED');
      
      showToast('🍽️ Pedido cerrado y enviado a caja', 'success');
      
      // Actualizar datos
      await tableOrdersHook.loadInitialData();
      
      // Volver al paso de zonas sin recargar de nuevo
      await navigateWithDataReload('zones', async () => {
        setIsCartOpen(false);
        setSelectedZone(null);
        tableOrdersHook.setSelectedTable(null);
      }, true); // true = skipReload
      
    } catch (error) {
      showToast('❌ Error al cerrar pedido', 'error');
    } finally {
      setSaving(false);
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
      setSaving(true);
      
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
        showToast('Pedido actualizado exitosamente', 'success');
      } else {
        // Crear nuevo pedido
        console.log('🚀 CREATING NEW ORDER:', orderData);
        const createdOrder = await apiService.orders.create(orderData);
        console.log('✅ ORDER CREATED SUCCESSFULLY:', createdOrder);
        showToast(`✅ Pedido #${createdOrder.id} creado exitosamente`, 'success');
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
        setSelectedZone(null);
        tableOrdersHook.setSelectedTable(null);
      }, true); // true = skipReload
      
    } catch (error) {
      console.error('❌ ERROR CREATING/UPDATING ORDER:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error data:', error.response?.data);
      console.error('❌ Full error object:', JSON.stringify(error, null, 2));
      showToast(`❌ Error al guardar pedido: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [cartHook, tableOrdersHook, showToast]);


  // Handler para abrir modal de cancelación
  const openCancelModal = useCallback((type, id) => {
    setCancelTarget({type, id});
    setCancelReason('');
    setIsCancelModalOpen(true);
  }, []);

  const closeCancelModal = useCallback(() => {
    setIsCancelModalOpen(false);
    setCancelTarget(null);
    setCancelReason('');
  }, []);

  // Handler para confirmar cancelación
  const handleConfirmCancel = useCallback(async () => {
    if (!cancelReason.trim()) {
      showToast('❌ El motivo de cancelación es requerido', 'error');
      return;
    }

    try {
      setSaving(true);
      
      if (cancelTarget.type === 'order') {
        await apiService.orders.cancel(cancelTarget.id, cancelReason);
        showToast('✅ Pedido cancelado exitosamente', 'success');
        
        // Actualizar datos y volver a la vista de zonas
        await tableOrdersHook.refreshData();
        await navigateWithDataReload('zones', async () => {
          setSelectedZone(null);
          tableOrdersHook.setSelectedTable(null);
        });
      } else if (cancelTarget.type === 'item') {
        // Actualización optimista del UI primero
        tableOrdersHook.updateOrderItemStatus(cancelTarget.id, 'CANCELED', cancelReason);
        cartHook.updateCurrentOrderItemStatus(cancelTarget.id, 'CANCELED', cancelReason);
        showToast(`✅ Item cancelado: ${cancelReason}`, 'success');
        
        try {
          // Enviar al backend en segundo plano
          await apiService.orderItems.cancel(cancelTarget.id, cancelReason);
        } catch (error) {
          // Si falla el backend, revertir la actualización optimista
          console.error('Error al cancelar item en backend:', error);
          // Recargar datos para sincronizar estado real
          await tableOrdersHook.loadTableOrders(tableOrdersHook.selectedTable.id);
          showToast('⚠️ Error al sincronizar cancelación', 'warning');
        }
      }
      
      setIsCancelModalOpen(false);
      setCancelTarget(null);
      setCancelReason('');
    } catch (error) {
      console.error('Error cancelando:', error);
      showToast('❌ Error al cancelar', 'error');
    } finally {
      setSaving(false);
    }
  }, [cancelTarget, cancelReason, apiService, showToast, tableOrdersHook]);


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
    if (!selectedZone || !tableOrdersHook.tables) return [];
    
    return tableOrdersHook.tables
      .filter(table => 
        (table.zone_name || table.zone_detail?.name || 'Sin zona') === selectedZone.name
      )
      .sort((a, b) => {
        const aNum = parseInt(a.table_number.replace(/\D/g, '')) || 0;
        const bNum = parseInt(b.table_number.replace(/\D/g, '')) || 0;
        return aNum - bNum;
      });
  }, [selectedZone, tableOrdersHook.tables]);

  // Loading state
  if (tableOrdersHook.loading && (step === 'zones' || step === 'tables')) {
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
            <div className={`flex items-center ${step === 'zones' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step === 'zones' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-white'
              }`}>1</div>
              <span className="ml-1 hidden sm:inline text-xs">Zona</span>
            </div>
            
            {/* Separator */}
            <div className="w-8 h-0.5 bg-gray-300"></div>
            
            {/* Step 2: Mesa */}
            <div className={`flex items-center ${step === 'tables' ? 'text-blue-600 font-medium' : step === 'zones' ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step === 'tables' ? 'bg-blue-600 text-white' : 
                step === 'zones' ? 'bg-gray-200 text-gray-400' : 'bg-gray-300 text-white'
              }`}>2</div>
              <span className="ml-1 hidden sm:inline text-xs">Mesa</span>
            </div>
            
            {/* Separator */}
            <div className="w-8 h-0.5 bg-gray-300"></div>
            
            {/* Step 3: Menú */}
            <div className={`flex items-center ${step === 'menu' ? 'text-blue-600 font-medium' : ['zones', 'tables'].includes(step) ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step === 'menu' ? 'bg-blue-600 text-white' : 
                ['zones', 'tables'].includes(step) ? 'bg-gray-200 text-gray-400' : 'bg-gray-300 text-white'
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
            {step !== 'zones' && (
              <>
                <span className="mx-2">›</span>
                <span className={step === 'tables' ? 'font-medium text-gray-700' : ''}>{selectedZone?.name || 'Zona'}</span>
              </>
            )}
            {step === 'menu' && tableOrdersHook.selectedTable && (
              <>
                <span className="mx-2">›</span>
                <span>Mesa {tableOrdersHook.selectedTable.table_number}</span>
              </>
            )}
            {step === 'menu' && cartHook.currentOrder && (
              <>
                <span className="mx-2">›</span>
                <span className={step === 'menu' ? 'font-medium text-gray-700' : ''}>Pedido #{cartHook.currentOrder.id}</span>
              </>
            )}
          </div>
        </div>

        {/* Main header */}
        <div className="px-4 py-3 relative flex items-center">
          {/* Botón Atrás mejorado */}
          {step !== 'zones' && (
            <button
              onClick={async () => {
                if (step === 'tables') {
                  await handleBackToZones();
                } else if (step === 'menu') {
                  await navigateWithDataReload('tables');
                } else if (step === 'payment') {
                  await navigateWithDataReload('menu');
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
                    setSaving(true);
                    await apiService.orders.resetAll();
                    showToast('✅ Pedidos eliminados y contadores reiniciados', 'success');
                    
                    // Recargar datos
                    await tableOrdersHook.loadInitialData();
                    
                    // Volver a la vista de zonas
                    await navigateWithDataReload('zones', async () => {
                      setSelectedZone(null);
                      tableOrdersHook.setSelectedTable(null);
                      cartHook.clearCart();
                    }, true);
                  } catch (error) {
                    console.error('Error al reiniciar pedidos:', error);
                    showToast('❌ Error al reiniciar pedidos', 'error');
                  } finally {
                    setSaving(false);
                  }
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors mr-2"
              title="Reiniciar todos los pedidos y contadores"
              disabled={saving}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Reset DB</span>
            </button>
          )}

          {/* Carrito solo en vista menu - ahora posicionado correctamente */}
          {step === 'menu' && (
            <button
              onClick={() => setIsCartOpen(!isCartOpen)}
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
        {step === 'zones' && (
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
        {step === 'tables' && (
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
        {step === 'menu' && (
          <div className="h-full overflow-y-auto p-4">
            <MenuCatalog
              recipes={recipes}
              groups={groups}
              onAddToCart={handleAddToCart}
              onOpenNoteModal={openNoteModal}
            />
            
            {/* Carrito lateral */}
            <ShoppingCart
              isOpen={isCartOpen}
              onToggle={() => setIsCartOpen(!isCartOpen)}
              cart={cartHook.cart}
              currentOrder={cartHook.currentOrder}
              onRemoveFromCart={cartHook.removeFromCart}
              onSaveOrder={handleSaveOrder}
              onCloseOrder={handleCloseOrder}
              onCancelOrderItem={(id) => openCancelModal('item', id)}
              saving={saving}
              userRole={userRole}
              getItemStatusColor={getItemStatusColor}
              canCancelItem={canCancelItem}
              filterActiveItems={filterActiveItems}
            />
          </div>
        )}

      </div>

      {/* Modal de notas */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              Agregar al pedido
            </h3>
            
            <div className="mb-6">
              <p className="font-semibold text-gray-900 text-xl">{selectedRecipe?.name}</p>
              <p className="text-lg text-gray-600 mt-2">S/ {selectedRecipe?.price || selectedRecipe?.base_price}</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-lg font-medium text-gray-700 mb-3">
                  Notas especiales
                </label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full p-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Sin cebolla, extra queso, etc..."
                />
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isTakeaway}
                    onChange={(e) => setIsTakeaway(e.target.checked)}
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
      {isCancelModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {cancelTarget?.type === 'order' ? 'Cancelar Pedido' : 'Cancelar Producto'}
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  {cancelTarget?.type === 'order' 
                    ? 'Se cancelará todo el pedido. Esta acción no se puede deshacer.'
                    : 'Se cancelará este producto del pedido. Esta acción no se puede deshacer.'
                  }
                </p>
                
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de cancelación *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows={4}
                  placeholder="Ingresa el motivo de la cancelación..."
                  required
                />
                
                {!cancelReason.trim() && (
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
                  disabled={!cancelReason.trim()}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    cancelReason.trim()
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {cancelTarget?.type === 'order' ? 'Cancelar Pedido' : 'Cancelar Producto'}
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