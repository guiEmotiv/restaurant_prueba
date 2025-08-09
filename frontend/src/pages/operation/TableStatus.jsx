import { useState, useEffect } from 'react';
import { Search, MapPin, Clock, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const TableStatus = () => {
  const { showError } = useToast();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [zones, setZones] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tablesData, zonesData, ordersData] = await Promise.all([
        apiService.tables.getAll(),
        apiService.zones.getAll(),
        apiService.orders.getAll()
      ]);
      
      setTables(Array.isArray(tablesData) ? tablesData : []);
      setZones(Array.isArray(zonesData) ? zonesData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const getTableStatus = (table) => {
    if (table.has_active_orders) {
      const tableOrders = orders.filter(order => order.table === table.id && order.status === 'ACTIVE');
      let totalItems = 0;
      let pendingItems = 0;
      let totalAmount = 0;
      
      tableOrders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          totalItems += order.items.length;
          pendingItems += order.items.filter(item => item.status === 'CREATED').length;
          totalAmount += order.total_amount || 0;
        }
      });
      
      return {
        status: 'occupied',
        ordersCount: table.active_orders_count || 1,
        totalItems,
        pendingItems,
        totalAmount,
        occupancyTime: tableOrders[0]?.created_at ? calculateTime(tableOrders[0].created_at) : '0m'
      };
    } else {
      return {
        status: 'available',
        ordersCount: 0,
        totalItems: 0,
        pendingItems: 0,
        totalAmount: 0,
        occupancyTime: null
      };
    }
  };

  const calculateTime = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  };

  const getZoneName = (zoneId) => {
    const zone = zones.find(z => z.id === zoneId);
    return zone ? zone.name : 'Sin zona';
  };

  const handleTableClick = async (table) => {
    const tableStatus = getTableStatus(table);
    
    if (tableStatus.status === 'occupied') {
      if (tableStatus.ordersCount === 1) {
        try {
          const activeOrders = await apiService.tables.getActiveOrders(table.id);
          if (activeOrders && activeOrders.length > 0) {
            navigate(`/table/${table.id}/order-edit`, {
              state: { orderId: activeOrders[0].id }
            });
          }
        } catch (error) {
          console.error('Error getting active orders:', error);
          showError('Error al obtener los pedidos activos');
        }
      } else {
        navigate(`/table/${table.id}/orders`);
      }
    } else {
      navigate(`/table/${table.id}/order-ecommerce`);
    }
  };

  const filteredTables = tables.filter(table => {
    const matchesZone = selectedZone ? table.zone === parseInt(selectedZone) : true;
    const matchesSearch = searchTerm === '' || 
      table.table_number.toString().includes(searchTerm) ||
      getZoneName(table.zone).toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesZone && matchesSearch;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
        <div className="px-3 py-3 pl-16">
          <h1 className="text-base font-medium text-gray-900 mb-3">Estado de Mesas</h1>
          
          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Zone Filter */}
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="">Todas las zonas</option>
            {zones.map(zone => (
              <option key={zone.id} value={zone.id}>{zone.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tables List */}
      <div className="px-3 py-3" style={{paddingTop: '130px'}}>
        {filteredTables.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-sm">Sin mesas</div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTables.map((table) => {
              const tableStatus = getTableStatus(table);
              const isAvailable = tableStatus.status === 'available';
              
              return (
                <button
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  className="w-full p-3 bg-white rounded border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded flex items-center justify-center text-white text-sm font-medium ${
                        isAvailable ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {table.table_number}
                      </div>
                      
                      <div className="text-left">
                        <div className="font-medium text-sm text-gray-900">Mesa {table.table_number}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {getZoneName(table.zone)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        isAvailable 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {isAvailable ? 'Disponible' : 'Ocupada'}
                      </div>
                      
                      {!isAvailable && (
                        <div className="text-xs mt-1 space-y-0.5">
                          <div className="flex items-center gap-1 justify-end text-gray-600">
                            <Users className="h-3 w-3" />
                            {tableStatus.ordersCount} cuenta{tableStatus.ordersCount > 1 ? 's' : ''}
                          </div>
                          <div className="font-medium text-gray-900">
                            {tableStatus.pendingItems}/{tableStatus.totalItems} items
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TableStatus;