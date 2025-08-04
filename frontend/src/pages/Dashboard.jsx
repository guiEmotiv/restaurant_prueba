import { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign,
  Users,
  ShoppingCart,
  Timer,
  Download,
  Calendar,
  PieChart,
  Award,
  UserCheck,
  MapPin,
  Utensils,
  Activity,
  CreditCard,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { apiService } from '../services/api';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  
  // Fecha por defecto (zona horaria Perú)
  const getPeruDate = () => {
    const now = new Date();
    const peruTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Lima"}));
    return peruTime.toISOString().split('T')[0];
  };
  
  const [selectedDate, setSelectedDate] = useState(getPeruDate());
  const [dashboardData, setDashboardData] = useState(null);

  // Cargar datos del dashboard
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

  // Descargar Excel
  const handleDownloadExcel = async () => {
    try {
      setDownloading(true);
      await apiService.dashboard.downloadExcel(selectedDate);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert('Error al descargar el archivo Excel');
    } finally {
      setDownloading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando dashboard...</p>
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

  const { summary, category_breakdown, top_dishes, waiter_performance, zone_performance, top_tables, payment_methods } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50 -m-4 sm:-m-6 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard de Ventas</h1>
              <p className="text-gray-600 mt-1">Reporte consolidado - Solo pedidos pagados</p>
            </div>
            
            <div className="flex items-center gap-3">
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
              
              <button
                onClick={loadDashboardData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              
              <button
                onClick={handleDownloadExcel}
                disabled={true}
                className="px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed flex items-center gap-2"
                title="Funcionalidad Excel temporalmente deshabilitada"
              >
                <Download className="h-4 w-4" />
                Excel (Próximamente)
              </button>
            </div>
          </div>
          
          {/* Métricas principales */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Ingresos Totales</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_revenue)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-200" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Órdenes Pagadas</p>
                  <p className="text-2xl font-bold">{summary.total_orders}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-blue-200" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 p-6 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Ticket Promedio</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.average_ticket)}</p>
                </div>
                <Users className="h-8 w-8 text-purple-200" />
              </div>
            </div>
          </div>
        </div>

        {/* Análisis por categorías y top platos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Categorías */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart className="h-6 w-6 text-blue-500" />
              Ventas por Categoría
            </h2>
            
            <div className="space-y-4">
              {category_breakdown.map((category, index) => {
                const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-red-500'];
                const bgColor = colors[index % colors.length];
                
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded ${bgColor}`}></div>
                        <span className="font-medium text-gray-900">{category.category}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(category.revenue)}</p>
                        <p className="text-sm text-gray-500">{category.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`${bgColor} h-3 rounded-full transition-all duration-500`}
                        style={{ width: `${category.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              
              {category_breakdown.length === 0 && (
                <p className="text-center text-gray-500 py-8">Sin datos de categorías</p>
              )}
            </div>
          </div>

          {/* Top platos */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="h-6 w-6 text-yellow-500" />
              Top 10 Platos
            </h2>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {top_dishes.map((dish, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm ${
                      index === 0 ? 'bg-yellow-500' : 
                      index === 1 ? 'bg-gray-400' : 
                      index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{dish.name}</p>
                      <p className="text-sm text-gray-500">{dish.category} • {dish.quantity} vendidos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(dish.revenue)}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(dish.unit_price)} c/u</p>
                  </div>
                </div>
              ))}
              
              {top_dishes.length === 0 && (
                <p className="text-center text-gray-500 py-8">Sin datos de platos</p>
              )}
            </div>
          </div>
        </div>

        {/* Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Meseros */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-500" />
              Top Meseros
            </h3>
            
            <div className="space-y-3">
              {waiter_performance.map((waiter, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Mesero {waiter.waiter}</p>
                    <p className="text-sm text-gray-500">{waiter.orders} órdenes</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(waiter.revenue)}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(waiter.average_ticket)} promedio</p>
                  </div>
                </div>
              ))}
              
              {waiter_performance.length === 0 && (
                <p className="text-center text-gray-500 py-4">Sin datos</p>
              )}
            </div>
          </div>

          {/* Zonas */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-500" />
              Performance por Zonas
            </h3>
            
            <div className="space-y-3">
              {zone_performance.map((zone, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{zone.zone}</p>
                    <p className="text-sm text-gray-500">{zone.tables_used} mesas • {zone.orders} órdenes</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(zone.revenue)}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(zone.average_per_table)} por mesa</p>
                  </div>
                </div>
              ))}
              
              {zone_performance.length === 0 && (
                <p className="text-center text-gray-500 py-4">Sin datos</p>
              )}
            </div>
          </div>

          {/* Mesas top */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Utensils className="h-5 w-5 text-purple-500" />
              Mesas Top
            </h3>
            
            <div className="space-y-3">
              {top_tables.map((table, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{table.table}</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{formatCurrency(table.revenue)}</p>
                  </div>
                </div>
              ))}
              
              {top_tables.length === 0 && (
                <p className="text-center text-gray-500 py-4">Sin datos</p>
              )}
            </div>
          </div>
        </div>

        {/* Métodos de pago */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-green-500" />
            Métodos de Pago
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {payment_methods.map((method, index) => {
              const methodNames = {
                'CASH': 'Efectivo',
                'CARD': 'Tarjeta',
                'TRANSFER': 'Transferencia',
                'YAPE_PLIN': 'Yape/Plin'
              };
              
              return (
                <div key={index} className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">{methodNames[method.method] || method.method}</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(method.amount)}</p>
                  <p className="text-sm text-gray-500">{method.percentage.toFixed(1)}%</p>
                </div>
              );
            })}
            
            {payment_methods.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-8">
                Sin datos de métodos de pago
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;