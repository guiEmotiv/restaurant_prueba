import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Clock, AlertTriangle, ChefHat, Filter, User, MapPin, Package, CheckCircle, Coffee, Utensils, Bell, BellOff } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import orderItemPoller from '../../services/orderItemPoller';
import notificationService from '../../services/notifications';

// Componente memoizado para tarjetas de items
const OrderItemCard = memo(({ item, timeStatus, handleCardClick }) => {
  return (
    <div
      key={item.id}
      onClick={(e) => handleCardClick(e, item)}
      className={`bg-white rounded-lg p-4 shadow-sm border cursor-pointer transition-all duration-200 hover:shadow-md transform hover:scale-105 active:scale-95 ${timeStatus.borderColor} relative`}
    >
      {/* Barra de progreso de tiempo */}
      <div className="mb-3">
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div 
            className={`h-1.5 rounded-full transition-all duration-300 ${timeStatus.color}`}
            style={{ width: `${Math.min(timeStatus.progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Información principal */}
      <div className="space-y-2">
        {/* Header con número de pedido y tiempo */}
        <div className="flex justify-between items-start">
          <span className="text-lg font-bold text-gray-900">#{item.order_id}</span>
          <div className="text-right">
            <div className={`text-sm font-medium ${timeStatus.textColor}`}>
              {timeStatus.displayTime}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(item.created_at).toLocaleTimeString('es-PE', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              })}hr
            </div>
          </div>
        </div>

        {/* Receta */}
        <div className="font-medium text-gray-900 text-center py-2 bg-gray-50 rounded">
          {item.recipe_name}
        </div>

        {/* Ubicación */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="h-4 w-4" />
          <span>{item.order_zone} - {item.order_table}</span>
        </div>

        {/* Mesero */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="h-4 w-4" />
          <span>{item.waiter_name}</span>
        </div>

        {/* Para llevar */}
        {item.is_takeaway && (
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <Package className="h-4 w-4" />
            <span>Para llevar</span>
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
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
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
});

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
  const { showSuccess, showError } = useToast();
  const { userRole } = useAuth();

  // 🚀 OPTIMIZACIÓN: loadKitchenBoard con useCallback
  const loadKitchenBoard = useCallback(async () => {
    try {
      const data = await apiService.orders.getKitchenBoard();
      setKitchenBoard(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKitchenBoard();
    
    // Configurar notificaciones de audio y polling - usar solo uno
    notificationService.setCurrentUserRole(userRole);
    orderItemPoller.setKitchenView(true);
    orderItemPoller.startPolling();
    
    return () => {
      // Detener polling al salir de la vista
      orderItemPoller.stopPolling();
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

  // 🚀 OPTIMIZACIÓN: confirmStatusChange con useCallback
  const confirmStatusChange = useCallback(async () => {
    const { item, newStatus } = confirmModal;
    
    const successMessages = {
      'PREPARING': 'Item en preparación',
      'SERVED': 'Item marcado como servido'
    };

    try {
      await apiService.orderItems.updateStatus(item.id, newStatus);
      await loadKitchenBoard();
      
      showSuccess(successMessages[newStatus] || 'Estado actualizado', 500);
      closeConfirmModal();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message;
      showError('Error al actualizar el estado: ' + errorMessage, 500);
    }
  }, [confirmModal, loadKitchenBoard, showSuccess, closeConfirmModal, showError]);

  // 🚀 OPTIMIZACIÓN: handleCardClick con useCallback
  const handleCardClick = useCallback(async (e, item) => {
    // 🔊 Asegurar que el audio esté listo cuando el usuario interactúa
    await ensureAudioReady();
    
    const nextStatus = getNextStatus(item.status);
    if (nextStatus) {
      openConfirmModal(item, nextStatus);
    }
  }, [ensureAudioReady, getNextStatus, openConfirmModal]);

  const formatTime = useCallback((minutes) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }, []);


  // Calcular tiempo secuencial por estación
  const calculateStationQueue = useCallback((items) => {
    // Agrupar items por estación (grupo) y ordenar por tiempo de creación
    const stations = {};
    items.forEach(item => {
      const stationKey = item.recipe_group_id || 'sin-grupo';
      if (!stations[stationKey]) stations[stationKey] = [];
      stations[stationKey].push(item);
    });

    // Para cada estación, calcular tiempo acumulado
    Object.keys(stations).forEach(stationKey => {
      // Ordenar por tiempo de creación (FIFO - First In, First Out)
      stations[stationKey].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      let accumulatedTime = 0;
      stations[stationKey] = stations[stationKey].map((item, index) => {
        const queueStartTime = accumulatedTime; // Cuando empieza este item en minutos
        const queueEndTime = accumulatedTime + item.preparation_time;
        accumulatedTime = queueEndTime;

        return {
          ...item,
          queueStartTime,
          queueEndTime,
          queuePosition: index + 1
        };
      });
    });

    // Retornar array plano con los datos de cola calculados
    return Object.values(stations).flat();
  }, []);

  // ⚡ OPTIMIZADO: Memoizar cálculos de tiempo por item
  const getTimeStatus = useMemo(() => {
    const cache = new Map();
    return (item) => {
      const cacheKey = `${item.id}-${item.status}-${item.preparing_at || ''}-${Math.floor(Date.now() / 1000)}`; // Cache por segundo
      
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
      }
      
      const result = calculateTimeStatus(item);
      cache.set(cacheKey, result);
      
      // Limpiar cache viejo
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      return result;
    };
  }, []);

  const calculateTimeStatus = useCallback((item) => {
    const now = Date.now(); // Más rápido que new Date()
    const createdAt = new Date(item.created_at).getTime();
    let elapsedSinceCreation = (now - createdAt) / (1000 * 60); // minutos desde creación
    
    
    // 🔧 CORRECCIÓN: Evitar tiempos negativos por diferencias de zona horaria o sincronización
    if (elapsedSinceCreation < 0) {
      console.warn(`⚠️ Tiempo negativo detectado para item ${item.id}:`, {
        now: new Date(now).toISOString(),
        created_at: item.created_at,
        difference_minutes: elapsedSinceCreation
      });
      elapsedSinceCreation = 0; // Resetear a 0 si es negativo
    }

    // ✅ El tiempo transcurrido SIEMPRE es desde la creación
    let displayTime = elapsedSinceCreation; // Tiempo total desde creación para mostrar
    let progressTime = 0; // Tiempo para la barra de progreso
    let isOverdue = false; // Para determinar si mostrar alerta
    let statusText;
    
    if (item.status === 'CREATED') {
      statusText = 'Pendiente';
      // En estado CREATED, la barra de progreso permanece en 0
      progressTime = 0;
    } else if (item.status === 'PREPARING') {
      statusText = 'Preparando';
      // Solo cuando está en PREPARING, calculamos el progreso
      if (item.preparing_at) {
        const preparingAt = new Date(item.preparing_at).getTime();
        const preparingTime = (now - preparingAt) / (1000 * 60);
        progressTime = preparingTime; // Tiempo desde que inició la preparación
        
        // Verificar si se excedió el tiempo de preparación
        if (preparingTime > item.preparation_time) {
          isOverdue = true;
        }
      } else {
        // Si no hay preparing_at, la barra empieza en 0
        // Esto asegura que la barra sea independiente del tiempo transcurrido
        progressTime = 0;
      }
    }
    
    // Calcular porcentaje de la barra basado en progressTime
    // Limitamos al 100% para que la barra no se desborde visualmente
    const percentage = Math.min((progressTime / item.preparation_time) * 100, 100);
    
    // 🎨 OPTIMIZADO: Usar objeto constante para colores
    const statusColors = {
      'CREATED': {
        color: 'bg-green-500',
        textColor: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
      },
      'PREPARING': {
        color: 'bg-yellow-400',
        textColor: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200'
      }
    };
    
    const colors = statusColors[item.status] || statusColors['CREATED'];
    
    // Determinar el tiempo a mostrar
    let displayTimeFormatted;
    
    // El tiempo mostrado siempre es desde la creación
    displayTimeFormatted = `${Math.ceil(displayTime)}m`;
    
    // El estado de urgencia ahora se basa en si se excedió el tiempo de preparación durante PREPARING
    let urgencyStatus;
    if (isOverdue && item.status === 'PREPARING') {
      urgencyStatus = 'overdue';
    } else {
      urgencyStatus = 'normal';
    }
    
    return {
      ...colors,
      status: urgencyStatus, // Para el icono de alerta (solo 'overdue' cuando está en PREPARING y excede tiempo)
      progress: percentage, // Porcentaje de la barra (0 en CREATED, progreso en PREPARING)
      displayTime: displayTimeFormatted, // Tiempo mostrado (siempre desde creación)
      statusText: statusText,
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
    // Obtener todos los items individuales
    const allItems = kitchenBoard.flatMap(recipe => 
      recipe.items.map(item => ({
        ...item,
        recipe_name: recipe.recipe_name,
        recipe_group_name: recipe.recipe_group_name || 'Sin Grupo',
        recipe_group_id: recipe.recipe_group_id || null
      }))
    );

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

    // Ordenar items dentro de cada grupo por created_at (orden de llegada)
    Object.values(dynamicGroups).forEach(group => {
      group.items.sort((a, b) => {
        // Ordenar por created_at ascendente (más antiguos primero)
        return new Date(a.created_at) - new Date(b.created_at);
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
  }, [kitchenBoard, selectedTableFilter, selectedGroupTab, calculateStationQueue]);

  
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
  
  // ⚡ OPTIMIZADO: Memoizar grupos dinámicos para tabs
  const dynamicGroupsForTabs = useMemo(() => {
    const allItems = kitchenBoard.flatMap(recipe => 
      recipe.items.map(item => ({
        ...item,
        recipe_group_name: recipe.recipe_group_name || 'Sin Grupo',
        recipe_group_id: recipe.recipe_group_id || null
      }))
    );
    
    const dynamicGroups = {};
    allItems.forEach(item => {
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
    
    return Object.values(dynamicGroups);
  }, [kitchenBoard]);

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