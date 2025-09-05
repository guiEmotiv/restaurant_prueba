import { useState, useEffect, useCallback, useRef } from 'react';
import api, { apiService, API_BASE_URL } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Clock, Users, Utensils } from 'lucide-react';

const Kitchen = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // Estados
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBackButton, setShowBackButton] = useState(false);
  const [previousOrderIds, setPreviousOrderIds] = useState(new Set());

  // Hook para tiempo actual optimizado
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Actualizar tiempo cada segundo (solo la referencia de tiempo)
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timeInterval);
  }, []);

  // Función memoizada para calcular tiempo transcurrido
  const getElapsedTime = useCallback((createdAt) => {
    const created = new Date(createdAt);
    const diffMs = currentTime - created;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }, [currentTime]);

  // Función para reproducir sonido de notificación
  const playNotificationSound = async () => {
    try {
      // Método 1: Web Audio API (más control)
      let audioContext;
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Reanudar contexto si está suspendido
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Conectar nodos
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Configurar sonido - tono alto y fuerte
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
        oscillator.type = 'square'; // Sonido más penetrante
        
        // Configurar volumen al máximo
        gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        // Reproducir sonido por 400ms
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
        
        console.log('🔊 Sonido reproducido - Nuevo pedido en cocina');
        
      } catch (webAudioError) {
        console.warn('Web Audio API falló, intentando método alternativo:', webAudioError);
        
        // Método 2: Audio HTML5 con data URL (backup)
        const audioData = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmE';
        const audio = new Audio(audioData);
        audio.volume = 1.0;
        await audio.play();
      }
      
    } catch (error) {
      console.error('Error al reproducir sonido de notificación:', error);
      
      // Método 3: Notificación visual como último recurso
      if (document.hidden) {
        document.title = '🔔 Nuevo Pedido - Vista de Cocina';
        setTimeout(() => {
          document.title = 'Vista de Cocina';
        }, 3000);
      }
    }
  };

  // Función para manejar click en tarjeta
  const handleCardClick = async (order) => {
    console.log('Tarjeta clickeada:', order);
    
    try {
      // Filtrar solo los items que están en estado CREATED
      const itemsToUpdate = order.items.filter(item => item.status === 'CREATED');
      
      if (itemsToUpdate.length === 0) {
        showToast('No hay items pendientes para preparar', 'info');
        return;
      }
      
      // Mostrar loading mientras se actualiza
      showToast(`Iniciando preparación de ${itemsToUpdate.length} items...`, 'info');
      
      // Actualizar todos los items a estado PREPARING usando el endpoint correcto
      const updatePromises = itemsToUpdate.map(async (item) => {
        try {
          // Usar api para incluir autenticación
          const response = await api.post(`/order-items/${item.id}/update_status/`, {
            status: 'PREPARING'
          });
          
          console.log(`✅ Item ${item.id} actualizado a PREPARING`);
          return response.data;
        } catch (error) {
          console.error(`❌ Error actualizando item ${item.id}:`, error);
          throw error;
        }
      });
      
      // Ejecutar todas las actualizaciones en paralelo
      await Promise.all(updatePromises);
      
      // También actualizar el estado del pedido a PREPARING si está en CREATED
      if (order.status === 'CREATED') {
        try {
          const orderResponse = await api.post(`/orders/${order.id}/update_status/`, {
            status: 'PREPARING'
          });
          
          console.log(`✅ Pedido ${order.id} actualizado a PREPARING`);
        } catch (error) {
          console.error(`❌ Error actualizando pedido ${order.id}:`, error);
        }
      }
      
      // Mostrar mensaje de éxito
      showToast(`¡${itemsToUpdate.length} items en preparación!`, 'success');
      
      // Recargar las órdenes para mostrar el estado actualizado
      await loadOrders();
      
    } catch (error) {
      console.error('Error al actualizar items a PREPARING:', error);
      showToast(`Error al iniciar preparación: ${error.message}`, 'error');
    }
  };

  // Cargar órdenes activas
  const loadOrders = useCallback(async () => {
    try {
      const ordersData = await apiService.orders.getAll();
      
      // Filtrar órdenes que tengan items CREATED para preparar
      const activeOrders = ordersData
        .filter(order => {
          // Solo mostrar órdenes que tengan al menos un item CREATED
          if (!order.items || order.items.length === 0) return false;
          const hasCreatedItems = order.items.some(item => item.status === 'CREATED');
          return hasCreatedItems && order.status !== 'CANCELED' && order.status !== 'PAID';
        })
        .sort((a, b) => a.id - b.id); // Ordenar de menor a mayor
      
      // Detectar nuevos pedidos con items CREATED
      const currentOrderIds = new Set(activeOrders.map(order => order.id));
      const newCreatedOrders = activeOrders.filter(order => 
        !previousOrderIds.has(order.id)
      );
      
      // Solo reproducir sonido si hay nuevos pedidos Y no es la primera carga
      if (newCreatedOrders.length > 0 && previousOrderIds.size > 0) {
        console.log(`🆕 ${newCreatedOrders.length} nuevo(s) pedido(s) CREATED detectado(s):`, newCreatedOrders.map(o => `#${o.id}`));
        playNotificationSound();
      } else if (previousOrderIds.size === 0) {
        console.log(`ℹ️ Primera carga: ${activeOrders.length} pedidos encontrados, no se reproduce sonido`);
      }
      
      setPreviousOrderIds(currentOrderIds);
      setOrders(activeOrders);
    } catch (error) {
      if (error.message !== 'NETWORK_ERROR_SILENT') {
        showToast(`Error al cargar órdenes: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Habilitar audio con interacción del usuario
  useEffect(() => {
    const enableAudio = () => {
      // Crear y reanudar contexto de audio para habilitar sonidos
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        console.log('🔊 Audio habilitado para notificaciones');
      } catch (error) {
        console.warn('No se pudo habilitar audio:', error);
      }
      
      // Remover listener después del primer click
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('keydown', enableAudio);
    };
    
    document.addEventListener('click', enableAudio);
    document.addEventListener('keydown', enableAudio);
    
    return () => {
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('keydown', enableAudio);
    };
  }, []);

  // Cargar órdenes al montar
  useEffect(() => {
    loadOrders();
    
    // Recargar cada 45 segundos (menos agresivo)
    const interval = setInterval(loadOrders, 45000);
    
    return () => {
      clearInterval(interval);
    };
  }, [loadOrders]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Cargando cocina...</p>
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
            {/* Kitchen indicator */}
            <div className="flex items-center text-blue-600 font-medium">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-blue-600 text-white">
                <Utensils className="w-3 h-3" />
              </div>
              <span className="ml-1 hidden sm:inline text-xs">Vista de Cocina</span>
            </div>
          </div>
        </div>

        {/* Breadcrumb navigation with order info */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span className="font-medium">Vista de Cocina</span>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="font-medium">{orders.length} pedidos</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="font-medium">{orders.reduce((total, order) => total + (order.party_size || 1), 0)} clientes</span>
              </div>
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
        <div className="h-full p-6 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Utensils className="w-12 h-12 text-gray-400" />
              </div>
              <p className="text-xl text-gray-500">No hay pedidos activos</p>
              <p className="text-gray-400 mt-2">Los pedidos aparecerán aquí cuando se creen</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map(order => (
              <button 
                key={order.id} 
                onClick={() => handleCardClick(order)}
                className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 min-h-[400px] w-full shadow-sm flex flex-col text-left hover:scale-[1.02] active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {/* Header compacto */}
                <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center justify-between min-w-0">
                    <div className="text-lg lg:text-xl font-bold text-gray-900 flex-shrink-0">
                      #{order.id}
                    </div>
                    <div className="text-xl lg:text-2xl text-gray-800 font-bold text-center flex-1">
                      {order.zone_name}
                    </div>
                    <div className="text-lg lg:text-xl text-gray-500 flex-shrink-0">
                      {getElapsedTime(order.created_at)}
                    </div>
                  </div>
                </div>

                {/* Contenido compacto */}
                <div className="p-4 flex-1 flex flex-col">
                  {/* Cliente */}
                  <div className="mb-3">
                    <div className="text-xl lg:text-2xl font-bold text-gray-900 truncate">
                      {order.customer_name || 'Cliente'}
                      {order.party_size && ` (${order.party_size})`}
                    </div>
                  </div>

                  {/* Items listados simple */}
                  <div className="space-y-2 flex-1 mb-3 overflow-auto">
                    {order.items && order.items
                      .filter(item => item.status === 'CREATED')
                      .sort((a, b) => {
                        const nameA = (a.recipe_name || a.recipe?.name || '').toLowerCase();
                        const nameB = (b.recipe_name || b.recipe?.name || '').toLowerCase();
                        return nameA.localeCompare(nameB);
                      })
                      .map((item, index) => (
                      <div key={item.id || index}>
                        <div className="text-lg lg:text-xl font-medium text-gray-900">
                          <span className="break-words">
                            {item.quantity}x {item.recipe_name || item.recipe?.name}
                            {item.is_takeaway && " (delivery)"}
                          </span>
                        </div>
                        {item.notes && (
                          <div className="ml-4 text-base lg:text-lg text-gray-600 italic break-words">
                            • {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Footer compacto */}
                  <div className="pt-3 border-t border-gray-100 mt-auto">
                    <div className="flex justify-between items-center text-base lg:text-lg">
                      <span className="text-gray-700 font-medium truncate flex-1 mr-2">
                        {order.waiter_name || 'Sin mesero'}
                      </span>
                      <span className="text-gray-700 font-medium truncate">
                        M{order.table_number}
                      </span>
                    </div>
                    {order.delivery_address && (
                      <div className="mt-2 text-center">
                        <span className="text-base lg:text-lg text-gray-700 font-bold uppercase">
                          Pedido Delivery
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default Kitchen;