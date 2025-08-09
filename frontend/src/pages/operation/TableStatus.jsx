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
      {/* Header fijo estilo sidebar panel */}
      <div className="p-4 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Estado de Mesas</h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{filteredTables.length} mesas</span>
          </div>
        </div>

        {/* Filtros */}
        <div className="space-y-3">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar mesa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtro por zona */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-600" />
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las zonas</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Leyenda de estados */}
          <div className="flex items-center justify-center gap-4 text-xs bg-gray-50 rounded-lg p-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-700">Disponible</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-gray-700">Ocupada</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
              <span className="text-gray-700">Múltiples</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        {Object.keys(groupedTables).length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Table className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay mesas</h3>
              <p className="text-gray-500">No se encontraron mesas que coincidan con los filtros</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTables).map(([zoneName, zoneTables]) => (
              <div key={zoneName}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <h3 className="text-lg font-semibold text-gray-800">{zoneName}</h3>
                  <span className="text-sm text-gray-500">({zoneTables.length} mesas)</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {zoneTables.map((table) => {
                    const tableStatus = getTableStatus(table);
                    const StatusIcon = tableStatus.status === 'available' ? Plus : ShoppingCart;
                    
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleTableClick(table)}
                        className={`group relative p-4 rounded-xl border-2 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 ${
                          tableStatus.status === 'available' 
                            ? 'border-green-200 bg-gradient-to-br from-green-50 to-green-100 hover:border-green-300 hover:shadow-green-200/50' 
                            : 'border-red-200 bg-gradient-to-br from-red-50 to-red-100 hover:border-red-300 hover:shadow-red-200/50'
                        }`}
                      >
                        {/* Indicador de estado */}
                        <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${
                          tableStatus.status === 'available' ? 'bg-green-400' : 'bg-red-400'
                        }`}></div>
                        
                        {/* Contenido principal */}
                        <div className="flex flex-col items-center text-center space-y-2">
                          <div className={`flex items-center justify-center w-12 h-12 rounded-full ${
                            tableStatus.status === 'available' 
                              ? 'bg-green-500 group-hover:bg-green-600' 
                              : 'bg-red-500 group-hover:bg-red-600'
                          } transition-colors duration-200`}>
                            <StatusIcon className="h-6 w-6 text-white" />
                          </div>
                          
                          <div>
                            <div className="text-lg font-bold text-gray-900">
                              Mesa {table.table_number}
                            </div>
                            <div className="text-xs text-gray-600 flex items-center justify-center gap-1 mt-1">
                              <Users className="h-3 w-3" />
                              <span>{table.capacity || 4} personas</span>
                            </div>
                          </div>
                          
                          {/* Estado visual */}
                          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                            tableStatus.status === 'available'
                              ? 'bg-green-200 text-green-800'
                              : 'bg-red-200 text-red-800'
                          }`}>
                            {tableStatus.status === 'available' ? 'Disponible' : 'Ocupada'}
                          </div>
                        </div>
                        
                        {/* Badge de múltiples cuentas */}
                        {tableStatus.ordersCount > 1 && (
                          <div className="absolute -top-2 -right-2">
                            <div className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold animate-pulse">
                              {tableStatus.ordersCount}
                            </div>
                          </div>
                        )}
                        
                        {/* Tooltip al hover */}
                        <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap z-10 pointer-events-none">
                          {tableStatus.status === 'available' 
                            ? 'Click para crear pedido' 
                            : tableStatus.ordersCount > 1 
                              ? `${tableStatus.ordersCount} cuentas activas`
                              : 'Click para ver pedido'
                          }
                          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                        </div>
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