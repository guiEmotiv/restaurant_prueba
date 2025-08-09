import { useState, useEffect } from 'react';
import { Search, Filter, MapPin, Clock, Users, ShoppingBag, ChevronRight, Star } from 'lucide-react';
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
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

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
    
    const tableStatus = getTableStatus(table);
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'available' && tableStatus.status === 'available') ||
      (filterStatus === 'occupied' && tableStatus.status === 'occupied');
    
    return matchesZone && matchesSearch && matchesStatus;
  });

  const stats = {
    total: tables.length,
    available: tables.filter(t => !t.has_active_orders).length,
    occupied: tables.filter(t => t.has_active_orders).length
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mesas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header E-commerce Style */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mesas</h1>
              <p className="text-sm text-gray-600">Gestiona los pedidos del restaurante</p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="relative p-2 bg-blue-50 text-blue-600 rounded-lg"
            >
              <Filter className="h-5 w-5" />
              {(selectedZone || filterStatus !== 'all') && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
              )}
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar mesa o zona..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-600">Total</div>
            </div>
            <div className="bg-green-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.available}</div>
              <div className="text-xs text-green-700">Disponibles</div>
            </div>
            <div className="bg-orange-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.occupied}</div>
              <div className="text-xs text-orange-700">Ocupadas</div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas las zonas</option>
                  {zones.map(zone => (
                    <option key={zone.id} value={zone.id}>{zone.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      filterStatus === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    onClick={() => setFilterStatus('available')}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      filterStatus === 'available'
                        ? 'bg-green-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700'
                    }`}
                  >
                    Libres
                  </button>
                  <button
                    onClick={() => setFilterStatus('occupied')}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      filterStatus === 'occupied'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700'
                    }`}
                  >
                    Ocupadas
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tables Grid E-commerce Style */}
      <div className="px-4 py-6">
        {filteredTables.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron mesas</h3>
            <p className="text-gray-600">Intenta ajustar los filtros de búsqueda</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredTables.map((table) => {
              const tableStatus = getTableStatus(table);
              const isAvailable = tableStatus.status === 'available';
              
              return (
                <button
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all transform active:scale-[0.98] ${
                    isAvailable 
                      ? 'bg-white border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg' 
                      : 'bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 hover:border-orange-400 hover:shadow-lg'
                  }`}
                >
                  {/* Status Badge */}
                  <div className="absolute top-4 right-4">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                      isAvailable 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {isAvailable ? 'DISPONIBLE' : 'OCUPADA'}
                    </div>
                  </div>

                  {/* Table Info */}
                  <div className="flex items-start gap-4">
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold ${
                      isAvailable
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                        : 'bg-gradient-to-br from-orange-500 to-red-500 text-white'
                    }`}>
                      {table.table_number}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">
                        Mesa {table.table_number}
                      </h3>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{getZoneName(table.zone)}</span>
                        </div>
                        
                        {!isAvailable && (
                          <>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{tableStatus.occupancyTime}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              <span>{tableStatus.ordersCount} {tableStatus.ordersCount === 1 ? 'cuenta' : 'cuentas'}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {!isAvailable && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm text-gray-600">
                                {tableStatus.pendingItems} de {tableStatus.totalItems} items pendientes
                              </div>
                              <div className="text-lg font-bold text-gray-900">
                                {formatCurrency(tableStatus.totalAmount)}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                              style={{ 
                                width: `${tableStatus.totalItems > 0 
                                  ? ((tableStatus.totalItems - tableStatus.pendingItems) / tableStatus.totalItems) * 100 
                                  : 0}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions for Available Tables */}
                  {isAvailable && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span>Mesa recomendada</span>
                      </div>
                      <div className="flex items-center gap-2 text-blue-600 font-medium">
                        <span>Crear pedido</span>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Bottom Safe Area */}
      <div className="h-20"></div>
    </div>
  );
};

export default TableStatus;