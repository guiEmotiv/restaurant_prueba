import { useState, useEffect, useCallback } from 'react';
import { 
  Timer,
  Calendar,
  UserCheck,
  MapPin,
  Utensils,
  Activity,
  AlertCircle,
  Clock,
  TrendingUp,
  Users
} from 'lucide-react';
import { apiService } from '../services/api';

const DashboardOperativo = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const getPeruDate = () => {
    const now = new Date();
    const peruTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Lima"}));
    return peruTime.toISOString().split('T')[0];
  };
  
  const [selectedDate, setSelectedDate] = useState(getPeruDate());
  const [dashboardData, setDashboardData] = useState(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await apiService.dashboard.getReport(selectedDate);
      setDashboardData(data);

    } catch (error) {
      console.error('Error loading dashboard:', error);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos operativos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={loadDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-600">No hay datos disponibles</p>
        </div>
      </div>
    );
  }

  const { summary, waiter_performance = [], zone_performance = [], top_tables = [] } = dashboardData || {};
  
  // Calculate max values safely to avoid minification issues
  const maxWaiterOrders = waiter_performance.length > 0 
    ? Math.max.apply(null, waiter_performance.map(w => w.orders || 0))
    : 1;

  return (
    <div className="min-h-screen bg-gray-50 -m-4 sm:-m-6 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                max={getPeruDate()}
              />
            </div>
          </div>
          
          {/* Métricas operativas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-orange-600 p-6 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Tiempo Promedio</p>
                  <p className="text-2xl font-bold">
                    {summary.average_service_time > 0 
                      ? `${Math.round(summary.average_service_time)} min` 
                      : (summary.total_orders > 0 ? 'Calculando...' : 'Sin datos')
                    }
                  </p>
                </div>
                <Timer className="h-8 w-8 text-orange-200" />
              </div>
            </div>
            
            <div className="bg-blue-600 p-6 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Órdenes Atendidas</p>
                  <p className="text-2xl font-bold">{summary.total_orders}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-200" />
              </div>
            </div>
            
            <div className="bg-purple-600 p-6 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Mesas Utilizadas</p>
                  <p className="text-2xl font-bold">
                    {zone_performance.reduce((sum, zone) => sum + zone.tables_used, 0)}
                  </p>
                </div>
                <Utensils className="h-8 w-8 text-purple-200" />
              </div>
            </div>
            
            <div className="bg-green-600 p-6 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Meseros Activos</p>
                  <p className="text-2xl font-bold">{waiter_performance.length}</p>
                </div>
                <Users className="h-8 w-8 text-green-200" />
              </div>
            </div>
          </div>
        </div>

        {/* Performance por meseros */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-blue-500" />
            Productividad por Mesero
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {waiter_performance.map((waiter, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">Mesero {waiter.waiter}</h3>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    waiter.orders >= 20 ? 'bg-green-100 text-green-800' :
                    waiter.orders >= 10 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {waiter.orders >= 20 ? 'Alto' : waiter.orders >= 10 ? 'Medio' : 'Bajo'}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Órdenes atendidas:</span>
                    <span className="font-medium">{waiter.orders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Promedio por orden:</span>
                    <span className="font-medium">
                      {waiter.orders > 0 ? Math.round(summary.average_service_time) : 0} min
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Productividad:</span>
                    <span className="font-medium">
                      {((waiter.orders / summary.total_orders) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(waiter.orders / maxWaiterOrders) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {waiter_performance.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-8">
                <UserCheck className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p>Sin datos de meseros para esta fecha</p>
              </div>
            )}
          </div>
        </div>

        {/* Performance por zonas */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-green-500" />
            Utilización por Zonas
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zone_performance.map((zone, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">{zone.zone}</h3>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Mesas utilizadas</span>
                      <span className="font-medium">{zone.tables_used}</span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Órdenes atendidas</span>
                      <span className="font-medium">{zone.orders}</span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Rotación promedio</span>
                      <span className="font-medium">
                        {zone.tables_used > 0 ? (zone.orders / zone.tables_used).toFixed(1) : 0}x
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Eficiencia</span>
                      <span className={`text-xs font-medium ${
                        zone.orders / zone.tables_used >= 3 ? 'text-green-600' :
                        zone.orders / zone.tables_used >= 2 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {zone.orders / zone.tables_used >= 3 ? 'Alta' :
                         zone.orders / zone.tables_used >= 2 ? 'Media' : 'Baja'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {zone_performance.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-8">
                <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p>Sin datos de zonas para esta fecha</p>
              </div>
            )}
          </div>
        </div>

        {/* Mesas más utilizadas */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Utensils className="h-6 w-6 text-purple-500" />
            Mesas con Mayor Rotación
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {top_tables.slice(0, 8).map((table, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                  index === 0 ? 'bg-yellow-500' : 
                  index === 1 ? 'bg-gray-400' : 
                  index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                } text-white font-bold`}>
                  {index + 1}
                </div>
                <p className="font-semibold text-gray-900">{table.table}</p>
                <p className="text-sm text-gray-600 mt-1">Alta demanda</p>
              </div>
            ))}
            
            {top_tables.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-8">
                <Utensils className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p>Sin datos de mesas para esta fecha</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardOperativo;