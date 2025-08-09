import { useState, useEffect } from 'react';
import { Plus, ShoppingCart, Search, Clock } from 'lucide-react';
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
      
      tableOrders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          totalItems += order.items.length;
          pendingItems += order.items.filter(item => item.status === 'CREATED').length;
        }
      });
      
      return {
        status: 'occupied',
        ordersCount: table.active_orders_count || 1,
        totalItems,
        pendingItems
      };
    } else {
      return {
        status: 'available',
        ordersCount: 0,
        totalItems: 0,
        pendingItems: 0
      };
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

  const groupedTables = filteredTables.reduce((acc, table) => {
    const zoneName = getZoneName(table.zone);
    if (!acc[zoneName]) {
      acc[zoneName] = [];
    }
    acc[zoneName].push(table);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Fijo */}
      <div className="bg-white shadow-sm sticky top-0 z-50 border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-gray-900">Estado de Mesas</h1>
            <span className="text-sm text-gray-500">{filteredTables.length} mesas</span>
          </div>

          {/* Controles Compactos */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar mesa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todas las zonas</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="px-4 py-4">
        {Object.keys(groupedTables).length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">Sin mesas disponibles</div>
            <div className="text-sm text-gray-500">Ajusta los filtros para ver más mesas</div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTables).map(([zoneName, zoneTables]) => (
              <div key={zoneName}>
                <h2 className="text-sm font-medium text-gray-700 mb-3 px-1">{zoneName}</h2>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {zoneTables.map((table) => {
                    const tableStatus = getTableStatus(table);
                    const isAvailable = tableStatus.status === 'available';
                    
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleTableClick(table)}
                        className={`relative p-3 rounded-lg border-2 transition-all active:scale-95 ${
                          isAvailable 
                            ? 'bg-white border-green-200 hover:border-green-300 hover:shadow-sm' 
                            : 'bg-red-50 border-red-200 hover:border-red-300 hover:shadow-sm'
                        }`}
                      >
                        {/* Badge de múltiples pedidos */}
                        {tableStatus.ordersCount > 1 && (
                          <div className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                            {tableStatus.ordersCount}
                          </div>
                        )}
                        
                        {/* Icono */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 mx-auto ${
                          isAvailable ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {isAvailable ? (
                            <Plus className="h-4 w-4" />
                          ) : (
                            <ShoppingCart className="h-4 w-4" />
                          )}
                        </div>
                        
                        {/* Número de mesa */}
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          Mesa {table.table_number}
                        </div>
                        
                        {/* Status */}
                        {!isAvailable ? (
                          <div className="flex items-center justify-center gap-1 text-xs text-gray-600">
                            <Clock className="h-3 w-3" />
                            <span>{tableStatus.pendingItems}/{tableStatus.totalItems}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-green-600 font-medium">Libre</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Espaciado inferior */}
      <div className="h-16"></div>
    </div>
  );
};

export default TableStatus;