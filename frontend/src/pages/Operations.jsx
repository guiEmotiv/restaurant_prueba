import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { 
  Table, 
  Plus, 
  Users, 
  Clock,
  ShoppingCart,
  Filter,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { apiService } from '../services/api';
import api from '../services/api';

const Operations = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiHealthy, setApiHealthy] = useState(null);

  useEffect(() => {
    checkAPIHealth();
    loadData();
  }, []);

  const checkAPIHealth = async () => {
    try {
      console.log('🏥 Checking API health...');
      const response = await api.get('/health/');
      console.log('✅ API Health:', response.data);
      setApiHealthy(true);
      
      // También hacer check de debug de base de datos
      try {
        const debugResponse = await api.get('/debug/database/');
        console.log('🔍 Database Debug:', debugResponse.data);
        if (debugResponse.data.status === 'needs_data') {
          console.warn('⚠️ Database needs data population');
        }
      } catch (debugError) {
        console.warn('Debug endpoint not available:', debugError);
      }
    } catch (error) {
      console.error('❌ API Health check failed:', error);
      setApiHealthy(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading data from API...');
      
      const [tablesData, ordersData, orderItemsData, zonesData] = await Promise.all([
        apiService.tables.getAll(),
        apiService.orders.getAll(),
        apiService.orderItems.getAll(),
        apiService.zones.getAll()
      ]);
      
      // Debug completo de datos
      console.log('📊 Data loaded from API:');
      console.log('  - Tables:', tablesData);
      console.log('  - Orders:', ordersData);
      console.log('  - Order Items:', orderItemsData);
      console.log('  - Zones:', zonesData);
      
      // Validar y establecer datos
      setTables(Array.isArray(tablesData) ? tablesData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setOrderItems(Array.isArray(orderItemsData) ? orderItemsData : []);
      setZones(Array.isArray(zonesData) ? zonesData : []);
      
      // Debug: mostrar estructura de datos
      if (tablesData && tablesData.length > 0) {
        console.log('📋 Sample table structure:', tablesData[0]);
        console.log('  Fields:', Object.keys(tablesData[0]));
      } else {
        console.warn('⚠️ No tables data received');
      }
      
      if (zonesData && zonesData.length > 0) {
        console.log('📋 Sample zone structure:', zonesData[0]);
      } else {
        console.warn('⚠️ No zones data received');
      }
    } catch (error) {
      console.error('❌ Error loading data:', error);
      console.error('  Error details:', error.response?.data);
      console.error('  Status:', error.response?.status);
      console.error('  URL:', error.config?.url);
      setError(error.response?.data?.detail || error.message);
      showError(`Error al cargar datos: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getTableOrders = (tableId) => {
    return orders.filter(order => 
      order.table === tableId && order.status !== 'PAID' && order.status !== 'CANCELLED'
    );
  };

  const getTableStatus = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    return tableOrders.length > 0 ? 'occupied' : 'available';
  };

  const getTableItemsStatus = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    const allOrderIds = tableOrders.map(order => order.id);
    const tableOrderItems = orderItems.filter(item => allOrderIds.includes(item.order));
    
    const servedItems = tableOrderItems.filter(item => item.status === 'SERVED').length;
    const totalItems = tableOrderItems.length;
    
    return { served: servedItems, total: totalItems };
  };

  const getOrdersCount = (tableId) => {
    return getTableOrders(tableId).length;
  };

  const getFilteredTables = () => {
    if (!selectedZone) return tables;
    return tables.filter(table => table.zone === parseInt(selectedZone));
  };


  const handleTableClick = (table) => {
    const status = getTableStatus(table.id);
    if (status === 'available') {
      navigate(`/operations/table/${table.id}/new`);
    } else {
      navigate(`/operations/table/${table.id}/manage`);
    }
  };

  const handleNewOrder = (table, e) => {
    e.stopPropagation();
    navigate(`/operations/table/${table.id}/new`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-40 px-4 py-3 border-b">
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
        <div className="pt-20 px-3 space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const filteredTables = getFilteredTables();
  const availableTables = filteredTables.filter(table => getTableStatus(table.id) === 'available');
  const occupiedTables = filteredTables.filter(table => getTableStatus(table.id) === 'occupied');

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header fijo */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-40 px-4 py-3 border-b">
        <h1 className="text-lg font-bold text-gray-900 text-center">Operaciones</h1>
        
        {/* API Status */}
        {apiHealthy !== null && (
          <div className="mt-2 flex items-center justify-center">
            <div className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
              apiHealthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                apiHealthy ? 'bg-green-500' : 'bg-red-500'
              } animate-pulse`}></div>
              {apiHealthy ? 'Conectado' : 'Sin conexión'}
            </div>
          </div>
        )}
        
        {/* Filtro por zona */}
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
            >
              <option value="">Todas las zonas</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="pt-32 px-3 space-y-6">
        {/* Build Info Banner - Only show in first 30 seconds */}
        {!loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <div className="text-xs text-blue-700">
              🚀 Sistema actualizado - Build: {new Date().toISOString().slice(0, 16).replace('T', ' ')} | Paginación deshabilitada para todos los datos
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-red-900">Error de conexión</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    checkAPIHealth();
                    loadData();
                  }}
                  className="mt-3 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reintentar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vista por zonas */}
        {!error && zones.filter(zone => {
          const zoneTables = filteredTables.filter(table => table.zone === zone.id);
          return zoneTables.length > 0;
        }).map((zone) => {
          const zoneTables = filteredTables.filter(table => table.zone === zone.id);
          const occupiedZoneTables = zoneTables.filter(table => getTableStatus(table.id) === 'occupied');
          const availableZoneTables = zoneTables.filter(table => getTableStatus(table.id) === 'available');
          
          return (
            <div key={zone.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-white px-4 py-3 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 text-center">{zone.name}</h2>
              </div>
              
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  {zoneTables.map((table) => {
                    const status = getTableStatus(table.id);
                    const ordersCount = getOrdersCount(table.id);
                    const itemsStatus = getTableItemsStatus(table.id);
                    const isOccupied = status === 'occupied';
                    
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleTableClick(table)}
                        className={`w-full text-left border-2 rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          isOccupied 
                            ? 'border-red-200 bg-red-50 hover:border-red-300 focus:ring-red-500' 
                            : 'border-green-200 bg-green-50 hover:border-green-300 focus:ring-green-500'
                        }`}
                      >
                        <div className="p-3 hover:opacity-90 transition-opacity">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                isOccupied ? 'bg-red-100' : 'bg-green-100'
                              }`}>
                                <Table className={`h-4 w-4 ${
                                  isOccupied ? 'text-red-600' : 'text-green-600'
                                }`} />
                              </div>
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900">
                                  {table.table_number || `Mesa ${table.id}`}
                                </h3>
                              </div>
                            </div>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${
                              isOccupied ? 'bg-red-500' : 'bg-green-500'
                            }`}></div>
                          </div>
                          
                          {isOccupied && (
                            <div className="text-xs text-gray-600 space-y-1">
                              <div className="flex items-center gap-1">
                                <ShoppingCart className="h-3 w-3 text-gray-500" />
                                <span>{ordersCount} cuenta{ordersCount !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="font-medium text-blue-700">
                                {itemsStatus.served}/{itemsStatus.total} items
                              </div>
                            </div>
                          )}
                          
                          {!isOccupied && (
                            <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>Disponible</span>
                            </div>
                          )}
                        </div>
                        
                        {isOccupied && (
                          <div className="px-3 pb-3 border-t border-gray-100 pt-2">
                            <div
                              onClick={(e) => handleNewOrder(table, e)}
                              className="w-full py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors text-center"
                            >
                              <Plus className="h-3 w-3 inline-block mr-1" />
                              Nueva Cuenta
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {!error && !loading && tables.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Table className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay mesas configuradas</h3>
            <p className="text-gray-500 text-sm mb-4">Configure las mesas desde la sección de configuración</p>
            <button
              onClick={() => {
                checkAPIHealth();
                loadData();
              }}
              className="mx-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Recargar datos
            </button>
          </div>
        )}
        
        {/* Data Debug Info */}
        {!loading && tables.length === 0 && zones.length === 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-900 mb-2">🐛 Información de depuración:</h4>
            <ul className="text-xs text-yellow-700 space-y-1">
              <li>API Health: {apiHealthy ? '✅ Conectado' : '❌ Sin conexión'}</li>
              <li>Tables: {tables.length} registros</li>
              <li>Zones: {zones.length} registros</li>
              <li>Orders: {orders.length} registros</li>
              <li>Order Items: {orderItems.length} registros</li>
              <li>API URL: {import.meta.env.VITE_API_URL || 'No configurada'}</li>
              <li>Mode: {import.meta.env.MODE}</li>
            </ul>
            <div className="mt-3 text-xs text-yellow-800">
              <p><strong>Posibles causas:</strong></p>
              <ul className="ml-4 list-disc">
                <li>Base de datos vacía en EC2</li>
                <li>Migraciones no ejecutadas</li>
                <li>Datos no poblados en producción</li>
                <li>Error de conexión a base de datos</li>
              </ul>
              <p className="mt-2"><strong>Solución:</strong> Ejecutar en EC2: <code>sudo ./deploy/build-deploy.sh</code></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Operations;