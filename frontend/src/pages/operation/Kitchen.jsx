import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, ChefHat, Filter, User, MapPin, Package, CheckCircle, Coffee, Utensils } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Kitchen = () => {
  const [kitchenBoard, setKitchenBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupTab, setSelectedGroupTab] = useState('all');
  const [selectedTableFilter, setSelectedTableFilter] = useState('all'); // all, or specific table
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadKitchenBoard();
    
    // Auto-refresh en tiempo real cada 5 segundos
    const interval = setInterval(loadKitchenBoard, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadKitchenBoard = async () => {
    try {
      const data = await apiService.orders.getKitchenBoard();
      setKitchenBoard(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading kitchen board:', error);
      setLoading(false);
    }
  };


  const updateItemStatus = async (itemId, newStatus) => {
    // Mostrar confirmación antes de cambiar estado
    const confirmed = window.confirm('¿Estás seguro de que deseas marcar este item como entregado?');
    if (!confirmed) {
      return;
    }

    try {
      await apiService.orderItems.updateStatus(itemId, newStatus);
      await loadKitchenBoard();
      showSuccess('Item marcado como entregado');
    } catch (error) {
      console.error('Error updating item status:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message;
      showError('Error al actualizar el estado: ' + errorMessage);
    }
  };

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatCreationTime = (isoDateString) => {
    try {
      const date = new Date(isoDateString);
      const time = date.toLocaleTimeString('es-PE', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      return `${time}hr`;
    } catch (error) {
      return '--:--hr';
    }
  };

  // Calcular tiempo secuencial por estación
  const calculateStationQueue = (items) => {
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
  };

  const getTimeStatus = (item) => {
    const now = new Date();
    const createdAt = new Date(item.created_at);
    const elapsedSinceCreation = (now - createdAt) / (1000 * 60); // minutos desde creación

    // Si el item aún no ha empezado en su estación (está en cola)
    if (elapsedSinceCreation < item.queueStartTime) {
      return { 
        color: 'bg-gray-400', 
        textColor: 'text-gray-600', 
        status: 'waiting',
        bgColor: 'bg-gray-50', 
        borderColor: 'border-gray-200',
        progress: 0,
        displayTime: `Cola pos. ${item.queuePosition}`
      };
    }

    // Tiempo que lleva siendo procesado en la estación
    const timeInStation = elapsedSinceCreation - item.queueStartTime;
    const percentage = (timeInStation / item.preparation_time) * 100;

    // Mostrar tiempo de proceso en la estación
    const displayMinutes = Math.max(0, Math.ceil(timeInStation));
    const displayTime = displayMinutes < 60 ? `${displayMinutes}m` : 
                       `${Math.floor(displayMinutes/60)}h ${displayMinutes%60}m`;

    if (percentage > 100) {
      const overdueMinutes = Math.ceil(timeInStation - item.preparation_time);
      return { 
        color: 'bg-red-500', 
        textColor: 'text-red-600', 
        status: 'overdue',
        bgColor: 'bg-red-50', 
        borderColor: 'border-red-200',
        progress: 100,
        displayTime: `+${overdueMinutes}m`
      };
    }
    
    if (percentage > 80) {
      return { 
        color: 'bg-orange-500', 
        textColor: 'text-orange-600', 
        status: 'warning',
        bgColor: 'bg-orange-50', 
        borderColor: 'border-orange-200',
        progress: percentage,
        displayTime
      };
    }
    
    return { 
      color: 'bg-green-500', 
      textColor: 'text-green-600', 
      status: 'normal',
      bgColor: 'bg-green-50', 
      borderColor: 'border-green-200',
      progress: percentage,
      displayTime
    };
  };

  // Organizar items por grupos para Kanban
  const getKanbanColumns = () => {
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
    const columns = {};
    
    if (selectedGroupTab === 'all') {
      // Mostrar todos los grupos dinámicos
      return dynamicGroups;
    } else {
      // Solo mostrar el grupo seleccionado si existe
      if (dynamicGroups[selectedGroupTab]) {
        columns[selectedGroupTab] = dynamicGroups[selectedGroupTab];
      }
      return columns;
    }
  };

  const kanbanColumns = getKanbanColumns();
  const totalItems = Object.values(kanbanColumns).reduce((sum, col) => sum + col.items.length, 0);

  // Obtener todas las mesas únicas con items pendientes
  const getTablesWithItems = () => {
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
  };

  const tablesWithItems = getTablesWithItems();
  
  // Obtener grupos dinámicos para las pestañas (siempre todos los grupos que tienen items)
  const getDynamicGroupsForTabs = () => {
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
  };
  
  const dynamicGroupsForTabs = getDynamicGroupsForTabs();

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
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 border-b border-gray-200">
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

          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
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
                  {column.items.map(item => {
                    const timeStatus = getTimeStatus(item);
                    
                    return (
                      <div
                        key={item.id}
                        onClick={() => updateItemStatus(item.id, 'SERVED')}
                        className={`bg-white rounded-lg p-4 shadow-sm border cursor-pointer transition-all duration-200 hover:shadow-md transform hover:scale-105 active:scale-95 ${timeStatus.borderColor}`}
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
                                {formatCreationTime(item.created_at)}
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
                  })}

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
                    {column.items.map(item => {
                      const timeStatus = getTimeStatus(item);
                      
                      return (
                        <div
                          key={item.id}
                          onClick={() => updateItemStatus(item.id, 'SERVED')}
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
                                  {formatCreationTime(item.created_at)}
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
                    })}
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
    </div>
  );
};

export default Kitchen;