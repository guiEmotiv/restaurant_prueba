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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-30">
        <div className="px-4 py-3 pl-16">
          <h1 className="text-lg font-bold text-gray-900 mb-3">Estado de Mesas</h1>
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar mesa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
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
      <div className="px-4 py-4 pt-32">
        {filteredTables.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-500 mb-2">Sin mesas</div>
            <div className="text-sm text-gray-400">Revisa los filtros</div>
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
                  className={`w-full p-3 rounded border transition-all ${
                    isAvailable 
                      ? 'bg-green-50 border-green-500 text-green-900' 
                      : 'bg-red-50 border-red-500 text-red-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded flex items-center justify-center text-sm font-bold text-white ${
                        isAvailable ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {table.table_number}
                      </div>
                      
                      <div className="text-left">
                        <div className="font-medium text-sm">Mesa {table.table_number}</div>
                        <div className="text-xs opacity-75 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {getZoneName(table.zone)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`px-2 py-1 rounded text-xs font-bold ${
                        isAvailable 
                          ? 'bg-green-500 text-white' 
                          : 'bg-red-500 text-white'
                      }`}>
                        {isAvailable ? 'DISPONIBLE' : 'OCUPADA'}
                      </div>
                      
                      {!isAvailable && (
                        <div className="text-xs mt-1 space-y-0.5">
                          <div className="flex items-center gap-1 justify-end">
                            <Users className="h-3 w-3" />
                            {tableStatus.ordersCount} cuenta{tableStatus.ordersCount > 1 ? 's' : ''}
                          </div>
                          <div className="font-medium">
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