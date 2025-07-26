import { useState, useEffect } from 'react';
import { Table, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const TableStatus = () => {
  const { showError } = useToast();
  const [tables, setTables] = useState([]);
  const [zones, setZones] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState('');

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
    // Buscar pedidos activos (CREATED o SERVED) para esta mesa
    const activeOrders = orders.filter(order => 
      order.table === table.id && 
      (order.status === 'CREATED' || order.status === 'SERVED')
    );

    if (activeOrders.length > 0) {
      return {
        status: 'occupied',
        color: 'bg-red-500',
        textColor: 'text-white',
        borderColor: 'border-red-500',
        icon: AlertCircle,
        label: 'Ocupada',
        orders: activeOrders
      };
    } else {
      return {
        status: 'available',
        color: 'bg-green-500',
        textColor: 'text-white',
        borderColor: 'border-green-500',
        icon: CheckCircle,
        label: 'Disponible',
        orders: []
      };
    }
  };

  const getZoneName = (zoneId) => {
    const zone = zones.find(z => z.id === zoneId);
    return zone ? zone.name : 'Sin zona';
  };

  const filteredTables = selectedZone 
    ? tables.filter(table => table.zone === parseInt(selectedZone))
    : tables;

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
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estado de Mesas</h1>
          <p className="text-gray-600">Disponibilidad en tiempo real de las mesas</p>
        </div>
        
        {/* Filtro por zona */}
        <div className="flex items-center gap-4">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
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

      {/* Leyenda */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Leyenda</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700">Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span className="text-sm text-gray-700">Ocupada (con pedidos activos)</span>
          </div>
        </div>
      </div>

      {/* Mesas agrupadas por zona */}
      {Object.keys(groupedTables).length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Table className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay mesas</h3>
          <p className="text-gray-600">No se encontraron mesas para mostrar</p>
        </div>
      ) : (
        Object.entries(groupedTables).map(([zoneName, zoneTables]) => (
          <div key={zoneName} className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
              {zoneName}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {zoneTables.map((table) => {
                const tableStatus = getTableStatus(table);
                const StatusIcon = tableStatus.icon;
                
                return (
                  <div
                    key={table.id}
                    className={`relative p-4 rounded-lg border-2 ${tableStatus.borderColor} ${tableStatus.color} transition-all duration-200 hover:shadow-lg`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="flex items-center justify-center w-12 h-12 mb-2">
                        <StatusIcon className={`h-8 w-8 ${tableStatus.textColor}`} />
                      </div>
                      
                      <div className={`text-lg font-bold ${tableStatus.textColor} mb-1`}>
                        {table.table_number}
                      </div>
                      
                      <div className={`text-sm ${tableStatus.textColor} opacity-90 mb-2`}>
                        {tableStatus.label}
                      </div>
                      
                      {table.capacity && (
                        <div className={`flex items-center gap-1 text-xs ${tableStatus.textColor} opacity-75`}>
                          <Users className="h-3 w-3" />
                          <span>{table.capacity} personas</span>
                        </div>
                      )}
                      
                      {tableStatus.orders.length > 0 && (
                        <div className={`mt-2 text-xs ${tableStatus.textColor} opacity-90`}>
                          <div className="flex items-center gap-1 justify-center">
                            <Clock className="h-3 w-3" />
                            <span>{tableStatus.orders.length} pedido{tableStatus.orders.length > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default TableStatus;