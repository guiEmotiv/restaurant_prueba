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
      
      // Debug: mostrar estructura de datos
      console.log('Tables data:', tablesData);
      console.log('Sample table:', tablesData[0]);
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

      <div className="pt-24 px-3 space-y-6">
        {/* Vista por zonas */}
        {zones.filter(zone => {
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
                      <div 
                        key={table.id}
                        className={`border-2 rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md ${
                          isOccupied 
                            ? 'border-red-200 bg-red-50' 
                            : 'border-green-200 bg-green-50'
                        }`}
                      >
                        <div 
                          onClick={() => handleTableClick(table)}
                          className="p-3 cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                isOccupied ? 'bg-red-100' : 'bg-green-100'
                              }`}>
                                <div className={`w-4 h-4 rounded ${
                                  isOccupied ? 'bg-red-500' : 'bg-green-500'
                                }`}></div>
                              </div>
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900">
                                  {table.name || table.number || `Mesa ${table.id}`}
                                </h3>
                              </div>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${
                              isOccupied ? 'bg-red-500' : 'bg-green-500'
                            }`}></div>
                          </div>
                          
                          {isOccupied && (
                            <div className="text-xs text-gray-600 space-y-1">
                              <div>{ordersCount} cuenta{ordersCount !== 1 ? 's' : ''}</div>
                              <div className="font-medium text-blue-700">
                                {itemsStatus.served}/{itemsStatus.total} items
                              </div>
                            </div>
                          )}
                          
                          {!isOccupied && (
                            <div className="text-xs text-gray-500 text-center">
                              Disponible
                            </div>
                          )}
                        </div>
                        
                        {isOccupied && (
                          <div className="px-3 pb-3">
                            <button
                              onClick={(e) => handleNewOrder(table, e)}
                              className="w-full py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                            >
                              + Nueva Cuenta
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

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