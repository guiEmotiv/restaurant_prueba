import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Users,
  ShoppingCart,
  AlertCircle,
  CheckCircle,
  PieChart,
  Activity,
  ArrowUp,
  ArrowDown,
  Target,
  Award,
  Package,
  UserCheck,
  Settings,
  X,
  Save,
  ChefHat,
  Utensils,
  Timer,
  MapPin,
  Crown,
  TrendingUp as Trend,
  Star,
  Calendar
} from 'lucide-react';
import { apiService } from '../services/api';

const Dashboard = () => {
  console.log('📊 Dashboard de Operación Diaria - Iniciando...');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Usar zona horaria de Perú para la fecha por defecto
  const getPeruDate = () => {
    const now = new Date();
    const peruTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Lima"}));
    return peruTime.toISOString().split('T')[0];
  };
  
  const [selectedDate, setSelectedDate] = useState(getPeruDate());
  const [dashboardData, setDashboardData] = useState(null);

  // Función para cargar datos del dashboard usando el nuevo endpoint
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📅 Cargando datos del dashboard para:', selectedDate);

      // Usar el nuevo endpoint del backend
      const data = await apiService.payments.getDashboardData(selectedDate);
      
      console.log('✅ Datos recibidos del backend:', data);
      setDashboardData(data);

    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount) || amount === 0) return 'S/ 0.00';
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const formatPercentage = (value) => {
    if (!value || isNaN(value)) return '0.0%';
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-white rounded-xl"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-white rounded-xl"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="h-96 bg-white rounded-xl"></div>
              <div className="h-96 bg-white rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
            <button 
              onClick={loadDashboardData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              <p>No hay datos disponibles para mostrar</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { summary, revenue_by_category, top_dishes, waiter_performance, zone_performance, top_tables, payment_methods } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-100 -m-4 sm:-m-6 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header con resumen ejecutivo */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start justify-between mb-6 gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard Operacional</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">Métricas del día - Solo pedidos pagados</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  max={getPeruDate()}
                />
              </div>
              <button
                onClick={loadDashboardData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Actualizar
              </button>
            </div>
          </div>

          {/* Resumen del día - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900">
                {formatCurrency(summary.total_revenue)}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">Ingresos del día</p>
              <p className="text-xs text-gray-500 mt-1">{summary.total_orders} órdenes</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900">
                {formatCurrency(summary.average_ticket)}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">Ticket promedio</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900">
                {Math.round(summary.customer_count)}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">Clientes atendidos</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <Timer className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900">
                {summary.average_service_time > 0 ? `${summary.average_service_time}min` : '-'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">Tiempo promedio</p>
            </div>
          </div>
        </div>

        {/* Distribución de ingresos y top platos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Distribución por categorías */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
              <span className="text-sm sm:text-base">Ingresos por Categoría</span>
            </h2>
            
            <div className="space-y-3 sm:space-y-4">
              {revenue_by_category.length > 0 ? revenue_by_category.map((category, index) => {
                const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-red-500', 'bg-indigo-500'];
                const bgColor = colors[index % colors.length];
                
                return (
                  <div key={index} className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded ${bgColor}`}></div>
                        <span className="font-medium text-gray-700 text-sm sm:text-base">{category.category}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-sm sm:text-base">{formatCurrency(category.revenue)}</p>
                        <p className="text-xs sm:text-sm text-gray-500">{formatPercentage(category.percentage)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                      <div 
                        className={`${bgColor} h-2 sm:h-3 rounded-full transition-all duration-500`}
                        style={{ width: `${category.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Sin datos</p>
                </div>
              )}
            </div>
          </div>

          {/* Top platos más vendidos */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
              <span className="text-sm sm:text-base">Top 10 Platos</span>
            </h2>
            
            <div className="space-y-2 sm:space-y-3 max-h-80 overflow-y-auto">
              {top_dishes.length > 0 ? top_dishes.map((dish, index) => (
                <div key={index} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm sm:text-base ${
                      index === 0 ? 'bg-yellow-500' : 
                      index === 1 ? 'bg-gray-400' : 
                      index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm sm:text-base">{dish.name}</p>
                      <p className="text-xs sm:text-sm text-gray-500">{dish.category} • {dish.quantity} unidades</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-sm sm:text-base">{formatCurrency(dish.revenue)}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(dish.price)} c/u</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Sin ventas</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Análisis de Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Rendimiento por Meseros */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-500" />
              <span className="text-sm sm:text-base">Top Meseros</span>
            </h3>
            <div className="space-y-3">
              {waiter_performance.map((waiter, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm ${
                      index === 0 ? 'bg-blue-600' : 'bg-gray-400'
                    }`}>
                      {index === 0 ? <Crown className="h-4 w-4" /> : index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Mesero {waiter.waiter}</p>
                      <p className="text-xs text-gray-500">{waiter.orders} órdenes</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-sm">{formatCurrency(waiter.revenue)}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(waiter.avg_ticket)} promedio</p>
                  </div>
                </div>
              ))}
              {waiter_performance.length === 0 && (
                <p className="text-center text-gray-500 py-4">Sin datos</p>
              )}
            </div>
          </div>

          {/* Rendimiento por Zonas */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-500" />
              <span className="text-sm sm:text-base">Análisis por Zonas</span>
            </h3>
            <div className="space-y-3">
              {zone_performance.map((zone, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center font-bold text-white text-sm">
                      {zone.zone.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{zone.zone}</p>
                      <p className="text-xs text-gray-500">{zone.tables_used} mesas activas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-sm">{formatCurrency(zone.revenue)}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(zone.avg_per_table)} por mesa</p>
                  </div>
                </div>
              ))}
              {zone_performance.length === 0 && (
                <p className="text-center text-gray-500 py-4">Sin datos</p>
              )}
            </div>
          </div>

          {/* Mesas Más Productivas */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Utensils className="h-5 w-5 text-purple-500" />
              <span className="text-sm sm:text-base">Mesas Top</span>
            </h3>
            <div className="space-y-3">
              {top_tables.map((table, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm ${
                      index === 0 ? 'bg-purple-600' : 
                      index === 1 ? 'bg-purple-400' : 
                      index === 2 ? 'bg-purple-300' : 'bg-gray-400'
                    }`}>
                      {index === 0 ? <Star className="h-4 w-4" /> : table.table}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Mesa {table.table}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-sm">{formatCurrency(table.revenue)}</p>
                  </div>
                </div>
              ))}
              {top_tables.length === 0 && (
                <p className="text-center text-gray-500 py-4">Sin datos</p>
              )}
            </div>
          </div>
        </div>

        {/* Métricas adicionales */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Métodos de pago */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="text-sm sm:text-base">Métodos de Pago</span>
            </h3>
            <div className="space-y-3">
              {payment_methods.map((method, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-700 text-sm sm:text-base">
                    {method.method === 'CASH' ? 'Efectivo' : 
                     method.method === 'CARD' ? 'Tarjeta' : 
                     method.method === 'TRANSFER' ? 'Transferencia' : 
                     method.method === 'YAPE_PLIN' ? 'Yape/Plin' : method.method}
                  </span>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-sm sm:text-base">{formatCurrency(method.amount)}</p>
                    <p className="text-xs text-gray-500">{formatPercentage(method.percentage)}</p>
                  </div>
                </div>
              ))}
              {payment_methods.length === 0 && (
                <p className="text-center text-gray-500 py-4">Sin pagos registrados</p>
              )}
            </div>
          </div>

          {/* Estado operacional */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <span className="text-sm sm:text-base">Estado Actual</span>
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium text-blue-900">Órdenes Activas</span>
                <span className="text-lg font-bold text-blue-600">{summary.active_orders}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <span className="text-sm font-medium text-purple-900">Mesas Ocupadas</span>
                <span className="text-lg font-bold text-purple-600">{summary.active_tables}</span>
              </div>
            </div>
          </div>

          {/* Resumen rápido */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm sm:text-base">Resumen</span>
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Órdenes pagadas</span>
                <span className="font-bold text-gray-900">{summary.total_orders}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Ticket promedio</span>
                <span className="font-bold text-gray-900">{formatCurrency(summary.average_ticket)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total del día</span>
                <span className="font-bold text-green-600">{formatCurrency(summary.total_revenue)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;