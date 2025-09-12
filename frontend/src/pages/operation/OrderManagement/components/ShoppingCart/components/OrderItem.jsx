import { memo, useState, useEffect } from 'react';
import { useToast } from '../../../../../../contexts/ToastContext';
import { apiService } from '../../../../../../services/api';
import { getItemStatusColor } from '../../../utils/orderHelpers';

const OrderItem = ({ 
  item, 
  itemNumber, 
  onCancelItem,
  onStatusChange,
  saving = false 
}) => {
  const { showError, showSuccess } = useToast();
  const [printJob, setPrintJob] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  

  // Función para cambiar automáticamente el estado del OrderItem
  const handleAutoStatusTransition = async (printJobStatus) => {
    console.log(`🔄 PRINT-FLOW FRONTEND - Item #${item.id} handleAutoStatusTransition called`);
    console.log(`🔄 PRINT-FLOW FRONTEND - PrintJob status: ${printJobStatus}, Item status: ${item.status}, UpdatingStatus: ${updatingStatus}`);
    
    // Solo cambiar CREATED → PREPARING cuando el print job está "printed"
    if (printJobStatus === 'printed' && item.status === 'CREATED' && !updatingStatus) {
      console.log(`✅ PRINT-FLOW FRONTEND - Condiciones cumplidas, iniciando transición CREATED → PREPARING para item #${item.id}`);
      console.log(`📊 PRINT-FLOW FRONTEND - PrintJob completado exitosamente, cambiando OrderItem status`);
      setUpdatingStatus(true);
      try {
        await apiService.orderItems.updateStatus(item.id, { status: 'PREPARING' });
        console.log(`✅ PRINT-FLOW FRONTEND - Item #${item.id} actualizado exitosamente a PREPARING`);
        
        // Notificar al componente padre del cambio de estado
        if (onStatusChange) {
          onStatusChange(item.id, 'PREPARING');
          console.log(`📢 PRINT-FLOW FRONTEND - Notificando al padre del cambio de estado para item #${item.id}`);
        }
        
      } catch (error) {
        console.error(`❌ PRINT-FLOW FRONTEND - Error al cambiar estado del item #${item.id}:`, error);
        showError(`Error al cambiar estado del item automáticamente: ${error.message}`);
      } finally {
        setUpdatingStatus(false);
      }
    } else {
      console.log(`⚠️ PRINT-FLOW FRONTEND - Transición no realizada para item #${item.id}:`);
      console.log(`   • PrintJob 'printed': ${printJobStatus === 'printed'}`);
      console.log(`   • Item 'CREATED': ${item.status === 'CREATED'}`);
      console.log(`   • Not updating: ${!updatingStatus}`);
    }
  };

  // Verificar estado de impresión del item
  const checkPrintStatus = async () => {
    if (!item.id) return;
    
    console.log(`🔍 PRINT-FLOW FRONTEND - Verificando estado de impresión para item #${item.id}`);
    
    try {
      const jobs = await apiService.printQueue.getJobsByOrderItem(item.id);
      const latestJob = jobs.length > 0 ? jobs[0] : null;
      
      console.log(`🔍 PRINT-FLOW FRONTEND - Item #${item.id} print jobs encontrados: ${jobs.length}`);
      if (latestJob) {
        console.log(`🔍 PRINT-FLOW FRONTEND - Item #${item.id} último job: #${latestJob.id} status=${latestJob.status}`);
      }
      
      // Establecer el print job
      setPrintJob(latestJob);
      
      // Verificar si necesitamos transición automática de estado
      if (latestJob) {
        await handleAutoStatusTransition(latestJob.status);
      } else {
        console.log(`⚠️ PRINT-FLOW FRONTEND - Item #${item.id} no tiene print jobs asociados`);
      }
      
    } catch (error) {
      console.error(`❌ PRINT-FLOW FRONTEND - Error checking print status for item #${item.id}:`, error);
    }
  };

  // Verificar estado al montar y cuando cambia el item
  useEffect(() => {
    checkPrintStatus();
    
    // Escuchar evento personalizado para refrescar estado
    const handleRefreshEvent = () => {
      checkPrintStatus();
    };
    
    window.addEventListener('refreshPrintStatus', handleRefreshEvent);
    
    // Polling híbrido inteligente basado en estado del PrintJob
    // OPTIMIZACIÓN: Velocidad adaptativa según criticidad del estado
    const getPollingInterval = (status) => {
      switch (status) {
        case 'pending': return 2000;      // 2s - verificación rápida cuando creado
        case 'in_progress': return 1000;  // 1s - súper rápido cuando imprimiendo  
        case 'failed': return 3000;       // 3s - reintento moderado para errores
        default: return 1000;             // 1s - estados terminales rápidos para restaurante
      }
    };
    
    let interval;
    if (printJob?.status && ['pending', 'in_progress', 'failed'].includes(printJob.status)) {
      const intervalTime = getPollingInterval(printJob.status);
      console.log(`🔄 PRINT-FLOW FRONTEND - Iniciando polling HÍBRIDO para Item #${item.id} con status=${printJob.status} (${intervalTime}ms)`);
      interval = setInterval(checkPrintStatus, intervalTime);
    }
    
    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener('refreshPrintStatus', handleRefreshEvent);
    };
  }, [item.id, item.status, printJob?.status]);

  // Manejar reintento de impresión
  const handleRetryPrint = async () => {
    if (!printJob?.id) return;
    
    setRetrying(true);
    try {
      await apiService.printQueue.retryJob(printJob.id);
      // Eliminado mensaje de éxito innecesario
      
      // Verificar estado después del reintento
      setTimeout(checkPrintStatus, 1000);
    } catch (error) {
      console.error('Error retrying print:', error);
      showError('Error al reintentar impresión');
    } finally {
      setRetrying(false);
    }
  };

  // Manejar cancelación del item
  const handleCancelItem = () => {
    if (onCancelItem && item.id) {
      onCancelItem(item.id);
    }
  };

  // Verificar si el item se puede cancelar (CREATED o PREPARING)
  const canCancel = ['CREATED', 'PREPARING'].includes(item.status);

  // Renderizar indicador de estado de impresión - Botón solo para error, texto para otros
  const renderPrintStatus = () => {
    if (!printJob) {
      return null; // No mostrar nada si no hay trabajo de impresión
    }

    // Solo mostrar el botón de reintento para 'failed', otros estados ocultos para meseros

    switch (printJob.status) {
      case 'pending':
        return null; // Oculto para meseros
      case 'in_progress':
        return null; // Oculto para meseros  
      case 'printed':
        return null; // Oculto para meseros
      case 'failed':
        return (
          <button
            onClick={handleRetryPrint}
            disabled={retrying || saving}
            className="text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
            title="Hacer clic para reintentar impresión"
          >
            {retrying ? 'Reintentando...' : 'Error - Reintentar'}
          </button>
        );
      case 'cancelled':
        return null; // Oculto para meseros
      default:
        return null; // No mostrar estados desconocidos
    }
  };

  return (
    <div className="px-6 py-4 border-b border-gray-100 bg-blue-50/30">
      <div className="flex items-center gap-4">
        {/* Número del item con color de estado */}
        <div className="flex-shrink-0">
          <div 
            className={`w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center text-white ${getItemStatusColor(item.status)}`}
            title={`Estado: ${item.status}`}
          >
            {itemNumber}.
          </div>
        </div>
        
        {/* Info del item */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-medium text-gray-900 truncate">
              {item.recipe_name || item.recipe?.name || item.name}
            </h4>
            
            {item.is_takeaway && (
              <div className="flex items-center bg-orange-100 text-orange-600 p-2 rounded-full" title="Para llevar">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            )}
          </div>
          
          <div className="text-lg text-gray-500 mt-1">
            <p>x{item.quantity} • S/ {(item.total_with_container || item.total_price || 0).toFixed(2)}</p>
            
            {/* Mostrar desglose de envase solo si es para llevar y hay costo de envase */}
            {item.is_takeaway && item.container_price > 0 && (
              <p className="text-gray-400 text-sm">
                Plato: S/ {(item.unit_price || 0).toFixed(2)} + Envase: S/ {(item.container_price || 0).toFixed(2)}
              </p>
            )}
            
            {item.notes && (
              <p className="text-gray-400 text-sm">
                Nota: {item.notes}
              </p>
            )}
          </div>
        </div>

        {/* Estado de impresión y acciones en la derecha extrema */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {/* Estado de impresión */}
          <div>
            {renderPrintStatus()}
          </div>
          
          {/* Icono de cancelar - Solo para CREATED y PREPARING - Oculto en dev */}
          {canCancel && onCancelItem && import.meta.env.MODE !== 'development' && (
            <button
              onClick={handleCancelItem}
              disabled={saving}
              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
              title="Cancelar item"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Memoize optimizado para evitar re-renders innecesarios
export default memo(OrderItem, (prevProps, nextProps) => {
  // Comparación más estricta para mejor rendimiento
  const itemChanged = (
    prevProps.item.id !== nextProps.item.id ||
    prevProps.item.status !== nextProps.item.status ||
    prevProps.item.recipe_name !== nextProps.item.recipe_name ||
    prevProps.item.quantity !== nextProps.item.quantity ||
    prevProps.item.total_with_container !== nextProps.item.total_with_container
  );
  
  const propsChanged = (
    prevProps.itemNumber !== nextProps.itemNumber ||
    prevProps.saving !== nextProps.saving ||
    prevProps.onStatusChange !== nextProps.onStatusChange ||
    prevProps.onCancelItem !== nextProps.onCancelItem
  );
  
  // Solo re-render si hay cambios reales
  return !itemChanged && !propsChanged;
});