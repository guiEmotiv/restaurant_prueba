import { useState, useEffect } from 'react';
import { Table, Users, Clock, CheckCircle, AlertCircle, Plus, ShoppingCart, Filter, Search, MapPin, Utensils, Coffee } from 'lucide-react';
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
      // Calcular items pendientes vs totales desde orders
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
        color: 'bg-red-500',
        textColor: 'text-white',
        borderColor: 'border-red-500',
        icon: AlertCircle,
        label: 'Ocupada',
        ordersCount: table.active_orders_count || 1,
        totalItems,
        pendingItems
      };
    } else {
      return {
        status: 'available',
        color: 'bg-green-500',
        textColor: 'text-white',
        borderColor: 'border-green-500',
        icon: CheckCircle,
        label: 'Disponible',
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-200 border-t-blue-600"></div>
          </div>
          <p className="text-gray-600 font-medium">Cargando mesas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header Moderno con Gradient */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white sticky top-0 z-40 shadow-lg">
        <div className="px-4 py-6">
          {/* Header Principal */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Utensils className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Mesas</h1>
                <p className="text-blue-100 text-sm">{filteredTables.length} mesas disponibles</p>
              </div>
            </div>
          </div>

          {/* Barra de Búsqueda Moderna */}
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-white/60" />
            </div>
            <input
              type="text"
              placeholder="Buscar mesa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40"
            />
          </div>

          {/* Filtros Modernos */}
          <div className="flex gap-3 mb-4">
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <option value="" className="text-gray-900">Todas las zonas</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.id} className="text-gray-900">
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Legend Moderna */}
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-400 rounded-full shadow-sm"></div>
              <span className="text-white/90 font-medium">Libre</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-rose-400 rounded-full shadow-sm"></div>
              <span className="text-white/90 font-medium">Ocupada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-400 rounded-full shadow-sm"></div>
              <span className="text-white/90 font-medium">Múltiple</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="px-4 py-6">
        {Object.keys(groupedTables).length === 0 ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Table className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay mesas</h3>
              <p className="text-gray-500">No se encontraron mesas con los filtros actuales</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTables).map(([zoneName, zoneTables]) => (
              <div key={zoneName} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                {/* Header de Zona Moderno */}
                <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{zoneName}</h3>
                      <p className="text-sm text-gray-500">{zoneTables.length} mesas disponibles</p>
                    </div>
                  </div>
                </div>
                
                {/* Grid de Mesas Moderno */}
                <div className="p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {zoneTables.map((table) => {
                      const tableStatus = getTableStatus(table);
                      const isAvailable = tableStatus.status === 'available';
                      
                      return (
                        <button
                          key={table.id}
                          onClick={() => handleTableClick(table)}
                          className={`relative group transform transition-all duration-200 hover:scale-105 active:scale-95`}
                        >
                          {/* Card Principal */}
                          <div className={`relative overflow-hidden rounded-2xl p-6 shadow-lg border-2 transition-all duration-300 ${
                            isAvailable 
                              ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 hover:border-emerald-300 hover:shadow-xl' 
                              : 'bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200 hover:border-rose-300 hover:shadow-xl'
                          }`}>
                            
                            {/* Status Indicator */}
                            <div className={`absolute top-3 right-3 w-3 h-3 rounded-full shadow-sm ${
                              isAvailable ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}></div>
                            
                            {/* Icono Principal */}
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-md ${
                              isAvailable 
                                ? 'bg-emerald-500 text-white' 
                                : 'bg-rose-500 text-white'
                            }`}>
                              {isAvailable ? (
                                <Plus className="h-6 w-6" />
                              ) : (
                                <ShoppingCart className="h-6 w-6" />
                              )}
                            </div>
                            
                            {/* Información de Mesa */}
                            <div className="text-center">
                              <div className="font-bold text-gray-900 mb-1">
                                Mesa {table.table_number}
                              </div>
                              
                              {!isAvailable ? (
                                <div className="flex items-center justify-center gap-1 text-sm text-gray-600 mb-2">
                                  <Clock className="h-4 w-4" />
                                  <span className="font-medium">{tableStatus.pendingItems || 0}/{tableStatus.totalItems || 0}</span>
                                </div>
                              ) : (
                                <div className="text-sm font-medium text-emerald-600 mb-2">
                                  Disponible
                                </div>
                              )}
                              
                              {/* Action Button */}
                              <div className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                                isAvailable 
                                  ? 'bg-emerald-500 text-white group-hover:bg-emerald-600' 
                                  : 'bg-rose-500 text-white group-hover:bg-rose-600'
                              }`}>
                                {isAvailable ? 'Nuevo Pedido' : 'Ver Pedido'}
                              </div>
                            </div>
                            
                            {/* Badge de Múltiples Pedidos */}
                            {tableStatus.ordersCount > 1 && (
                              <div className="absolute -top-2 -right-2 z-10">
                                <div className="bg-amber-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold border-3 border-white shadow-lg">
                                  {tableStatus.ordersCount}
                                </div>
                              </div>
                            )}
                            
                            {/* Shine Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Spacing Bottom for mobile navigation */}
      <div className="h-20"></div>
    </div>
  );
};

export default TableStatus;