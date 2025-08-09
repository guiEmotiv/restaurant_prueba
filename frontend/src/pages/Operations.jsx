import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { 
  Table, 
  Plus, 
  Users, 
  Clock,
  ShoppingCart,
  Filter
} from 'lucide-react';
import { apiService } from '../services/api';

const Operations = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tablesData, ordersData, orderItemsData, zonesData] = await Promise.all([
        apiService.tables.getAll(),
        apiService.orders.getAll(),
        apiService.orderItems.getAll(),
        apiService.zones.getAll()
      ]);
      setTables(Array.isArray(tablesData) ? tablesData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setOrderItems(Array.isArray(orderItemsData) ? orderItemsData : []);
      setZones(Array.isArray(zonesData) ? zonesData : []);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar datos');
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

      <div className="pt-24 px-3 space-y-5">
        {/* Mesas Ocupadas */}
        {occupiedTables.length > 0 && (
          <section>
            <div className="text-center mb-4">
              <h2 className="text-sm font-semibold text-gray-800">
                Mesas Ocupadas ({occupiedTables.length})
              </h2>
              <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mt-1"></div>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {occupiedTables.map((table) => {
                const ordersCount = getOrdersCount(table.id);
                const itemsStatus = getTableItemsStatus(table.id);
                const zoneName = zones.find(zone => zone.id === table.zone)?.name || 'Sin zona';
                
                return (
                  <div 
                    key={table.id} 
                    className="bg-white rounded-lg shadow-sm border border-red-100 overflow-hidden"
                  >
                    <div 
                      onClick={() => handleTableClick(table)}
                      className="p-4 cursor-pointer hover:bg-red-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <Table className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">{table.name}</h3>
                            <p className="text-xs text-gray-500">{zoneName}</p>
                          </div>
                        </div>
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {ordersCount} cuenta{ordersCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-700">
                            {itemsStatus.served}/{itemsStatus.total} items
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="px-4 pb-3">
                      <button
                        onClick={(e) => handleNewOrder(table, e)}
                        className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Nueva Cuenta
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Mesas Disponibles */}
        {availableTables.length > 0 && (
          <section>
            <div className="text-center mb-4">
              <h2 className="text-sm font-semibold text-gray-800">
                Mesas Disponibles ({availableTables.length})
              </h2>
              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mt-1"></div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {availableTables.map((table) => {
                const zoneName = zones.find(zone => zone.id === table.zone)?.name || 'Sin zona';
                
                return (
                  <div 
                    key={table.id}
                    onClick={() => handleTableClick(table)}
                    className="bg-white rounded-lg shadow-sm border border-green-100 p-4 cursor-pointer hover:bg-green-50 transition-colors"
                  >
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <Table className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">{table.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{zoneName}</p>
                      </div>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty State */}
        {tables.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Table className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay mesas configuradas</h3>
            <p className="text-gray-500 text-sm">Configure las mesas desde la sección de configuración</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Operations;