import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Clock, AlertTriangle, ChefHat, Filter, User, MapPin, Package, CheckCircle, Coffee, Utensils, Bell, BellOff } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import orderItemPoller from '../../services/orderItemPoller';
import notificationService from '../../services/notifications';

// 🚀 OPTIMIZACIÓN: Cache global de fechas para máximo rendimiento
const dateCache = new Map();
const timeFormatterPeru = new Intl.DateTimeFormat('es-PE', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

// Función ultra-optimizada para parsear fechas
const getCachedTime = (dateString, type = 'timestamp') => {
  const cacheKey = `${dateString}_${type}`;
  if (!dateCache.has(cacheKey)) {
    const date = new Date(dateString);
    if (type === 'timestamp') {
      dateCache.set(cacheKey, date.getTime());
    } else if (type === 'formatted') {
      dateCache.set(cacheKey, timeFormatterPeru.format(date));
    }
  }
  return dateCache.get(cacheKey);
};

// Limpiar cache periódicamente para evitar memory leaks
setInterval(() => {
  if (dateCache.size > 1000) {
    dateCache.clear();
  }
}, 300000); // 5 minutos

// 🚀 OPTIMIZACIÓN: OrderItemCard ultra-eficiente con memoización profunda
const OrderItemCard = memo(({ item, timeStatus, handleCardClick, isProcessing = false }) => {
  // Cache del tiempo formateado para evitar recálculos
  const formattedTime = item.formattedTime || getCachedTime(item.created_at, 'formatted');
  
  // Click handler optimizado - crear función inline estable
  const onCardClick = (e) => handleCardClick(e, item);
  
  return (
    <div
      onClick={onCardClick}
      className={`rounded-lg p-2 shadow-sm border transition-all duration-200 ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md transform hover:scale-105 active:scale-95'} ${timeStatus.borderColor} ${timeStatus.bgColor} relative`}
    >
      {/* Barra de progreso de tiempo */}
      <div className="mb-1">
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div 
            className={`h-1.5 rounded-full transition-all duration-300 ${timeStatus.color}`}
            style={{ width: `${Math.min(timeStatus.progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Información principal */}
      <div className="space-y-1">
        {/* Header con número de pedido y tiempo */}
        <div className="flex justify-between items-start">
          <span className="text-lg font-bold text-gray-900">#{item.order_id}</span>
          <div className="text-sm font-medium text-gray-900">
            {formattedTime}hr | {timeStatus.displayTime}
          </div>
        </div>

        {/* Receta */}
        <div className={`font-medium text-gray-900 text-center py-1 rounded ${timeStatus.bgColor}`}>
          {item.recipe_name}
        </div>

        {/* Ubicación */}
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <MapPin className="h-4 w-4" />
          <span>{item.order_zone} - {item.order_table}</span>
        </div>

        {/* Mesero */}
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <User className="h-4 w-4" />
          <span>{item.waiter_name}</span>
        </div>

        {/* Delivery */}
        {item.is_takeaway && (
          <div className="flex items-center gap-1 text-sm text-gray-900">
            <Package className="h-4 w-4" />
            <span>Delivery</span>
          </div>
        )}

        {/* Personalizaciones */}
        {item.customizations_count > 0 && (
          <div className="text-sm text-blue-600">
            +{item.customizations_count} personalización{item.customizations_count > 1 ? 'es' : ''}
          </div>
        )}

        {/* Notas */}
        {item.notes && item.notes.trim() && (
          <div className={`mt-1 p-1 rounded text-sm text-gray-900 ${timeStatus.bgColor} border ${timeStatus.borderColor}`}>
            <strong>Notas:</strong> {item.notes}
          </div>
        )}
      </div>

      {/* Badge de urgencia */}
      {timeStatus.status === 'overdue' && (
        <div className="absolute -top-1 -right-1">
          <div className="bg-red-500 text-white rounded-full p-1 animate-pulse">
            <AlertTriangle className="h-3 w-3" />
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // 🎯 COMPARACIÓN OPTIMIZADA: Permitir actualización de tiempo cada segundo
  return prevProps.item.id === nextProps.item.id &&
         prevProps.item.status === nextProps.item.status &&
         prevProps.item.preparing_at === nextProps.item.preparing_at &&
         prevProps.timeStatus.status === nextProps.timeStatus.status &&
         prevProps.timeStatus.progress === nextProps.timeStatus.progress &&
         prevProps.timeStatus.displayTime === nextProps.timeStatus.displayTime &&
         prevProps.timeStatus.itemStatus === nextProps.timeStatus.itemStatus &&
         prevProps.isProcessing === nextProps.isProcessing;
});

// Constantes fuera del componente para evitar recreaciones
const CREATED_COLORS = {
  color: 'bg-green-500',
  textColor: 'text-green-700',
  bgColor: 'bg-green-100',
  borderColor: 'border-green-300'
};

const PREPARING_COLORS = {
  color: 'bg-yellow-400',
  textColor: 'text-yellow-700',
  bgColor: 'bg-yellow-100',
  borderColor: 'border-yellow-300'
};

const TIME_LOCALE_OPTIONS = { 
  hour: '2-digit', 
  minute: '2-digit',
  hour12: false 
};

const Kitchen = () => {
  const [kitchenBoard, setKitchenBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupTab, setSelectedGroupTab] = useState('all');
  const [selectedTableFilter, setSelectedTableFilter] = useState('all'); // all, or specific table
  const [audioReady, setAudioReady] = useState(false); // Se activará automáticamente
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    item: null,
    newStatus: null
  });
  // 🔧 SOLUCIÓN: Estado para forzar re-renders estable
  const [timeUpdateTrigger, setTimeUpdateTrigger] = useState(0);
  const [processingItems, setProcessingItems] = useState(new Set()); // Track items being processed
  const { showSuccess, showError } = useToast();
  const { userRole } = useAuth();

  // 🚀 OPTIMIZACIÓN: loadKitchenBoard con useCallback - SIMPLIFICADO
  const loadKitchenBoard = useCallback(async () => {
    try {
      const data = await apiService.orders.getKitchenBoard();
      setKitchenBoard(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      // Manejo específico para ERR_NETWORK_CHANGED
      if (error.message?.includes('Network connection changed')) {
        console.warn('Kitchen: Network changed, keeping current data');
        setLoading(false);
        return;
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKitchenBoard();
    
    // Configurar notificaciones de audio y polling automático
    notificationService.setCurrentUserRole(userRole);
    orderItemPoller.setKitchenView(true);
    orderItemPoller.setUpdateCallback(loadKitchenBoard); // Actualizar vista automáticamente
    orderItemPoller.startPolling();
    
    // Verificar si el audio ya estaba activado
    setAudioReady(notificationService.isAudioReady());
    
    // Verificar estado del audio periódicamente
    const audioCheckInterval = setInterval(() => {
      setAudioReady(notificationService.isAudioReady());
    }, 1000);
    
    // 🚀 OPTIMIZACIÓN: Actualizar tiempos automáticamente cada segundo
    const timeUpdateInterval = setInterval(() => {
      // Siempre actualizar para que el tiempo transcurrido se actualice automáticamente
      setTimeUpdateTrigger(prev => (prev + 1) % 1000000); // Evitar números muy grandes
    }, 1000);
    
    return () => {
      // Detener polling al salir de la vista
      orderItemPoller.stopPolling();
      orderItemPoller.setUpdateCallback(null);
      clearInterval(audioCheckInterval);
      clearInterval(timeUpdateInterval);
    };
  }, [userRole, loadKitchenBoard]);

  // 🎯 FUNCIÓN PARA ACTIVAR AUDIO SI FALTA (solo cuando el usuario interactúa)
  const ensureAudioReady = useCallback(async () => {
    if (!audioReady) {
      const success = await notificationService.initAudioWithUserGesture();
      setAudioReady(success);
      if (success) {
      }
    }
  }, [audioReady]);

  // Función para activar audio manualmente
  const activateAudio = useCallback(async () => {
    try {
      const success = await notificationService.initAudioWithUserGesture();
      setAudioReady(success);
      if (success) {
        showSuccess('Audio activado correctamente', 500);
      } else {
        showError('No se pudo activar el audio', 500);
      }
    } catch (error) {
      showError('Error al activar el audio', 500);
    }
  }, [showSuccess, showError]);

  // Función para desactivar audio manualmente
  const deactivateAudio = useCallback(() => {
    try {
      notificationService.disableAudio();
      setAudioReady(false);
      showSuccess('Audio desactivado', 500);
    } catch (error) {
      showError('Error al desactivar el audio', 500);
    }
  }, [showSuccess, showError]);

  // Función toggle para audio
  const toggleAudio = useCallback(async () => {
    if (audioReady) {
      deactivateAudio();
    } else {
      await activateAudio();
    }
  }, [audioReady, activateAudio, deactivateAudio]);


  // Sistema simplificado - sin notificaciones a meseros

  // Función para obtener el siguiente estado según el flujo
  const getNextStatus = useCallback((currentStatus) => {
    const statusFlow = {
      'CREATED': 'PREPARING',
      'PREPARING': 'SERVED'
    };
    return statusFlow[currentStatus];
  }, []);

  // Función para abrir modal de confirmación
  const openConfirmModal = useCallback((item, newStatus) => {
    setConfirmModal({
      isOpen: true,
      item: item,
      newStatus: newStatus
    });
  }, []);

  // Función para cerrar modal
  const closeConfirmModal = useCallback(() => {
    setConfirmModal({
      isOpen: false,
      item: null,
      newStatus: null
    });
  }, []);

  // ⚡ OPTIMIZADO: Memoizar tablas con items (movido antes de confirmStatusChange para resolver dependencias)
  const tablesWithItems = useMemo(() => {
    const allItems = kitchenBoard.flatMap(recipe => 
      recipe.items.map(item => ({
        zone: item.order_zone,
        table: item.order_table,
        key: `${item.order_zone}-${item.order_table}`
      }))
    );

    // Agrupar por mesa y contar items
    const tableGroups = {};
    allItems.forEach(item => {
      if (!tableGroups[item.key]) {
        tableGroups[item.key] = {
          zone: item.zone,
          table: item.table,
          key: item.key,
          count: 0
        };
      }
      tableGroups[item.key].count++;
    });

    return Object.values(tableGroups).sort((a, b) => {
      // Ordenar por zona y luego por número de mesa
      if (a.zone !== b.zone) return a.zone.localeCompare(b.zone);
      return parseInt(a.table) - parseInt(b.table);
    });
  }, [kitchenBoard]);

  // 🚀 OPTIMIZACIÓN: confirmStatusChange con useCallback - MANEJO IDEMPOTENTE
  const confirmStatusChange = useCallback(async () => {
    const { item, newStatus } = confirmModal;
    
    const successMessages = {
      'PREPARING': 'Item en preparación',
      'SERVED': 'Item marcado como servido'
    };

    // Marcar item como en proceso
    setProcessingItems(prev => new Set([...prev, item.id]));

    try {
      // Actualización optimista: cerrar modal inmediatamente para UX fluida
      closeConfirmModal();
      
      console.log('Updating order item status:', {
        itemId: item.id,
        currentStatus: item.status,
        newStatus: newStatus,
        payload: { status: newStatus }
      });
      
      await apiService.orderItems.updateStatus(item.id, newStatus);
      
      // Siempre consideramos exitoso (incluyendo operaciones idempotentes)
      showSuccess(successMessages[newStatus] || 'Estado actualizado', 500);
      
      // Recargar el tablero después de un breve delay para evitar conflictos
      setTimeout(() => {
        loadKitchenBoard();
      }, 300);
      
    } catch (error) {
      // Solo mostrar error si es un problema real (no idempotente)
      if (error.response?.status !== 200) {
        console.error('Error updating order item status:', {
          itemId: item.id,
          currentStatus: item.status,
          newStatus: newStatus,
          errorResponse: error.response?.data,
          errorStatus: error.response?.status
        });
        
        // Simplificar mensaje de error para usuario
        if (error.response?.data?.error?.includes('SERVED a SERVED')) {
          // Es una operación idempotente - no mostrar error
          showSuccess('Item ya está servido', 500);
          loadKitchenBoard();
        } else {
          showError('Error al actualizar. Por favor intente de nuevo.', 500);
        }
      }
    } finally {
      // Siempre quitar el item del procesamiento
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  }, [confirmModal, loadKitchenBoard, showSuccess, closeConfirmModal, showError]);

  // 🚀 OPTIMIZACIÓN ULTRA: handleCardClick optimizado sin async innecesario
  const handleCardClick = useCallback((e, item) => {
    // Prevenir propagación inmediatamente
    e?.stopPropagation();
    
    // Si el item está siendo procesado, ignorar click
    if (processingItems.has(item.id)) {
      return;
    }
    
    // 🔊 Audio en background - no bloquear UI
    ensureAudioReady();
    
    // Cálculo directo del siguiente estado sin función
    const nextStatus = item.status === 'CREATED' ? 'PREPARING' : 
                      item.status === 'PREPARING' ? 'SERVED' : null;
    
    if (nextStatus) {
      openConfirmModal(item, nextStatus);
    }
  }, [ensureAudioReady, openConfirmModal, processingItems]);

  // Función removida - no se usa en el código


  // Calcular tiempo secuencial por estación - Optimizado
  const calculateStationQueue = useCallback((items) => {
    const stations = new Map();
    
    // Agrupar items por estación
    for (const item of items) {
      const stationKey = item.recipe_group_id || 'sin-grupo';
      if (!stations.has(stationKey)) {
        stations.set(stationKey, []);
      }
      stations.get(stationKey).push(item);
    }

    const result = [];
    
    // Para cada estación, calcular tiempo acumulado
    for (const [stationKey, stationItems] of stations) {
      // Ordenar por tiempo de creación
      // 🚀 OPTIMIZACIÓN: Ordenamiento con cache de timestamps
      stationItems.sort((a, b) => {
        const timeA = a.createdAtTime || getCachedTime(a.created_at, 'timestamp');
        const timeB = b.createdAtTime || getCachedTime(b.created_at, 'timestamp');
        return timeA - timeB;
      });
      
      let accumulatedTime = 0;
      for (let i = 0; i < stationItems.length; i++) {
        const item = stationItems[i];
        const queueStartTime = accumulatedTime;
        const queueEndTime = accumulatedTime + item.preparation_time;
        accumulatedTime = queueEndTime;

        result.push({
          ...item,
          queueStartTime,
          queueEndTime,
          queuePosition: i + 1
        });
      }
    }

    return result;
  }, []);

  // 🚀 OPTIMIZACIÓN ULTRA: getTimeStatus con precisión de segundos
  const getTimeStatus = useCallback((item) => {
    const now = Date.now();
    // Usar cache para timestamps
    const createdAt = getCachedTime(item.created_at, 'timestamp');
    const elapsedMs = Math.max(0, now - createdAt); // milisegundos totales
    const elapsedSinceCreation = elapsedMs / 60000; // minutos para cálculos
    
    let progressTime = 0;
    let isOverdue = false;
    const isCreated = item.status === 'CREATED';
    const statusText = isCreated ? 'Pendiente' : 'Preparando';
    
    if (!isCreated && item.preparing_at) {
      const preparingAt = getCachedTime(item.preparing_at, 'timestamp');
      progressTime = (now - preparingAt) / 60000;
      isOverdue = progressTime > item.preparation_time;
    }
    
    // Calcular porcentaje con Math.min inline
    const percentage = progressTime === 0 ? 0 : Math.min((progressTime / item.preparation_time) * 100, 100);
    
    // Usar referencia directa a colores
    const colors = isCreated ? CREATED_COLORS : PREPARING_COLORS;
    
    // 🎯 FORMATO CON PRECISIÓN DE SEGUNDOS
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    let displayTimeFormatted;
    if (minutes === 0) {
      // Solo segundos si es menor a 1 minuto
      displayTimeFormatted = `${seconds}s`;
    } else if (minutes < 10) {
      // Minutos y segundos si es menor a 10 minutos
      displayTimeFormatted = `${minutes}m ${seconds}s`;
    } else {
      // Solo minutos si es 10+ minutos para no sobrecargar
      displayTimeFormatted = `${minutes}m`;
    }
    
    return {
      ...colors,
      status: (isOverdue && !isCreated) ? 'overdue' : 'normal',
      progress: percentage,
      displayTime: displayTimeFormatted,
      statusText,
      itemStatus: item.status
    };
  }, []);

  // Función para obtener el icono del estado
  // 🚀 OPTIMIZACIÓN: getStatusIcon con useCallback
  const getStatusIcon = useCallback((itemStatus) => {
    if (itemStatus === 'CREATED') {
      return (
        <Clock className="h-4 w-4" title="Pendiente" />
      );
    } else if (itemStatus === 'PREPARING') {
      return (
        <ChefHat className="h-4 w-4" title="En Preparación" />
      );
    }
    return null;
  }, []);

  // ⚡ OPTIMIZADO: Memoizar columnas kanban - solo recalcular cuando cambien dependencias
  const kanbanColumns = useMemo(() => {
    // Optimizado: solo crear objetos nuevos si es necesario
    const allItems = [];
    for (const recipe of kitchenBoard) {
      for (const item of recipe.items) {
        // 🚀 OPTIMIZACIÓN: Reutilizar objetos y cache de tiempo formateado
        const needsEnrichment = item.recipe_name !== recipe.recipe_name || 
                               item.recipe_group_name !== (recipe.recipe_group_name || 'Sin Grupo') ||
                               item.recipe_group_id !== (recipe.recipe_group_id || null) ||
                               !item.formattedTime;

        if (!needsEnrichment) {
          allItems.push(item);
        } else {
          allItems.push({
            ...item,
            recipe_name: recipe.recipe_name,
            recipe_group_name: recipe.recipe_group_name || 'Sin Grupo',
            recipe_group_id: recipe.recipe_group_id || null,
            formattedTime: getCachedTime(item.created_at, 'formatted')
          });
        }
      }
    }

    // Calcular cola secuencial para todos los items
    const itemsWithQueue = calculateStationQueue(allItems);

    // Filtrar por mesa si está seleccionada
    const tableFilteredItems = itemsWithQueue.filter(item => {
      if (selectedTableFilter === 'all') return true;
      return `${item.order_zone}-${item.order_table}` === selectedTableFilter;
    });

    // Crear grupos dinámicamente basado en los items que realmente existen
    const dynamicGroups = {};
    
    // Agrupar items por grupo y crear columnas dinámicamente
    tableFilteredItems.forEach(item => {
      const groupKey = item.recipe_group_id || 'sin-grupo';
      const groupName = item.recipe_group_name || 'Sin Grupo';
      
      if (!dynamicGroups[groupKey]) {
        dynamicGroups[groupKey] = {
          id: groupKey,
          name: groupName,
          items: []
        };
      }
      
      dynamicGroups[groupKey].items.push(item);
    });

    // 🚀 OPTIMIZACIÓN: Ordenar items con cache de timestamps
    Object.values(dynamicGroups).forEach(group => {
      group.items.sort((a, b) => {
        const timeA = a.createdAtTime || getCachedTime(a.created_at, 'timestamp');
        const timeB = b.createdAtTime || getCachedTime(b.created_at, 'timestamp');
        return timeA - timeB;
      });
    });

    // Filtrar por pestaña seleccionada
    if (selectedGroupTab === 'all') {
      // Mostrar todos los grupos dinámicos
      return dynamicGroups;
    } else {
      // Solo mostrar el grupo seleccionado si existe
      const columns = {};
      if (dynamicGroups[selectedGroupTab]) {
        columns[selectedGroupTab] = dynamicGroups[selectedGroupTab];
      }
      return columns;
    }
  }, [kitchenBoard, selectedTableFilter, selectedGroupTab, calculateStationQueue, timeUpdateTrigger]);

  
  // ⚡ OPTIMIZADO: Memoizar total de items
  const totalItems = useMemo(() => {
    return Object.values(kanbanColumns).reduce((sum, col) => sum + col.items.length, 0);
  }, [kanbanColumns]);
  
  // Detectar cuando la mesa filtrada ya no tiene items y cambiar a "Todas"
  useEffect(() => {
    if (selectedTableFilter !== 'all') {
      // tablesWithItems ya está memoizado arriba
      const hasCurrentTable = tablesWithItems.some(table => table.key === selectedTableFilter);
      
      
      if (!hasCurrentTable && kitchenBoard.length > 0) {
        setSelectedTableFilter('all');
      }
    }
  }, [kitchenBoard, selectedTableFilter, tablesWithItems]);

  // tablesWithItems ya está memoizado arriba
  
  // ⚡ OPTIMIZADO: Reutilizar datos de kanbanColumns
  const dynamicGroupsForTabs = useMemo(() => {
    // Si ya tenemos kanbanColumns calculado, reutilizarlo
    if (selectedGroupTab === 'all') {
      return Object.values(kanbanColumns);
    }
    
    // Solo calcular si es necesario
    const dynamicGroups = {};
    for (const recipe of kitchenBoard) {
      const groupKey = recipe.recipe_group_id || 'sin-grupo';
      const groupName = recipe.recipe_group_name || 'Sin Grupo';
      
      if (!dynamicGroups[groupKey]) {
        dynamicGroups[groupKey] = {
          id: groupKey,
          name: groupName,
          items: []
        };
      }
      
      dynamicGroups[groupKey].items.push(...recipe.items);
    }
    
    return Object.values(dynamicGroups);
  }, [kitchenBoard, kanbanColumns, selectedGroupTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Cargando cocina...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header Fijo */}
      <div className="sticky top-0 z-10 bg-white shadow-sm px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {/* Filtros por Mesa */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedTableFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedTableFilter === 'all'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Todas ({totalItems})
            </button>
            {tablesWithItems.map(table => (
              <button
                key={table.key}
                onClick={() => setSelectedTableFilter(table.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedTableFilter === table.key
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {table.table} ({table.count})
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Botón toggle para audio */}
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-lg transition-colors ${
                audioReady
                  ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                  : 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200'
              }`}
              title={audioReady ? 'Clic para desactivar audio' : 'Clic para activar audio'}
            >
              {audioReady ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            </button>

            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Pestañas de grupos - Solo mostrar si hay items */}
        {totalItems > 0 && (
          <div className="mt-3 border-t pt-3">
            <div className="flex gap-2 overflow-x-auto">
              <button
                onClick={() => setSelectedGroupTab('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedGroupTab === 'all'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Todos ({totalItems})
              </button>
              {dynamicGroupsForTabs.map(group => {
                // Calcular items del grupo filtrados por mesa seleccionada
                const groupItemsCount = selectedTableFilter === 'all' 
                  ? group.items.length
                  : group.items.filter(item => `${item.order_zone}-${item.order_table}` === selectedTableFilter).length;
                
                return (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroupTab(group.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedGroupTab === group.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {group.name} ({groupItemsCount})
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tablero Kanban */}
      <div className="flex-1 overflow-auto p-4">
        {Object.keys(kanbanColumns).length === 0 || totalItems === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-gray-300 text-4xl mb-2">🍳</div>
              <h3 className="text-base font-medium text-gray-700 mb-1">
                No hay pedidos pendientes
              </h3>
              <p className="text-sm text-gray-500">
                Los nuevos pedidos aparecerán automáticamente aquí.
              </p>
            </div>
          </div>
        ) : (
          // Vista diferente para "Todos" vs grupos individuales
          selectedGroupTab === 'all' ? (
            // Vista Kanban columnar para "Todos"
            <div className="flex gap-4 h-full overflow-x-auto pb-4">
              {Object.values(kanbanColumns).map(column => (
                <div key={column.id} className="flex-shrink-0 w-80">
                {/* Header de columna */}
                <div className="bg-white rounded-t-lg px-4 py-3 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 flex items-center justify-between">
                    <span>{column.name}</span>
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                      {column.items.length}
                    </span>
                  </h3>
                </div>

                {/* Items de la columna */}
                <div className="bg-gray-100 rounded-b-lg p-3 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto space-y-3">
                  {column.items.map(item => (
                    <OrderItemCard
                      key={item.id}
                      item={item}
                      timeStatus={getTimeStatus(item)}
                      handleCardClick={handleCardClick}
                      isProcessing={processingItems.has(item.id)}
                    />
                  ))}

                  {column.items.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-2xl mb-2">🍽️</div>
                      <p className="text-sm">No hay items en esta categoría</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          ) : (
            // Vista Grid para grupos individuales - usa toda la pantalla
            <div className="h-full">
              {Object.values(kanbanColumns).map(column => (
                <div key={column.id} className="h-full">
                  {/* Header del grupo */}
                  <div className="bg-white rounded-lg px-4 py-3 mb-4 border border-gray-200">
                    <h3 className="font-semibold text-gray-900 flex items-center justify-between">
                      <span>{column.name}</span>
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                        {column.items.length} items
                      </span>
                    </h3>
                  </div>

                  {/* Grid de items */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                    {column.items.map(item => (
                      <OrderItemCard
                        key={item.id}
                        item={item}
                        timeStatus={getTimeStatus(item)}
                        handleCardClick={handleCardClick}
                        isProcessing={processingItems.has(item.id)}
                      />
                    ))}
                  </div>

                  {column.items.length === 0 && (
                    <div className="text-center text-gray-500 py-16">
                      <div className="text-4xl mb-2">🍽️</div>
                      <p className="text-lg">No hay items en {column.name}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal de confirmación */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-full">
                {confirmModal.newStatus === 'PREPARING' ? 
                  <ChefHat className="h-6 w-6 text-blue-600" /> :
                  <CheckCircle className="h-6 w-6 text-green-600" />
                }
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {confirmModal.newStatus === 'PREPARING' ? 
                    'Iniciar Preparación' : 
                    'Marcar como Servido'
                  }
                </h3>
                <p className="text-sm text-gray-600">Pedido #{confirmModal.item?.order_id}</p>
              </div>
            </div>

            {/* Información del item */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Coffee className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-900">{confirmModal.item?.recipe_name}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{confirmModal.item?.order_zone} - {confirmModal.item?.order_table}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{confirmModal.item?.waiter_name}</span>
                </div>
              </div>
            </div>


            {/* Mensaje de confirmación */}
            <p className="text-gray-700 mb-6">
              {confirmModal.newStatus === 'PREPARING' ? 
                '¿Estás seguro de que deseas iniciar la preparación de este item?' :
                '¿Estás seguro de que deseas marcar este item como servido?'
              }
            </p>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={closeConfirmModal}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmStatusChange}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
                  confirmModal.newStatus === 'PREPARING' ? 
                    'bg-blue-600 hover:bg-blue-700' : 
                    'bg-green-600 hover:bg-green-700'
                }`}
              >
                {confirmModal.newStatus === 'PREPARING' ? 'Iniciar' : 'Entregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Kitchen;