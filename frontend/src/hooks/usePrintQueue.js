/**
 * Hook minimalista para monitorear estado de cola de impresión
 * Diseñado para ser sutil y no interrumpir la UX existente
 */
import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const usePrintQueue = (orderId = null, enabled = true) => {
  const [status, setStatus] = useState({
    pending: 0,
    failed: 0,
    loading: false,
    lastUpdate: null
  });

  useEffect(() => {
    if (!enabled) return;

    let interval;

    const checkStatus = async () => {
      try {
        setStatus(prev => ({ ...prev, loading: true }));
        
        let data;
        if (orderId) {
          // Verificar trabajos específicos de un pedido
          const jobs = await apiService.printQueue.getOrderJobs(orderId);
          data = {
            pending_count: jobs.filter(j => j.status === 'pending').length,
            failed_count: jobs.filter(j => j.status === 'failed').length
          };
        } else {
          // Estado general de la cola
          data = await apiService.printQueue.getStatus();
        }

        setStatus({
          pending: data.pending_count || 0,
          failed: data.failed_count || 0,
          loading: false,
          lastUpdate: new Date()
        });

      } catch (error) {
        // Fallar silenciosamente - no mostrar errores al usuario
        setStatus(prev => ({ 
          ...prev, 
          loading: false,
          lastUpdate: new Date()
        }));
      }
    };

    // Check inicial
    checkStatus();

    // Polling cada 15 segundos (sutil, no agresivo)
    if (enabled) {
      interval = setInterval(checkStatus, 15000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [orderId, enabled]);

  // Función para reintentar trabajos fallidos
  const retryFailed = async () => {
    try {
      await apiService.printQueue.retryFailed();
      // Actualizar estado inmediatamente
      setTimeout(() => {
        // Re-check después de un momento
        if (enabled) {
          checkStatus();
        }
      }, 1000);
      return true;
    } catch (error) {
      console.warn('Retry failed jobs error:', error);
      return false;
    }
  };

  return {
    ...status,
    retryFailed,
    hasIssues: status.failed > 0,
    isEmpty: status.pending === 0 && status.failed === 0
  };
};

export default usePrintQueue;