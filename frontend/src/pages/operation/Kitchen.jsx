import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, ChefHat, Flame, Filter } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Kitchen = () => {
  const [kitchenBoard, setKitchenBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadKitchenBoard();
    loadGroups();
    
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

  const loadGroups = async () => {
    try {
      const data = await apiService.groups.getAll();
      setGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const updateItemStatus = async (itemId, newStatus) => {
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
      return date.toLocaleTimeString('es-PE', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch (error) {
      return '--:--';
    }
  };

  const getTimeStatus = (elapsedMinutes, preparationTime) => {
    const percentage = (elapsedMinutes / preparationTime) * 100;
    if (percentage > 100) return { color: 'bg-red-500', textColor: 'text-red-600', status: 'overdue' };
    if (percentage > 80) return { color: 'bg-orange-500', textColor: 'text-orange-600', status: 'warning' };
    return { color: 'bg-green-500', textColor: 'text-green-600', status: 'normal' };
  };

  // Filtrar y agrupar items por receta
  const filteredKitchenBoard = kitchenBoard.filter(recipe => {
    if (selectedGroupId === 'all') return true;
    if (selectedGroupId === 'no-group') return !recipe.recipe_group_id;
    return recipe.recipe_group_id === selectedGroupId;
  });

  const groupedByRecipe = filteredKitchenBoard.reduce((acc, recipe) => {
    const pendingItems = recipe.items.filter(item => item.status === 'CREATED');
    if (pendingItems.length > 0) {
      // Mantener orden estable: ordenar items por created_at para evitar movimiento
      const sortedItems = [...pendingItems].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      acc.push({
        ...recipe,
        items: sortedItems
      });
    }
    return acc;
  }, [])
  
  // Ordenar recetas de forma estable: primero por urgencia, luego por nombre para consistencia
  .sort((a, b) => {
    // Primero por items overdue (descendente)
    if (a.overdue_items !== b.overdue_items) {
      return b.overdue_items - a.overdue_items;
    }
    // Luego por items pendientes (descendente)  
    if (a.pending_items !== b.pending_items) {
      return b.pending_items - a.pending_items;
    }
    // Finalmente por nombre de receta (ascendente) para orden estable
    return a.recipe_name.localeCompare(b.recipe_name);
  });

  // Calcular estadísticas (basadas en datos filtrados)
  const totalPending = filteredKitchenBoard.reduce((sum, recipe) => sum + recipe.pending_items, 0);
  const totalOverdue = filteredKitchenBoard.reduce((sum, recipe) => sum + recipe.overdue_items, 0);
  const activeRecipes = groupedByRecipe.length;

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
      {/* Header compacto */}
      <div className="bg-white shadow-sm px-4 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Cocina
            </h1>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-600">En vivo</span>
            </div>
          </div>

          {/* Filtro de grupos en el centro */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-600" />
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value === 'all' ? 'all' : parseInt(e.target.value) || 'no-group')}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todos los grupos</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
              <option value="no-group">Sin grupo</option>
            </select>
          </div>
          
          {/* Estadísticas compactas */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="font-semibold text-yellow-700">{totalPending}</span>
              <span className="text-gray-600">pendientes</span>
            </div>
            {totalOverdue > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="font-semibold text-red-700">{totalOverdue}</span>
                <span className="text-gray-600">retrasados</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Flame className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-blue-700">{activeRecipes}</span>
              <span className="text-gray-600">recetas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tablero principal */}
      <div className="flex-1 overflow-auto p-2">
        {groupedByRecipe.length === 0 ? (
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
          <div className="space-y-2">
            {groupedByRecipe.map((recipe) => (
              <div key={`${recipe.recipe_name}-${recipe.recipe_group_id}`} className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Fila de receta optimizada */}
                <div className="flex items-center px-3 py-2">
                  {/* Lado izquierdo: Nombre e indicadores */}
                  <div className="flex items-center gap-3 w-72 flex-shrink-0">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-base leading-tight">
                        {recipe.recipe_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-600">
                          {recipe.pending_items} pendiente{recipe.pending_items > 1 ? 's' : ''}
                        </span>
                        {recipe.overdue_items > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                            {recipe.overdue_items}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lado derecho: Botones de órdenes */}
                  <div className="flex-1 overflow-x-auto">
                    <div className="flex gap-2 pb-1">
                      {recipe.items.map((item) => {
                        const timeStatus = getTimeStatus(item.elapsed_time_minutes, item.preparation_time);
                        const isOverdue = timeStatus.status === 'overdue';
                        const isWarning = timeStatus.status === 'warning';
                        
                        return (
                          <button
                            key={item.id}
                            onClick={() => updateItemStatus(item.id, 'SERVED')}
                            className={`
                              relative flex-shrink-0 w-52 rounded-lg border-2 transition-all duration-200 cursor-pointer
                              ${isOverdue ? 'border-red-300 bg-red-50 hover:bg-red-100 shadow-red-200' : 
                                isWarning ? 'border-orange-300 bg-orange-50 hover:bg-orange-100 shadow-orange-200' : 
                                'border-gray-300 bg-white hover:bg-blue-50'}
                              shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95
                            `}
                          >
                            {/* Barra de progreso de tiempo */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 rounded-t-lg overflow-hidden">
                              <div 
                                className={`h-full ${timeStatus.color} transition-all duration-300`}
                                style={{ width: `${Math.min((item.elapsed_time_minutes / item.preparation_time) * 100, 100)}%` }}
                              />
                            </div>

                            {/* Contenido del botón */}
                            <div className="p-3 space-y-2">
                              {/* Primera línea: Orden */}
                              <div className="flex items-center justify-end">
                                <span className="text-xs text-gray-500 font-medium">
                                  #{item.order_id}
                                </span>
                              </div>

                              {/* Zona y mesa */}
                              <div className="text-xs font-bold text-center py-2 px-3 text-gray-900">
                                {item.order_zone} - {item.order_table}
                              </div>

                              {/* Tiempo transcurrido */}
                              <div className="text-xs font-bold text-center py-2 px-3 text-gray-900">
                                {formatTime(item.elapsed_time_minutes)}
                              </div>

                              {/* Hora de creación */}
                              <div className="text-xs text-center text-gray-600">
                                Creado: {formatCreationTime(item.created_at)}
                              </div>


                              {/* Personalizaciones */}
                              {item.customizations_count > 0 && (
                                <div className="text-xs font-bold text-center py-2 px-3 text-gray-900">
                                  +{item.customizations_count} extra{item.customizations_count > 1 ? 's' : ''}
                                </div>
                              )}

                              {/* Notas (siempre mostrar campo) - Campo más grande y flexible */}
                              <div className="text-xs font-bold py-3 px-3 text-gray-900 min-h-[80px] break-words whitespace-pre-wrap leading-relaxed">
                                {(item.notes && item.notes.trim()) ? item.notes : ''}
                              </div>
                            </div>

                            {/* Badge de urgencia */}
                            {isOverdue && (
                              <div className="absolute -top-1 -right-1">
                                <div className="bg-red-500 text-white rounded-full p-0.5 animate-pulse">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Kitchen;