import { useState, useEffect } from 'react';
import { Users, Clock, ShoppingCart, Eye, DollarSign, Package, RefreshCw } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const TableStatus = () => {
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadData();
    
    let interval;
    if (autoRefresh) {
      interval = setInterval(loadData, 10000); // Actualizar cada 10 segundos
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadData = async () => {
    try {
      const [tablesData, ordersData] = await Promise.all([
        apiService.tables.getAll(),
        apiService.orders.getActive()
      ]);
      
      setTables(Array.isArray(tablesData) ? tablesData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar los datos');
      setLoading(false);
    }
  };

  const getTableOrder = (tableId) => {
    return orders.find(order => order.table === tableId && order.status === 'CREATED');
  };

  const getTableStatus = (table) => {
    const order = getTableOrder(table.id);
    if (!order) return 'available';
    
    const hasUnservedItems = order.items?.some(item => item.status === 'CREATED');
    const allItemsServed = order.items?.every(item => item.status === 'SERVED');
    
    if (allItemsServed && order.items?.length > 0) return 'ready_to_pay';
    if (hasUnservedItems) return 'occupied';
    return 'available';
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'available':
        return {
          color: 'bg-green-50 border-green-200',
          textColor: 'text-green-700',
          icon: Users,
          label: 'Disponible'
        };
      case 'occupied':
        return {
          color: 'bg-orange-50 border-orange-200',
          textColor: 'text-orange-700',
          icon: Clock,
          label: 'En servicio'
        };
      case 'ready_to_pay':
        return {
          color: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-700',
          icon: DollarSign,
          label: 'Listo para pago'
        };
      default:
        return {
          color: 'bg-gray-50 border-gray-200',
          textColor: 'text-gray-700',
          icon: Users,
          label: 'Desconocido'
        };
    }
  };

  const handleViewOrder = async (order) => {
    // Aquí podrías abrir un modal o navegar a una vista detallada
    console.log('Ver orden:', order);
    showSuccess(`Viendo orden #${order.id}`);
  };

  // Agrupar mesas por zona
  const tablesByZone = tables.reduce((acc, table) => {
    const zoneName = table.zone_name || 'Sin Zona';
    if (!acc[zoneName]) acc[zoneName] = [];
    acc[zoneName].push(table);
    return acc;
  }, {});

  // Estadísticas generales
  const stats = {
    total: tables.length,
    available: tables.filter(table => getTableStatus(table) === 'available').length,
    occupied: tables.filter(table => getTableStatus(table) === 'occupied').length,
    readyToPay: tables.filter(table => getTableStatus(table) === 'ready_to_pay').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Cargando estado de mesas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Estado de Mesas</h1>
            
            <div className="flex items-center gap-4">
              {/* Auto-refresh toggle */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">Auto-actualizar</span>
              </label>
              
              {/* Manual refresh */}
              <button
                onClick={() => {
                  setLoading(true);
                  loadData();
                }}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                <RefreshCw className={`h-5 w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
              
              {/* Live indicator */}
              {autoRefresh && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600">En vivo</span>
                </div>
              )}
            </div>
          </div>

          {/* Estadísticas */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-100 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="bg-green-100 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{stats.available}</div>
              <div className="text-sm text-green-600">Disponibles</div>
            </div>
            <div className="bg-orange-100 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-700">{stats.occupied}</div>
              <div className="text-sm text-orange-600">En servicio</div>
            </div>
            <div className="bg-blue-100 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.readyToPay}</div>
              <div className="text-sm text-blue-600">Listas para pago</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {Object.entries(tablesByZone).map(([zoneName, zoneTables]) => (
          <div key={zoneName} className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 border-b-2 border-gray-200 pb-2">
              {zoneName}
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {zoneTables.map(table => {
                const status = getTableStatus(table);
                const statusInfo = getStatusInfo(status);
                const order = getTableOrder(table.id);
                const IconComponent = statusInfo.icon;
                
                return (
                  <div
                    key={table.id}
                    className={`
                      ${statusInfo.color} 
                      rounded-lg border-2 p-4 transition-all duration-200 hover:shadow-md
                      ${status !== 'available' ? 'cursor-pointer hover:scale-105' : ''}
                    `}
                    onClick={() => order && handleViewOrder(order)}
                  >
                    <div className="text-center space-y-3">
                      <IconComponent className={`h-8 w-8 mx-auto ${statusInfo.textColor}`} />
                      
                      <div>
                        <div className="font-bold text-xl text-gray-900">
                          {table.table_number}
                        </div>
                        <div className={`text-sm font-medium ${statusInfo.textColor}`}>
                          {statusInfo.label}
                        </div>
                      </div>

                      {order && (
                        <div className="space-y-2 pt-2 border-t border-gray-200">
                          <div className="text-xs text-gray-600">
                            Orden #{order.id}
                          </div>
                          
                          <div className="flex items-center justify-center gap-1 text-xs text-gray-600">
                            <ShoppingCart className="h-3 w-3" />
                            <span>{order.items?.length || 0} items</span>
                          </div>
                          
                          <div className="text-sm font-bold text-gray-900">
                            S/ {order.total_amount}
                          </div>

                          {/* Items para llevar */}
                          {order.items?.some(item => item.is_takeaway) && (
                            <div className="flex items-center justify-center gap-1 text-xs text-orange-600">
                              <Package className="h-3 w-3" />
                              <span>Para llevar</span>
                            </div>
                          )}

                          {/* Progreso de cocina */}
                          {order.items && order.items.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-xs text-gray-600">
                                {order.items.filter(item => item.status === 'SERVED').length} / {order.items.length} servidos
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-green-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{ 
                                    width: `${(order.items.filter(item => item.status === 'SERVED').length / order.items.length) * 100}%` 
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Tiempo transcurrido */}
                          <div className="text-xs text-gray-500">
                            {new Date(order.created_at).toLocaleTimeString('es-PE', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>

                          {status !== 'available' && (
                            <div className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                              <Eye className="h-3 w-3" />
                              <span>Ver detalles</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TableStatus;