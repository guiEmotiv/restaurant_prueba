import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';
import { 
  Users, 
  Clock,
  AlertCircle,
  Check,
  DollarSign,
  RefreshCw,
  Eye,
  Coffee
} from 'lucide-react';

const TableStatus = () => {
  // No se usan propiedades del AuthContext por ahora
  const { showToast } = useToast();

  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  const loadData = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setRefreshing(true);
      else setLoading(true);

      const [tablesRes, ordersRes] = await Promise.all([
        api.get('/config/tables/'),
        api.get('/operation/orders/?status=CREATED')
      ]);
      
      setTables(tablesRes.data);
      setOrders(ordersRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // Recargar datos cada 30 segundos
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    loadData(true);
  };

  const getTableOrders = (tableId) => {
    return orders.filter(order => order.table.id === tableId);
  };

  const getTableStatus = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    if (tableOrders.length === 0) return 'available';
    return 'occupied';
  };

  const getTableSummary = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    if (tableOrders.length === 0) return null;

    const totalAmount = tableOrders.reduce((sum, order) => 
      sum + parseFloat(order.grand_total || order.total_amount), 0
    );
    
    const totalItems = tableOrders.reduce((sum, order) => 
      sum + order.items.length, 0
    );

    const oldestOrder = tableOrders.reduce((oldest, order) => {
      const orderTime = new Date(order.created_at);
      const oldestTime = new Date(oldest.created_at);
      return orderTime < oldestTime ? order : oldest;
    });

    return {
      orderCount: tableOrders.length,
      totalAmount,
      totalItems,
      duration: getDurationText(oldestOrder.created_at),
      orders: tableOrders
    };
  };

  const getDurationText = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMinutes = Math.floor((now - created) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  };

  const getStatusColor = (status, duration = '') => {
    if (status === 'available') {
      return 'border-green-200 bg-green-50';
    }
    
    // Para mesas ocupadas, verificar si llevan mucho tiempo
    if (duration.includes('h')) {
      const hours = parseInt(duration.split('h')[0]);
      if (hours >= 2) {
        return 'border-red-200 bg-red-50';
      } else if (hours >= 1) {
        return 'border-yellow-200 bg-yellow-50';
      }
    }
    
    return 'border-blue-200 bg-blue-50';
  };

  const getStatusIcon = (status, duration = '') => {
    if (status === 'available') {
      return <Check className="text-green-600" size={20} />;
    }
    
    if (duration.includes('h')) {
      const hours = parseInt(duration.split('h')[0]);
      if (hours >= 2) {
        return <AlertCircle className="text-red-600" size={20} />;
      } else if (hours >= 1) {
        return <Clock className="text-yellow-600" size={20} />;
      }
    }
    
    return <Users className="text-blue-600" size={20} />;
  };

  const viewOrderDetails = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    setSelectedOrderDetails(tableOrders);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando estado de mesas...</p>
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Estado de Mesas</h1>
              <p className="text-gray-600 mt-1">Monitor de ocupación en tiempo real</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
              <span>Actualizar</span>
            </button>
          </div>
          
          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Check className="text-green-600" size={20} />
                <span className="text-green-700 font-medium">Disponibles</span>
              </div>
              <div className="text-2xl font-bold text-green-700 mt-1">
                {tables.filter(t => getTableStatus(t.id) === 'available').length}
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Users className="text-blue-600" size={20} />
                <span className="text-blue-700 font-medium">Ocupadas</span>
              </div>
              <div className="text-2xl font-bold text-blue-700 mt-1">
                {tables.filter(t => getTableStatus(t.id) === 'occupied').length}
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Coffee className="text-gray-600" size={20} />
                <span className="text-gray-700 font-medium">Pedidos Activos</span>
              </div>
              <div className="text-2xl font-bold text-gray-700 mt-1">
                {orders.length}
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <DollarSign className="text-green-600" size={20} />
                <span className="text-green-700 font-medium">Ventas Pendientes</span>
              </div>
              <div className="text-2xl font-bold text-green-700 mt-1">
                S/ {orders.reduce((sum, order) => sum + parseFloat(order.grand_total || order.total_amount), 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Grid de mesas */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {tables.map(table => {
            const status = getTableStatus(table.id);
            const summary = getTableSummary(table.id);
            const duration = summary?.duration || '';
            
            return (
              <div
                key={table.id}
                className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${getStatusColor(status, duration)}`}
              >
                <div className="text-center mb-3">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white flex items-center justify-center shadow-sm">
                    {getStatusIcon(status, duration)}
                  </div>
                  <h3 className="font-semibold text-gray-900">Mesa {table.table_number}</h3>
                  <p className="text-xs text-gray-600">{table.zone.name}</p>
                </div>

                {status === 'available' ? (
                  <div className="text-center">
                    <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                      Disponible
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-center">
                      <div className="text-xs bg-white bg-opacity-80 px-2 py-1 rounded-full font-medium mb-2">
                        {summary.orderCount} pedido{summary.orderCount > 1 ? 's' : ''}
                      </div>
                      
                      <div className="text-xs text-gray-700 space-y-1">
                        <div className="flex justify-between">
                          <span>Items:</span>
                          <span className="font-medium">{summary.totalItems}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span className="font-medium">S/ {summary.totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tiempo:</span>
                          <span className="font-medium">{duration}</span>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => viewOrderDetails(table.id)}
                      className="w-full text-xs bg-white bg-opacity-80 hover:bg-opacity-100 px-2 py-1 rounded-lg flex items-center justify-center space-x-1 transition-colors"
                    >
                      <Eye size={12} />
                      <span>Ver Detalle</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de detalles de pedidos */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">
                  Detalles de Mesa {selectedOrderDetails[0]?.table?.table_number}
                </h3>
                <button
                  onClick={() => setSelectedOrderDetails(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {selectedOrderDetails.map(order => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Pedido #{order.id}</h4>
                      <div className="text-sm text-gray-600 flex items-center space-x-2 mt-1">
                        <Clock size={14} />
                        <span>{new Date(order.created_at).toLocaleString()}</span>
                        {order.waiter && <span>• {order.waiter}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">S/ {order.grand_total || order.total_amount}</div>
                      <div className="text-sm text-gray-600">{order.items.length} items</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 last:border-b-0">
                        <div>
                          <span className="font-medium">{item.recipe.name}</span>
                          {item.notes && (
                            <div className="text-xs text-gray-600 mt-1">Nota: {item.notes}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div>x{item.quantity}</div>
                          <div className="text-xs text-gray-600">S/ {item.total_price}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableStatus;