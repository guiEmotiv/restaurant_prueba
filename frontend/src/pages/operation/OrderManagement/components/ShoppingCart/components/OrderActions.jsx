import { useState } from 'react';
import { apiService } from '../../../../../../services/api';
import { useToast } from '../../../../../../contexts/ToastContext';
import CancelOrderButton from '../../CancelOrderButton';

const OrderActions = ({ 
  cart,
  currentOrder,
  customerName,
  partySize,
  onSaveOrder,
  onUpdateCurrentOrder,
  onCloseOrder,
  onNavigateToZones,
  onOrderCanceled,
  saving = false
}) => {
  const { showSuccess, showError } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  
  // Verificar si todos los OrderItems NO CANCELADOS están en PREPARING
  const activeItems = currentOrder?.items?.filter(item => item.status !== 'CANCELED') || [];
  const allItemsInPreparing = activeItems.length > 0 && 
    activeItems.every(item => item.status === 'PREPARING');

  // Verificar si todos los OrderItems están CANCELED (y no hay items en el carrito)
  const allItemsAreCanceled = currentOrder?.items?.length > 0 && 
    activeItems.length === 0 && 
    cart.length === 0;

  // LOG: Estado de condiciones para botones
  console.log('🟦 [ORDER-ACTIONS] RENDER - Estado de condiciones para botones:', {
    hasCurrentOrder: !!currentOrder,
    currentOrderId: currentOrder?.id,
    hasOrderItems: currentOrder?.items?.length > 0,
    totalItemCount: currentOrder?.items?.length || 0,
    activeItemCount: activeItems.length,
    canceledItemCount: (currentOrder?.items?.length || 0) - activeItems.length,
    allItemsInPreparing,
    allItemsAreCanceled,
    cartLength: cart.length,
    cartEmpty: cart.length === 0,
    shouldShowCloseButton: !!(activeItems.length > 0 && allItemsInPreparing && cart.length === 0),
    shouldShowCancelOrderButton: allItemsAreCanceled,
    allItemStatuses: currentOrder?.items?.map(item => ({ id: item.id, status: item.status })),
    activeItemStatuses: activeItems.map(item => ({ id: item.id, status: item.status })),
    timestamp: new Date().toISOString()
  });
  
  // Determinar el texto del botón según el contexto
  const isUpdatingExistingOrder = currentOrder && currentOrder.id && cart.length > 0;
  const buttonText = isUpdatingExistingOrder ? 'Actualizar Pedido' : 'Crear Pedido';
  
  // Determinar si se puede guardar - Para actualizar no necesitamos customerName/partySize
  // Convertir partySize a string para poder usar trim()
  const partySizeStr = String(partySize || '');
  const customerNameStr = String(customerName || '');
  
  const canSave = cart.length > 0 && (
    isUpdatingExistingOrder || (customerNameStr.trim() && partySizeStr.trim())
  );
  
  
  // Handler para crear/actualizar pedido
  const handleSaveOrder = () => {
    onSaveOrder({
      customerName: customerNameStr.trim(),
      partySize: partySizeStr.trim()
    });
  };

  // Función para consultar estado de impresión y actualizar order items
  const handleRefreshPrintStatus = async () => {
    console.log('🔘 [ORDER-ACTIONS] Botón Consultar Estado PRESIONADO');
    
    if (!activeItems.length) {
      console.log('❌ [ORDER-ACTIONS] No hay order items activos para consultar');
      showError('No hay order items activos para consultar');
      return;
    }
    
    setRefreshing(true);
    try {
      console.log('🔍 [ORDER-ACTIONS] Consultando estados de impresión y actualizando order items...');
      
      // 1. Consultar estados de todos los order items activos (no cancelados)
      const printStatusPromises = activeItems.map(async (item) => {
        try {
          const jobs = await apiService.printQueue.getJobsByOrderItem(item.id);
          const latestJob = jobs.length > 0 ? jobs[0] : null;
          return {
            orderItemId: item.id,
            printStatus: latestJob?.status || null,
            currentStatus: item.status,
            latestJobId: latestJob?.id || null
          };
        } catch (error) {
          console.error(`Error fetching print status for item ${item.id}:`, error);
          return {
            orderItemId: item.id,
            printStatus: null,
            currentStatus: item.status,
            latestJobId: null
          };
        }
      });
      
      const printStatuses = await Promise.all(printStatusPromises);
      console.log('🔍 [ORDER-ACTIONS] Estados de impresión obtenidos:', printStatuses);
      
      // 2. Procesar cada order item según su estado de impresión
      let printedCount = 0;
      let failedCount = 0;
      let retryCount = 0;
      let pendingCount = 0;
      const updatePromises = [];
      
      console.log(`🔍 [ORDER-ACTIONS] Procesando ${printStatuses.length} items:`, printStatuses);
      
      for (const item of printStatuses) {
        // Solo procesar items que están en CREATED
        if (item.currentStatus !== 'CREATED') {
          console.log(`⏭️ [ORDER-ACTIONS] Item ${item.orderItemId}: Ya no está en CREATED (${item.currentStatus}), omitiendo`);
          continue;
        }
        
        console.log(`🔍 [ORDER-ACTIONS] Procesando item ${item.orderItemId} con print status: ${item.printStatus}`);
        
        switch (item.printStatus) {
          case 'printed':
            // Solo si está impreso, cambiar a PREPARING
            printedCount++;
            console.log(`✅ [ORDER-ACTIONS] Item ${item.orderItemId}: Cambiando CREATED -> PREPARING (printed)`);
            updatePromises.push(
              apiService.orderItems.updateStatus(item.orderItemId, { status: 'PREPARING' })
                .then((response) => {
                  console.log(`✅ [ORDER-ACTIONS] Item ${item.orderItemId}: Estado actualizado a PREPARING`, response);
                  return { success: true, orderItemId: item.orderItemId, action: 'printed', response };
                })
                .catch(error => {
                  console.error(`❌ [ORDER-ACTIONS] Error actualizando item ${item.orderItemId}:`, error);
                  console.error(`❌ [ORDER-ACTIONS] Error response:`, error.response?.data);
                  console.error(`❌ [ORDER-ACTIONS] Error status:`, error.response?.status);
                  return { success: false, orderItemId: item.orderItemId, error, action: 'printed' };
                })
            );
            break;
            
          case 'failed':
            // Si falló, intentar reenviar a imprimir usando el job ID específico
            failedCount++;
            if (item.latestJobId) {
              try {
                console.log(`🔄 [ORDER-ACTIONS] Item ${item.orderItemId}: Reintentando job ${item.latestJobId} (failed)`);
                const retryResult = await apiService.printQueue.retryJob(item.latestJobId);
                console.log(`✅ [ORDER-ACTIONS] Retry exitoso para job ${item.latestJobId}:`, retryResult);
                retryCount++;
              } catch (error) {
                console.error(`❌ [ORDER-ACTIONS] Error reintentando job ${item.latestJobId} del item ${item.orderItemId}:`, error);
              }
            } else {
              console.log(`⚠️ [ORDER-ACTIONS] Item ${item.orderItemId}: Sin job ID para reintentar`);
            }
            break;
            
          case 'pending':
          case 'in_progress':
            pendingCount++;
            console.log(`⏳ [ORDER-ACTIONS] Item ${item.orderItemId}: Manteniendo CREATED (estado impresión: ${item.printStatus})`);
            break;
            
          default:
            console.log(`❓ [ORDER-ACTIONS] Item ${item.orderItemId}: Estado impresión desconocido (${item.printStatus || 'null'}), manteniendo CREATED`);
            break;
        }
      }
      
      // Ejecutar actualizaciones de estados
      if (updatePromises.length > 0) {
        const updateResults = await Promise.all(updatePromises);
        const successCount = updateResults.filter(r => r.success).length;
        
        if (successCount > 0) {
          showSuccess(`${successCount} items actualizados a PREPARING`);
          
          // Actualizar la orden actual para reflejar los cambios
          if (onUpdateCurrentOrder) {
            const updatedOrder = await apiService.orders.get(currentOrder.id);
            onUpdateCurrentOrder(updatedOrder);
          }
        }
      }
      
      // Mostrar resumen de acciones
      const messages = [];
      if (printedCount > 0) messages.push(`${printedCount} items → PREPARING`);
      if (retryCount > 0) messages.push(`${retryCount} items reenviados`);
      if (pendingCount > 0) messages.push(`${pendingCount} items pendientes`);
      if (failedCount > retryCount) messages.push(`${failedCount - retryCount} reintentos fallaron`);
      
      if (messages.length > 0) {
        showSuccess(`Gestión de impresión: ${messages.join(', ')}`);
      } else {
        showSuccess('No hay items para procesar');
      }
      
      console.log(`📊 [ORDER-ACTIONS] Resumen: ${printedCount} printed, ${failedCount} failed, ${retryCount} retried, ${pendingCount} pending`);
      
      // 4. Verificar si TODOS los OrderItems están en PREPARING para actualizar el Order
      if (onUpdateCurrentOrder && currentOrder) {
        console.log('🔄 [ORDER-ACTIONS] Obteniendo orden actualizada desde API...');
        const updatedOrder = await apiService.orders.get(currentOrder.id);
        console.log('🔄 [ORDER-ACTIONS] Orden obtenida desde API:', {
          orderId: updatedOrder.id,
          status: updatedOrder.status,
          itemsCount: updatedOrder.items?.length,
          items: updatedOrder.items?.map(item => ({ id: item.id, status: item.status }))
        });
        
        // Verificar si todos los items activos (no cancelados) están en PREPARING
        const updatedActiveItems = updatedOrder.items?.filter(item => item.status !== 'CANCELED') || [];
        const allItemsInPreparing = updatedActiveItems.length > 0 && 
          updatedActiveItems.every(item => item.status === 'PREPARING');
        
        console.log('🔄 [ORDER-ACTIONS] Verificación de estados:', {
          allItemsInPreparing,
          currentOrderStatus: updatedOrder.status,
          shouldUpdate: allItemsInPreparing && updatedOrder.status === 'CREATED'
        });
        
        if (allItemsInPreparing && updatedOrder.status === 'CREATED') {
          console.log('🔄 [ORDER-ACTIONS] Todos los items están en PREPARING, actualizando Order a PREPARING');
          try {
            // Actualizar el estado del Order a PREPARING
            const orderUpdateResponse = await apiService.orders.updateStatus(currentOrder.id, 'PREPARING');
            console.log('✅ [ORDER-ACTIONS] Order actualizado a PREPARING:', orderUpdateResponse);
            
            // Actualizar la orden en el estado local con el nuevo status
            onUpdateCurrentOrder({
              ...updatedOrder,
              status: 'PREPARING'
            });
            
            showSuccess('Todos los items están en preparación. El pedido está listo para cocina.');
          } catch (error) {
            console.error('❌ [ORDER-ACTIONS] Error actualizando Order a PREPARING:', error);
            
            // Si el error es que ya está en PREPARING, no mostrar error al usuario
            if (error.response?.data?.status?.includes('PREPARING a PREPARING')) {
              console.log('ℹ️ [ORDER-ACTIONS] Order ya está en PREPARING, actualizando estado local');
              onUpdateCurrentOrder({
                ...updatedOrder,
                status: 'PREPARING'
              });
            } else {
              showError('Error al actualizar el estado del pedido');
            }
          }
        } else {
          // Solo actualizar la orden con los cambios de items
          console.log('🔄 [ORDER-ACTIONS] Actualizando orden con cambios de items (sin cambio de Order status)');
          console.log('🔄 [ORDER-ACTIONS] Llamando onUpdateCurrentOrder con:', {
            orderId: updatedOrder.id,
            status: updatedOrder.status,
            itemsStatus: updatedOrder.items?.map(item => `${item.id}:${item.status}`)
          });
          onUpdateCurrentOrder(updatedOrder);
        }
      }
      
      // 5. Verificar si todos los items activos están en PREPARING para navegar a zonas
      if (onUpdateCurrentOrder && currentOrder) {
        const finalOrder = await apiService.orders.get(currentOrder.id);
        const finalActiveItems = finalOrder.items?.filter(item => item.status !== 'CANCELED') || [];
        const finalAllItemsInPreparing = finalActiveItems.length > 0 && 
          finalActiveItems.every(item => item.status === 'PREPARING');
        
        if (finalAllItemsInPreparing) {
          console.log('🚀 [ORDER-ACTIONS] Todos los items están en PREPARING, navegando a vista de zonas...');
          console.log('🚀 [ORDER-ACTIONS] onNavigateToZones disponible:', !!onNavigateToZones);
          showSuccess('Pedido enviado a cocina');
          
          // Navegar inmediatamente a la vista de zonas
          console.log('🚀 [ORDER-ACTIONS] Ejecutando navegación inmediata...');
          if (onNavigateToZones) {
            console.log('🚀 [ORDER-ACTIONS] Llamando onNavigateToZones()');
            onNavigateToZones();
          } else {
            console.error('❌ [ORDER-ACTIONS] onNavigateToZones no está disponible');
          }
        } else {
          console.log('ℹ️ [ORDER-ACTIONS] No todos los items activos están en PREPARING, no navegando:', {
            finalAllItemsInPreparing,
            totalItemsCount: finalOrder.items?.length,
            activeItemsCount: finalActiveItems.length,
            canceledItemsCount: (finalOrder.items?.length || 0) - finalActiveItems.length,
            allItems: finalOrder.items?.map(item => ({ id: item.id, status: item.status })),
            activeItems: finalActiveItems.map(item => ({ id: item.id, status: item.status }))
          });
        }
      }
      
      // 6. Disparar evento para actualizar indicadores visuales
      window.dispatchEvent(new CustomEvent('refreshPrintStatus'));
      
    } catch (error) {
      console.error('🔍 [ORDER-ACTIONS] Error en consulta general:', error);
      showError('Error al consultar estados de impresión');
    } finally {
      setRefreshing(false);
    }
  };



  return (
    <div className="p-6 space-y-4">
      
      {/* Crear/Actualizar Pedido */}
      {cart.length > 0 && (
        <button
          onClick={handleSaveOrder}
          disabled={saving || !canSave}
          className={`w-full py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 font-medium text-lg ${
            !saving && canSave
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              : 'bg-blue-400 text-blue-200 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Guardando...</span>
            </>
          ) : (
            <span>{buttonText}</span>
          )}
        </button>
      )}

      {/* Consultar Estado de Impresión - Solo mostrar si NO todos los items activos están en PREPARING */}
      {activeItems.length > 0 && !allItemsInPreparing && (
        <button
          onClick={handleRefreshPrintStatus}
          disabled={refreshing || saving}
          className={`w-full py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 font-medium text-lg ${
            !refreshing && !saving
              ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
              : 'bg-green-400 text-green-200 cursor-not-allowed'
          }`}
        >
          {refreshing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Consultando...</span>
            </>
          ) : (
            <span>Consultar Estado de Impresión</span>
          )}
        </button>
      )}
      
      {/* Cerrar Pedido - Solo mostrar si TODOS los items activos están en PREPARING Y NO HAY ITEMS NUEVOS */}
      {activeItems.length > 0 && allItemsInPreparing && cart.length === 0 && (
        <button
          onClick={() => {
            console.log('🔴 [ORDER-ACTIONS] Botón Cerrar Pedido PRESIONADO:', {
              currentOrderId: currentOrder?.id,
              onCloseOrderAvailable: !!onCloseOrder,
              allItemsInPreparing,
              cartLength: cart.length,
              currentOrderItems: currentOrder?.items?.map(item => ({ id: item.id, status: item.status })),
              timestamp: new Date().toISOString()
            });
            
            if (onCloseOrder) {
              console.log('🔴 [ORDER-ACTIONS] Llamando onCloseOrder con ID:', currentOrder.id);
              onCloseOrder(currentOrder.id);
            } else {
              console.error('❌ [ORDER-ACTIONS] onCloseOrder NO está disponible');
            }
          }}
          disabled={saving}
          className={`w-full py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 font-medium text-lg ${
            !saving
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              : 'bg-blue-400 text-blue-200 cursor-not-allowed'
          }`}
        >
          <span>Cerrar Pedido</span>
        </button>
      )}
      
      {/* Cancelar Pedido Completo - Oculto para meseros */}
      {false && allItemsAreCanceled && (
        <CancelOrderButton
          currentOrder={currentOrder}
          onOrderCanceled={onOrderCanceled}
          saving={saving}
        />
      )}





    </div>
  );
};

export default OrderActions;