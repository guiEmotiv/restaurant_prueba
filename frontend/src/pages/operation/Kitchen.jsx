import { useState, useEffect, useCallback, useMemo } from 'react';
import api, { apiService, API_BASE_URL } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Clock, Users, Utensils, Settings } from 'lucide-react';
import { printBluetoothKitchenLabels } from '../../services/bluetoothKitchenPrinter';
import bluetoothKitchenPrinter from '../../services/bluetoothKitchenPrinter';


const Kitchen = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // Estados optimizados
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Estados menos volátiles agrupados
  const [kitchenState, setKitchenState] = useState({
    showBackButton: false,
    previousOrderIds: new Set(),
    lastFetchTime: null
  });
  
  // Actualizar tiempo cada segundo para mostrar segundos en tiempo real
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // 1 segundo para precisión de segundos
    return () => clearInterval(timeInterval);
  }, []);

  // Función memoizada para calcular tiempo transcurrido (con segundos)
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
        
        // [Kitchen] Sonido reproducido - Nuevo pedido en cocina
        
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

  // Función para manejar click en tarjeta con flujo atómico correcto
  const handleCardClick = async (order) => {
    try {
      // Filtrar solo los items que están en estado CREATED y NO han sido impresos
      const itemsToProcess = order.items.filter(item => 
        item.status === 'CREATED' && !item.printed_at
      );
      
      if (itemsToProcess.length === 0) {
        const alreadyPrintedCount = order.items.filter(item => 
          item.status === 'CREATED' && item.printed_at
        ).length;
        
        if (alreadyPrintedCount > 0) {
          showToast(`No hay items nuevos para imprimir. ${alreadyPrintedCount} items ya fueron impresos previamente.`, 'info');
        } else {
          showToast('No hay items pendientes para preparar', 'info');
        }
        return;
      }
      
      // [Kitchen] Procesando ${itemsToProcess.length} items para impresión: ${itemsToProcess.map(item => `${item.id}:${item.recipe_name}`)}
      
      showToast(`🏷️ Imprimiendo etiquetas para ${itemsToProcess.length} items...`, 'info');
      
      // PASO 1: IMPRIMIR PRIMERO (sin cambiar nada en BD)
      let printResult;
      let successfullyPrintedItems = [];
      
      try {
        // Enviar a impresora Bluetooth
        printResult = await printBluetoothKitchenLabels(itemsToProcess, order);
        const printerLabel = 'Bluetooth';
        
        if (printResult.success) {
          // Toda la impresión fue exitosa
          successfullyPrintedItems = itemsToProcess;
          // [Kitchen] ${itemsToProcess.length} etiquetas impresas exitosamente via ${printerLabel}
          showToast(`✅ ${itemsToProcess.length} etiquetas impresas exitosamente`, 'success');
        } else if (printResult.successful > 0) {
          // Impresión parcial - determinar cuáles se imprimieron
          successfullyPrintedItems = itemsToProcess.slice(0, printResult.successful);
          // [Kitchen] Impresión parcial: ${printResult.successful}/${printResult.total} etiquetas impresas via ${printerLabel}
          showToast(`⚠️ Impresión parcial: ${printResult.successful}/${printResult.total} etiquetas impresas`, 'warning');
        } else {
          // Impresión completamente fallida
          showToast(`❌ No se pudo imprimir ninguna etiqueta`, 'error');
          return; // Salir sin cambiar nada - items siguen disponibles para retry
        }
      } catch (printError) {
        showToast(`❌ Error al imprimir etiquetas: ${printError.message}`, 'error');
        return; // Salir sin cambiar nada - items siguen disponibles para retry
      }
      
      // PASO 2: MARCAR COMO IMPRESO (solo items que se imprimieron exitosamente)
      // [Kitchen] Marcando ${successfullyPrintedItems.length} items como impresos
      const markPrintedPromises = successfullyPrintedItems.map(async (item) => {
        try {
          const response = await api.post(`/order-items/${item.id}/mark_printed/`);
          // [Kitchen] Item ${item.id} marcado como impreso: ${response.data.printed_at}
          return { success: true, itemId: item.id, data: response.data };
        } catch (error) {
          return { success: false, itemId: item.id, error: error.message };
        }
      });
      
      const markResults = await Promise.all(markPrintedPromises);
      const successfullyMarked = markResults.filter(r => r.success);
      const failedToMark = markResults.filter(r => !r.success);
      
      if (failedToMark.length > 0) {
        showToast(`⚠️ ${failedToMark.length} items impresos pero no marcados en BD`, 'warning');
      }
      
      // PASO 3: CAMBIAR STATUS A PREPARING (solo items marcados exitosamente)
      const itemsToChangeStatus = successfullyPrintedItems.filter(item => 
        successfullyMarked.some(marked => marked.itemId === item.id)
      );
      
      if (itemsToChangeStatus.length === 0) {
        showToast('❌ No se pudo procesar completamente ningún item', 'error');
        return;
      }
      
      // [Kitchen] Cambiando status de ${itemsToChangeStatus.length} items a PREPARING
      const updateStatusPromises = itemsToChangeStatus.map(async (item) => {
        try {
          const response = await api.post(`/order-items/${item.id}/update_status/`, {
            status: 'PREPARING'
          });
          // [Kitchen] Item ${item.id} cambiado a PREPARING exitosamente
          return { success: true, itemId: item.id, data: response.data };
        } catch (error) {
          return { success: false, itemId: item.id, error: error.message };
        }
      });
      
      const statusResults = await Promise.all(updateStatusPromises);
      const successfulStatusUpdates = statusResults.filter(r => r.success);
      const failedStatusUpdates = statusResults.filter(r => !r.success);
      
      // PASO 4: ACTUALIZAR ORDER STATUS Y DAR FEEDBACK FINAL
      if (successfulStatusUpdates.length > 0) {
        // [Kitchen] ${successfulStatusUpdates.length} items procesados completamente
        
        // Cambiar estado del order a PREPARING si está en CREATED
        if (order.status === 'CREATED') {
          try {
            await api.post(`/orders/${order.id}/update_status/`, {
              status: 'PREPARING'
            });
            // [Kitchen] Order ${order.id} cambiado a PREPARING
          } catch (error) {
          }
        }
        
        // Mensaje final de éxito
        showToast(
          `🍳 ${successfulStatusUpdates.length} items procesados completamente (impresos → marcados → preparación)`, 
          'success'
        );
      }
      
      if (failedStatusUpdates.length > 0) {
        showToast(`⚠️ ${failedStatusUpdates.length} items impresos pero no iniciaron preparación`, 'warning');
      }
      
      // Items que fallaron en cualquier paso siguen visibles para retry
      const totalProcessed = successfulStatusUpdates.length;
      const totalFailed = itemsToProcess.length - totalProcessed;
      
      if (totalFailed > 0) {
        // [Kitchen] ${totalFailed} items siguen disponibles para reintento
      }
      
      // Recargar datos para mostrar cambios
      await loadOrders(true);
      
    } catch (error) {
      showToast('❌ Error al procesar el pedido', 'error');
    }
  };

  // Función de test de impresora con diagnóstico
  const testPrinter = async () => {
    try {
      showToast('🧪 Test ultra básico...', 'info');
      
      // 1. Verificar conexión
      if (!bluetoothKitchenPrinter.device || !bluetoothKitchenPrinter.device.gatt.connected) {
        showToast('⚠️ Impresora no conectada. Usa "Conectar" primero', 'warning');
        return;
      }
      
      // 2. Test ULTRA básico - solo texto y saltos de línea
      const testData = new Uint8Array([
        // Solo texto ASCII y saltos de línea - SIN comandos ESC/POS
        84, 69, 83, 84, 10,           // "TEST\n"
        72, 79, 76, 65, 10,           // "HOLA\n"
        49, 50, 51, 10,               // "123\n"
        45, 45, 45, 45, 10,           // "----\n"
        10, 10, 10, 10, 10, 10        // Muchos saltos de línea
      ]);
      
      await bluetoothKitchenPrinter.sendCommand(testData);
      showToast('✅ Test enviado - debe salir papel con texto', 'success');
      
    } catch (error) {
      showToast(`❌ Error: ${error.message}`, 'error');
    }
  };

  // Test adicional - solo avance de papel
  const testPaperFeed = async () => {
    try {
      if (!bluetoothKitchenPrinter.device || !bluetoothKitchenPrinter.device.gatt.connected) {
        showToast('⚠️ Conecta la impresora primero', 'warning');
        return;
      }

      // Solo comandos de avance de papel
      const feedData = new Uint8Array([
        10, 10, 10, 10, 10, 10, 10, 10, 10, 10  // 10 saltos de línea
      ]);
      
      await bluetoothKitchenPrinter.sendCommand(feedData);
      showToast('📄 Comando de avance enviado', 'success');
      
    } catch (error) {
      showToast(`❌ Error: ${error.message}`, 'error');
    }
  };

  // Test con diagnóstico completo
  const testDensity = async () => {
    try {
      if (!bluetoothKitchenPrinter.device || !bluetoothKitchenPrinter.device.gatt.connected) {
        showToast('⚠️ Conecta la impresora primero', 'warning');
        return;
      }

      showToast('🔍 Verificando estado del dispositivo...', 'info');
      
      // Información detallada del dispositivo
      const device = bluetoothKitchenPrinter.device;
      console.log('📱 Dispositivo:', {
        name: device.name,
        id: device.id,
        connected: device.gatt.connected
      });
      
      // Test con comando de auto-test de la impresora
      const autoTest = new Uint8Array([
        0x1B, 0x40,           // Reset
        0x12, 0x54,           // Comando de auto-test (algunos modelos)
        0x1D, 0x28, 0x41, 0x02, 0x00, 0x00, 0x02,  // Test pattern command
        10, 10, 10
      ]);
      
      await bluetoothKitchenPrinter.sendCommand(autoTest);
      showToast('🔥 Comando auto-test enviado', 'success');
      
      // Esperar y enviar patrón de prueba básico
      setTimeout(async () => {
        const pattern = new Uint8Array([
          // Patrón de 'X' que debería ser muy visible
          88, 88, 88, 88, 88, 88, 88, 88, 10,  // "XXXXXXXX\n"
          88, 32, 88, 32, 88, 32, 88, 32, 10,  // "X X X X \n"
          88, 88, 88, 88, 88, 88, 88, 88, 10,  // "XXXXXXXX\n"
          10, 10, 10, 10, 10
        ]);
        
        await bluetoothKitchenPrinter.sendCommand(pattern);
        showToast('📊 Patrón de prueba enviado', 'success');
      }, 2000);
      
    } catch (error) {
      showToast(`❌ Error: ${error.message}`, 'error');
      console.error('Error detallado:', error);
    }
  };

  // Test térmico específico
  const testThermalMax = async () => {
    try {
      if (!bluetoothKitchenPrinter.device || !bluetoothKitchenPrinter.device.gatt.connected) {
        showToast('⚠️ Conecta la impresora primero', 'warning');
        return;
      }

      showToast('🔥 Configurando máximo calor térmico...', 'info');
      
      await bluetoothKitchenPrinter.testThermalConfig();
      showToast('✅ Test térmico máximo enviado', 'success');
      
    } catch (error) {
      showToast(`❌ Error: ${error.message}`, 'error');
      console.error('Error térmico:', error);
    }
  };

  // Función para conectar manualmente la impresora
  const connectPrinter = async () => {
    try {
      showToast('🔌 Buscando impresoras Bluetooth...', 'info');
      
      // Verificar si Bluetooth está disponible
      if (!navigator.bluetooth) {
        showToast('❌ Bluetooth no disponible en este navegador', 'error');
        return;
      }
      
      await bluetoothKitchenPrinter.connect();
      
      // Verificar conexión exitosa
      if (bluetoothKitchenPrinter.device && bluetoothKitchenPrinter.device.gatt.connected) {
        const deviceName = bluetoothKitchenPrinter.device.name || 'Impresora sin nombre';
        showToast(`✅ Conectado a: ${deviceName}`, 'success');
      } else {
        showToast('⚠️ Conexión incierta. Prueba el test', 'warning');
      }
      
    } catch (error) {
      if (error.message.includes('User cancelled')) {
        showToast('⚠️ Conexión cancelada por el usuario', 'warning');
      } else {
        showToast(`❌ Error: ${error.message}`, 'error');
      }
    }
  };

  // Cargar órdenes activas
  const loadOrders = useCallback(async (silent = false) => {
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
        !kitchenState.previousOrderIds.has(order.id)
      );
      
      // Solo reproducir sonido si hay nuevos pedidos Y no es la primera carga
      if (newCreatedOrders.length > 0 && kitchenState.previousOrderIds.size > 0) {
        // [Kitchen] ${newCreatedOrders.length} nuevo(s) pedido(s) CREATED detectado(s): ${newCreatedOrders.map(o => `#${o.id}`)}
        playNotificationSound();
      } else if (kitchenState.previousOrderIds.size === 0) {
        // [Kitchen] Primera carga: ${activeOrders.length} pedidos encontrados, no se reproduce sonido
      }
      
      // Actualizar estado de cocina de manera optimizada
      setKitchenState(prev => ({
        ...prev,
        previousOrderIds: currentOrderIds,
        lastFetchTime: new Date().getTime()
      }));
      
      setOrders(activeOrders);
    } catch (error) {
      // Si es modo silencioso (desde handleCardClick), no mostrar errores de red
      if (!silent && error.message !== 'NETWORK_ERROR_SILENT') {
        showToast(`Error al cargar órdenes: ${error.message}`, 'error');
      } else if (silent) {
        console.warn('🔄 Sincronización silenciosa falló:', error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [showToast, kitchenState.previousOrderIds]);

  // Habilitar audio con interacción del usuario
  useEffect(() => {
    const enableAudio = () => {
      // Crear y reanudar contexto de audio para habilitar sonidos
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        // [Kitchen] Audio habilitado para notificaciones
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


  // No inicializar automáticamente - solo mantener conexión durante la sesión

  // Sistema de polling inteligente memoizado
  const pollingConfig = useMemo(() => {
    const hasOrders = orders.length > 0;
    const timeSinceLastFetch = kitchenState.lastFetchTime ? 
      Date.now() - kitchenState.lastFetchTime : 0;
    
    // Si no hay órdenes y la última consulta fue hace más de 2 minutos, consultar menos
    if (!hasOrders && timeSinceLastFetch > 120000) {
      return { interval: 60000, label: 'bajo tráfico' };
    }
    
    // Si hay órdenes, mantener frecuencia alta
    return { 
      interval: hasOrders ? 30000 : 45000, 
      label: hasOrders ? 'activo' : 'normal'
    };
  }, [orders.length, kitchenState.lastFetchTime]);

  // Cargar órdenes al montar con polling inteligente
  useEffect(() => {
    loadOrders();
    
    // [Kitchen] Configurando polling en modo: ${pollingConfig.label} (${pollingConfig.interval/1000}s)
    const interval = setInterval(() => {
      loadOrders();
    }, pollingConfig.interval);
    
    return () => {
      clearInterval(interval);
    };
  }, [loadOrders, pollingConfig]);

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
              <button
                onClick={connectPrinter}
                className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md font-medium transition-colors"
                title="Conectar"
              >
                🔌
              </button>
              <button
                onClick={testPaperFeed}
                className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded-md font-medium transition-colors"
                title="Test papel"
              >
                📄
              </button>
              <button
                onClick={testPrinter}
                className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-md font-medium transition-colors"
                title="Test básico"
              >
                🧪
              </button>
              <button
                onClick={testDensity}
                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-md font-medium transition-colors"
                title="Test avanzado"
              >
                🔥
              </button>
              <button
                onClick={testThermalMax}
                className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-md font-medium transition-colors"
                title="Test térmico máximo"
              >
                🌡️
              </button>
              <button
                onClick={() => window.open('/printer-diagnostic', '_blank')}
                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-md font-medium transition-colors"
                title="Diagnóstico completo"
              >
                🔧 Diagnóstico
              </button>
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