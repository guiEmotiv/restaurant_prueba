import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/api';
import { bluetoothPrinter } from '../../utils/bluetooth';
import { ArrowLeft, Home, CreditCard, Clock, Users } from 'lucide-react';

const CashierPayment = () => {
  const { user, userRole, hasPermission } = useAuth();
  const { showToast } = useToast();
  
  // Estados
  const [servedOrders, setServedOrders] = useState([]);
  const [currentStep, setCurrentStep] = useState('orders'); // 'orders' | 'payment'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [enablePrinting, setEnablePrinting] = useState(true);

  // Cargar pedidos en estado SERVED
  const loadServedOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.orders.getServed();
      setServedOrders(response || []);
    } catch (error) {
      showToast('❌ Error al cargar pedidos', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Toggle item selection for split payment
  const toggleItemSelection = (itemId) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  // Select all SERVED items (only payable items)
  const selectAllItems = () => {
    if (selectedOrder?.items) {
      const payableItemIds = selectedOrder.items
        .filter(item => item.status === 'SERVED')
        .map(item => item.id);
      setSelectedItems(payableItemIds);
    }
  };

  // Clear item selection
  const clearItemSelection = () => {
    setSelectedItems([]);
  };

  // Calculate total for selected items
  const calculateSelectedTotal = () => {
    if (!selectedOrder?.items) return 0;
    if (selectedItems.length === 0) return 0;
    
    return selectedOrder.items
      .filter(item => selectedItems.includes(item.id))
      .reduce((sum, item) => sum + parseFloat(item.total_with_container || item.total_price || 0), 0);
  };

  // Mapear métodos de pago frontend a backend
  const mapPaymentMethod = (method) => {
    const mapping = {
      'efectivo': 'CASH',
      'tarjeta': 'CARD', 
      'transferencia': 'TRANSFER',
      'yape': 'YAPE_PLIN',
      'plin': 'YAPE_PLIN'
    };
    return mapping[method] || 'CASH';
  };


  // Procesar pago con flujo atómico: IMPRIMIR PRIMERO, PAGO DESPUÉS
  const handleProcessPayment = async (orderId) => {
    try {
      setProcessing(true);
      
      if (selectedItems.length === 0) {
        showToast('❌ Selecciona al menos un item para el pago', 'error');
        return;
      }

      const amount = calculateSelectedTotal();
      const backendPaymentMethod = mapPaymentMethod(paymentMethod);

      // [CashierPayment] Procesando pago de ${selectedItems.length} items por S/ ${amount.toFixed(2)}
      
      // ===== PASO 1: IMPRIMIR PRIMERO (SIN CAMBIAR ESTADO EN BD) =====
      let printResult = { success: true }; // Default success si printing disabled
      
      if (enablePrinting) {
        try {
          // [CashierPayment] PASO 1: Intentando imprimir recibo...
          
          if (bluetoothPrinter.isSupported()) {
            // Crear datos de recibo para los items que se van a pagar
            const receiptData = {
              id: selectedOrder.id,
              table_name: selectedOrder.table_name || selectedOrder.table?.table_number || selectedOrder.table,
              table: selectedOrder.table,
              customer_name: selectedOrder.customer_name || 'Cliente',
              party_size: selectedOrder.party_size,
              items: selectedOrder.items?.filter(item => selectedItems.includes(item.id)),
              payment_method: paymentMethod,
              payment_amount: amount,
              is_partial: true
            };
            
            await bluetoothPrinter.printOrder(receiptData);
            // [CashierPayment] Recibo impreso exitosamente
            showToast('🖨️ Recibo impreso exitosamente', 'success');
            printResult = { success: true };
            
          } else {
            // [CashierPayment] Bluetooth no soportado, saltando impresión
            printResult = { success: true }; // Continue without printing
          }
          
        } catch (printError) {
          console.error('❌ Error imprimiendo recibo:', printError);
          printResult = { success: false, error: printError.message };
          
          // Preguntar al usuario si continuar sin impresión
          const continueWithoutPrint = confirm(
            '❌ Error al imprimir recibo. ¿Continuar con el pago sin imprimir?\n\n' +
            `Error: ${printError.message}`
          );
          
          if (!continueWithoutPrint) {
            showToast('❌ Pago cancelado - No se pudo imprimir', 'error');
            return;
          }
          
          // [CashierPayment] Usuario decidió continuar sin imprimir
          printResult = { success: true, warning: 'Continuando sin impresión' };
        }
      }

      // ===== PASO 2: PROCESAR PAGO SOLO SI IMPRESIÓN FUE EXITOSA =====
      if (printResult.success) {
        // [CashierPayment] PASO 2: Procesando pago en backend...
        
        // Siempre procesar como pago parcial para actualizar states individuales de order items
        const splitData = {
          order: orderId,
          payment_method: backendPaymentMethod,
          notes: paymentNotes || `Pago ${paymentMethod} - Items: ${selectedItems.length}`,
          amount: amount,
          tax_amount: 0.00,
          payer_name: selectedOrder?.customer_name || 'Cliente',
          split_group: `split_${orderId}_${Date.now()}`,
          selected_items: selectedItems  // Enviar items seleccionados para actualizar sus estados
        };
        
        // Procesar pago en el backend
        const paymentResponse = await apiService.payments.create(splitData);
        const createdPayment = paymentResponse.data || paymentResponse;
        
        // [CashierPayment] Pago procesado exitosamente en backend
        // [CashierPayment] Payment ID: ${createdPayment.id}
        
        // ===== PASO 3: MARCAR RECIBO COMO IMPRESO EN BD (si se imprimió) =====
        if (printResult.success && enablePrinting && createdPayment.id) {
          try {
            // [CashierPayment] PASO 3: Marcando recibo como impreso en BD...
            await apiService.payments.markReceiptPrinted(createdPayment.id);
            // [CashierPayment] Recibo marcado como impreso en base de datos
          } catch (markError) {
            console.warn('⚠️ Error marcando recibo como impreso (no crítico):', markError);
            // No es crítico, el pago ya se procesó exitosamente
          }
        }
        
        showToast('💰 Pago procesado exitosamente', 'success');
        
        // Update optimista: actualizar UI después del pago exitoso
        const optimisticOrder = {
          ...selectedOrder,
          items: selectedOrder?.items?.map(item => 
            selectedItems.includes(item.id) 
              ? { ...item, status: 'PAID' }
              : item
          )
        };
        setSelectedOrder(optimisticOrder);

        // Actualizar lista de órdenes optimísticamente
        setServedOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderId ? optimisticOrder : order
          )
        );
        
        // Limpiar selección después del éxito completo
        setSelectedItems([]);
        
        if (printResult.warning) {
          showToast('⚠️ Pago procesado, pero no se imprimió recibo', 'warning');
        }
        
      } else {
        // Si llegamos aquí, hubo error crítico de impresión y usuario no quiso continuar
        showToast('❌ Pago cancelado por error de impresión', 'error');
        return;
      }

      // Recargar datos reales del servidor (en background para verificar consistencia)
      try {
        const [updatedOrders, updatedOrder] = await Promise.all([
          loadServedOrders(),
          selectedOrder ? apiService.orders.getById(selectedOrder.id) : Promise.resolve(null)
        ]);
        
        if (updatedOrder) {
          setSelectedOrder(updatedOrder);
          
          // Verificar si todos los items están pagados para cambiar de vista
          const remainingServedItems = updatedOrder.items?.filter(item => item.status === 'SERVED').length || 0;
          if (remainingServedItems === 0) {
            // Transición suave de vuelta a la lista
            setTimeout(() => {
              setCurrentStep('orders');
              setSelectedOrder(null);
              showToast('✅ Orden completamente pagada', 'success');
            }, 1000);
          }
        }
      } catch (error) {
        // En caso de error, recargar manualmente
        await loadServedOrders();
        if (selectedOrder) {
          const updatedOrder = await apiService.orders.getById(selectedOrder.id);
          setSelectedOrder(updatedOrder);
        }
      }
      
    } catch (error) {
      showToast('❌ Error al procesar pago', 'error');
      
      // Revertir cambios optimistas en caso de error
      await loadServedOrders();
      if (selectedOrder) {
        try {
          const originalOrder = await apiService.orders.getById(selectedOrder.id);
          setSelectedOrder(originalOrder);
        } catch (revertError) {
          // Error al revertir cambios optimistas
        }
      }
    } finally {
      setProcessing(false);
    }
  };

  // Memoizar cálculo de totales para evitar re-cálculos
  const orderTotals = useMemo(() => {
    const totals = new Map();
    servedOrders.forEach(order => {
      if (order?.items) {
        const total = order.items.reduce((sum, item) => 
          sum + parseFloat(item.total_with_container || item.total_price || 0), 0);
        totals.set(order.id, total);
      }
    });
    return totals;
  }, [servedOrders]);

  const calculateOrderTotal = useCallback((order) => {
    return orderTotals.get(order.id) || 0;
  }, [orderTotals]);

  // Calcular tiempo transcurrido
  const getElapsedTime = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMinutes = Math.floor((now - created) / (1000 * 60));
    
    if (diffMinutes < 60) return `${diffMinutes} min`;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  // Cargar órdenes al montar (sin auto-refresh)
  useEffect(() => {
    loadServedOrders();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white flex flex-col">
      {/* Header fijo unificado */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        {/* Progress indicator */}
        <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
          <div className="flex items-center justify-center space-x-2">
            {/* Cashier indicator */}
            <div className="flex items-center text-blue-600 font-medium">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-blue-600 text-white">
                <CreditCard className="w-3 h-3" />
              </div>
              <span className="ml-1 hidden sm:inline text-xs">Vista de Caja</span>
            </div>
          </div>
        </div>

        {/* Breadcrumb navigation with order info */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-medium">Caja</span>
              <span>{'>'}</span>
              {currentStep === 'orders' ? (
                <span className="font-medium text-blue-600">Lista de Pedidos</span>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      setCurrentStep('orders');
                      setSelectedOrder(null);
                    }}
                    className="font-medium hover:text-blue-600"
                  >
                    Lista de Pedidos
                  </button>
                  <span>{'>'}</span>
                  <span className="font-medium text-blue-600">
                    Procesar Pago - Mesa {selectedOrder?.table_name || selectedOrder?.table?.table_number || selectedOrder?.table}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium">
                  {new Date().toLocaleTimeString('es-PE', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-hidden">
        {currentStep === 'orders' ? (
          /* Lista de pedidos SERVED */
          <div className="h-full p-6 overflow-y-auto">
          {servedOrders.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay pedidos pendientes</h3>
                <p className="text-gray-500">Los pedidos listos para pago aparecerán aquí</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 max-w-5xl mx-auto">
              {servedOrders.sort((a, b) => a.id - b.id).map((order) => {
                const total = calculateOrderTotal(order);
                const itemCount = order.items?.filter(item => item.status !== 'CANCELED').length || 0;
                
                return (
                  <button
                    key={order.id}
                    onClick={() => {
                      // Solo permitir click si hay items SERVED
                      if (order.items?.some(item => item.status === 'SERVED')) {
                        setSelectedOrder(order);
                        setSelectedItems([]);
                        setCurrentStep('payment');
                      }
                    }}
                    className={`h-32 p-4 rounded-lg border transition-all duration-200 flex items-center justify-center ${
                      // Determinar color según el estado de los items
                      (() => {
                        const hasServed = order.items?.some(item => item.status === 'SERVED');
                        const hasPreparing = order.items?.some(item => item.status === 'PREPARING');
                        const hasCreated = order.items?.some(item => item.status === 'CREATED');
                        
                        if (hasServed) {
                          // Azul claro - Tiene items listos para cobrar (clickeable)
                          return 'border-blue-300 bg-blue-50 hover:bg-blue-100 cursor-pointer';
                        } else if (hasPreparing) {
                          // Amarillo claro - En preparación (no clickeable)
                          return 'border-yellow-300 bg-yellow-50 cursor-not-allowed opacity-75';
                        } else if (hasCreated) {
                          // Verde claro - Recién creado (no clickeable) 
                          return 'border-green-300 bg-green-50 cursor-not-allowed opacity-75';
                        } else {
                          // Fallback
                          return 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-75';
                        }
                      })()
                    }`}
                    disabled={!order.items?.some(item => item.status === 'SERVED')}
                  >
                    <div className="text-center w-full">
                      {/* Número de mesa más pequeño */}
                      <div className="font-bold text-lg text-gray-900 mb-1">
                        Mesa {order.table_name || order.table?.table_number || order.table}
                      </div>
                      
                      {/* Información adicional - textos más pequeños */}
                      <div className="space-y-1">
                        {/* Zona y número de pedido */}
                        <div className="text-xs font-medium text-blue-700">
                          {order.zone_name || order.table?.zone?.name || 'Zona'} • Pedido #{order.id}
                        </div>
                        
                        {/* Nombre del mesero */}
                        <div className="text-sm font-medium text-gray-700">
                          {order.waiter_name || order.waiter || 'Sin mesero'}
                        </div>
                        
                        {/* Tiempo transcurrido */}
                        <div className="flex items-center justify-center gap-1 text-xs text-gray-600">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{getElapsedTime(order.created_at)}</span>
                        </div>
                        
                        {/* Nombre del cliente */}
                        <div className="text-xs text-gray-500">
                          {order.customer_name || 'Cliente'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          </div>
        ) : (
          /* Página de procesamiento de pago - Componentes más grandes */
          <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
              
              {/* Header */}
              <div className="text-center pb-4 border-b">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedOrder?.zone_name || selectedOrder?.table?.zone?.name || 'Zona'} • Mesa {selectedOrder?.table_name || selectedOrder?.table?.table_number || selectedOrder?.table} • Pedido #{selectedOrder?.id} • {selectedOrder?.customer_name || 'Cliente'}
                </h2>
              </div>

              {/* Lista de items PRIMERO - SIN SCROLL, todos visibles */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Items del pedido</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllItems}
                      className="text-sm px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Seleccionar Todo
                    </button>
                    <button
                      onClick={clearItemSelection}
                      className="text-sm px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
                
                {/* Lista SIN scroll - mostrar items SERVED (seleccionables) y PAID (tachados) */}
                <div className="space-y-3">
                  {selectedOrder?.items?.filter(item => 
                      item.status === 'SERVED' || item.status === 'PAID' // Items servidos y pagados
                    )
                    .sort((a, b) => {
                      const nameA = (a.recipe_name || a.recipe?.name || '').toLowerCase();
                      const nameB = (b.recipe_name || b.recipe?.name || '').toLowerCase();
                      return nameA.localeCompare(nameB);
                    })
                    .map((item, index) => (
                    <div 
                      key={index} 
                      className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 border-2 ${
                        item.status === 'PAID' 
                          ? 'bg-green-50 border-green-200 opacity-75 cursor-not-allowed transform scale-98' 
                          : selectedItems.includes(item.id) 
                            ? 'bg-blue-100 border-blue-200 cursor-pointer shadow-md transform scale-102' 
                            : 'hover:bg-gray-100 border-transparent cursor-pointer hover:shadow-sm hover:transform hover:scale-101'
                      }`}
                      onClick={() => item.status === 'SERVED' && toggleItemSelection(item.id)}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {item.status === 'SERVED' ? (
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                            className="text-blue-600 w-4 h-4"
                          />
                        ) : (
                          <div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                        <span className={`text-base font-medium ${
                          item.status === 'PAID' ? 'line-through text-gray-500' : 'text-gray-900'
                        }`}>
                          {item.quantity}x {item.recipe_name || item.recipe?.name}
                          {item.is_takeaway && " (delivery)"}
                          {item.status === 'PAID' && " (PAGADO)"}
                        </span>
                      </div>
                      <span className={`text-base font-semibold ${
                        item.status === 'PAID' ? 'line-through text-gray-500' : 'text-gray-600'
                      }`}>
                        S/ {parseFloat(item.total_with_container || item.total_price || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total más grande */}
              <div className="bg-blue-50 rounded-lg p-6 text-center">
                <div className="text-sm text-gray-600 mb-2">Total a pagar</div>
                <div className="text-4xl font-bold text-blue-600">
                  S/ {calculateSelectedTotal().toFixed(2)}
                </div>
                <div className="text-base text-gray-500 mt-2">
                  {selectedItems.length > 0 
                    ? `${selectedItems.length} de ${selectedOrder?.items?.filter(item => item.status === 'SERVED').length || 0} items seleccionados`
                    : `Selecciona items para procesar el pago`
                  }
                </div>
              </div>

              {/* Método de pago más grande */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-3">Método de pago</label>
                <div className="grid grid-cols-2 gap-3">
                  {['efectivo', 'tarjeta', 'yape', 'plin'].map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`p-4 rounded-lg border-2 text-base font-semibold transition-all duration-200 ${
                        paymentMethod === method
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {method.charAt(0).toUpperCase() + method.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comentarios más grandes */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Comentarios (opcional)</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  placeholder="Información adicional del pago..."
                />
              </div>

              {/* Checkbox para impresión */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enablePrinting}
                    onChange={(e) => setEnablePrinting(e.target.checked)}
                    className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-base font-medium text-gray-700">
                    Imprimir recibo
                  </span>
                </label>
              </div>

              {/* Botones de pago e impresión */}
              <div className="space-y-3">
                {/* Botón de pago principal */}
                <button
                  onClick={() => handleProcessPayment(selectedOrder?.id)}
                  disabled={processing || selectedItems.length === 0}
                  className={`w-full py-4 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-3 text-xl font-bold transform ${
                    !processing && selectedItems.length > 0
                      ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  {processing ? (
                    <>
                      <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      <span className="animate-pulse">Procesando pago...</span>
                    </>
                  ) : selectedItems.length === 0 ? (
                    <>
                      <CreditCard className="w-6 h-6" />
                      <span>Seleccionar Items para Pagar</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-6 h-6 animate-bounce" />
                      <span>
                        Procesar Pago (S/{calculateSelectedTotal().toFixed(2)})
                      </span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashierPayment;