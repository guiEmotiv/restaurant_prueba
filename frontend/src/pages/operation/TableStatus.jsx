import { useState, useEffect } from 'react';
import { Table, Users, Clock, CheckCircle, AlertCircle, Plus, ShoppingCart, Filter, Search } from 'lucide-react';
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
    // Usar la información del backend directamente
    if (table.has_active_orders) {
      return {
        status: 'occupied',
        color: 'bg-red-500',
        textColor: 'text-white',
        borderColor: 'border-red-500',
        icon: AlertCircle,
        label: 'Ocupada',
        ordersCount: table.active_orders_count || 1
      };
    } else {
      return {
        status: 'available',
        color: 'bg-green-500',
        textColor: 'text-white',
        borderColor: 'border-green-500',
        icon: CheckCircle,
        label: 'Disponible',
        ordersCount: 0
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
      // Si la mesa tiene pedidos activos
      if (tableStatus.ordersCount === 1) {
        // Si solo hay un pedido, obtenerlo y navegar directo a edición
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
        // Si hay múltiples pedidos, mostrar lista para seleccionar
        navigate(`/table/${table.id}/orders`);
      }
    } else {
      // Si la mesa está disponible, ir a crear nuevo pedido tipo e-commerce
      navigate(`/table/${table.id}/order-ecommerce`);
    }
  };

  // Filtrar mesas por zona y búsqueda
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
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando mesas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col h-full">
      {/* Header fijo compacto */}
      <div className="p-2 sm:p-3 border-b border-gray-200 bg-white shadow-sm">
        <div className="text-center mb-2">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">Estado de Mesas</h2>
          <p className="text-xs text-gray-500">{filteredTables.length} mesas disponibles</p>
        </div>

        {/* Filtros compactos */}
        <div className="space-y-2">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar mesa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Filtro por zona */}
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todas las zonas</option>
            {zones.map(zone => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
          
          {/* Leyenda de estados compacta */}
          <div className="flex items-center justify-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-gray-600">Libre</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-gray-600">Ocupada</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span className="text-gray-600">Múltiple</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal scrollable */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3">
        {Object.keys(groupedTables).length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Table className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">No hay mesas</h3>
              <p className="text-xs text-gray-500">No se encontraron mesas</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedTables).map(([zoneName, zoneTables]) => (
              <div key={zoneName}>
                <div className="flex items-center gap-1 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <h3 className="text-sm font-semibold text-gray-800">{zoneName}</h3>
                  <span className="text-xs text-gray-500">({zoneTables.length})</span>
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {zoneTables.map((table) => {
                    const tableStatus = getTableStatus(table);
                    const StatusIcon = tableStatus.status === 'available' ? Plus : ShoppingCart;
                    
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleTableClick(table)}
                        className={`group relative p-2 rounded-lg border transition-all duration-200 hover:shadow-md ${
                          tableStatus.status === 'available' 
                            ? 'border-green-200 bg-green-50 hover:border-green-300' 
                            : 'border-red-200 bg-red-50 hover:border-red-300'
                        }`}
                      >
                        {/* Indicador de estado */}
                        <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                          tableStatus.status === 'available' ? 'bg-green-400' : 'bg-red-400'
                        }`}></div>
                        
                        {/* Contenido principal */}
                        <div className="flex flex-col items-center text-center">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full mb-1 ${
                            tableStatus.status === 'available' 
                              ? 'bg-green-500' 
                              : 'bg-red-500'
                          }`}>
                            <StatusIcon className="h-4 w-4 text-white" />
                          </div>
                          
                          <div className="text-xs font-bold text-gray-900">
                            M{table.table_number}
                          </div>
                          <div className="text-xs text-gray-600">
                            <Users className="h-3 w-3 inline" />
                            <span className="ml-0.5">{table.capacity || 4}</span>
                          </div>
                        </div>
                        
                        {/* Badge de múltiples cuentas */}
                        {tableStatus.ordersCount > 1 && (
                          <div className="absolute -top-1 -right-1">
                            <div className="bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">
                              {tableStatus.ordersCount}
                            </div>
                          </div>
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
    </div>
  );
};

export default TableStatus;