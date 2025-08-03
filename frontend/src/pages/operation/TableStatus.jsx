import { useState, useEffect } from 'react';
import { Table, Users, Clock, CheckCircle, AlertCircle, Plus, ShoppingCart } from 'lucide-react';
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
    <div className="space-y-4">
      {/* Header compacto */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              <Table className="h-5 w-5" />
              Estado de Mesas
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">Selecciona una mesa para crear pedido o ver pedidos activos</p>
          </div>
          
          {/* Filtro por zona y leyenda */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todas las zonas</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
            
            {/* Leyenda compacta */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-600 hidden sm:inline">Disponible</span>
                <span className="text-gray-600 sm:hidden">Disp.</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-gray-600 hidden sm:inline">Ocupada</span>
                <span className="text-gray-600 sm:hidden">Ocup.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mesas agrupadas por zona - Diseño más compacto */}
      {Object.keys(groupedTables).length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <Table className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay mesas</h3>
          <p className="text-gray-600">No se encontraron mesas para mostrar</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-4">
          {Object.entries(groupedTables).map(([zoneName, zoneTables]) => (
            <div key={zoneName} className="mb-6 last:mb-0">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                {zoneName}
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {zoneTables.map((table) => {
                  const tableStatus = getTableStatus(table);
                  const StatusIcon = tableStatus.status === 'available' ? Plus : ShoppingCart;
                  
                  return (
                    <button
                      key={table.id}
                      onClick={() => handleTableClick(table)}
                      className={`group relative p-3 rounded-lg border-2 transition-all duration-200 hover:shadow-md hover:scale-105 ${
                        tableStatus.status === 'available' 
                          ? 'border-green-300 bg-green-50 hover:bg-green-100 hover:border-green-400' 
                          : 'border-red-300 bg-red-50 hover:bg-red-100 hover:border-red-400'
                      }`}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className={`flex items-center justify-center w-8 h-8 mb-1 rounded-full ${
                          tableStatus.status === 'available' 
                            ? 'bg-green-500 group-hover:bg-green-600' 
                            : 'bg-red-500 group-hover:bg-red-600'
                        }`}>
                          <StatusIcon className="h-4 w-4 text-white" />
                        </div>
                        
                        <div className="text-sm font-bold text-gray-900 mb-1">
                          Mesa {table.table_number}
                        </div>
                        
                        {table.capacity && (
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Users className="h-3 w-3" />
                            <span>{table.capacity}</span>
                          </div>
                        )}
                        
                        {tableStatus.ordersCount > 0 && (
                          <div className="absolute -top-1 -right-1">
                            <div className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                              {tableStatus.ordersCount}
                            </div>
                          </div>
                        )}
                        
                        {/* Hover text */}
                        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          {tableStatus.status === 'available' ? 'Crear pedido' : `Ver ${tableStatus.ordersCount} pedido(s)`}
                        </div>
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
  );
};

export default TableStatus;