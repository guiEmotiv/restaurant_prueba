import { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign,
  Users,
  ShoppingCart,
  Download,
  Calendar,
  PieChart,
  Award,
  CreditCard,
  AlertCircle,
  TrendingUp,
  Percent
} from 'lucide-react';
import { apiService } from '../services/api';

const DashboardFinanciero = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  
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

  const handleDownloadExcel = async () => {
    try {
      setDownloading(true);
      
      // Verificar que hay datos para exportar
      if (!dashboardData || dashboardData.summary?.total_orders === 0) {
        alert('No hay datos para exportar en la fecha seleccionada');
        return;
      }
      
      await apiService.dashboard.downloadExcel(selectedDate);
      
      // Feedback positivo (opcional - el archivo se descarga automáticamente)
      // setTimeout(() => alert('✅ Excel descargado exitosamente'), 500);
      
    } catch (error) {
      console.error('Error downloading Excel:', error);
      
      // Mensaje de error más específico
      if (error.response?.status === 404) {
        alert('❌ No se encontraron datos para exportar en esta fecha');
      } else if (error.response?.status === 500) {
        alert('❌ Error interno del servidor al generar Excel');
      } else if (error.code === 'NETWORK_ERROR') {
        alert('❌ Error de conexión. Verifica tu internet.');
      } else {
        alert('❌ Error al descargar Excel. Inténtalo de nuevo.');
      }
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos financieros...</p>
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

  const { summary, category_breakdown, top_dishes, waiter_performance, zone_performance, payment_methods, item_status_breakdown } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50 -m-4 sm:-m-6 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
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
                onClick={handleDownloadExcel}
                disabled={downloading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                title="Descargar reporte detallado completo"
              >
                <Download className="h-4 w-4" />
                {downloading ? 'Descargando...' : 'Excel'}
              </button>
            </div>
          </div>
          
          {/* Métricas financieras principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-green-600 p-6 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Ingresos Totales</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_revenue)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-200" />
              </div>
            </div>
            
            <div className="bg-blue-600 p-6 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Ventas Realizadas</p>
                  <p className="text-2xl font-bold">{summary.total_orders}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-blue-200" />
              </div>
            </div>
            
            <div className="bg-purple-600 p-6 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Ticket Promedio</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.average_ticket)}</p>
                </div>
                <Users className="h-8 w-8 text-purple-200" />
              </div>
            </div>
            
            <div className="bg-orange-600 p-6 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Margen Estimado</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(summary.total_revenue * 0.35)}
                  </p>
                  <p className="text-xs text-orange-200">35% aprox.</p>
                </div>
                <Percent className="h-8 w-8 text-orange-200" />
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
              Ingresos por Categoría
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
                        <p className="text-sm text-gray-500">{Math.round(category.percentage)}%</p>
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
                <div className="text-center text-gray-500 py-8">
                  <PieChart className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p>Sin datos de categorías para esta fecha</p>
                </div>
              )}
            </div>
          </div>

          {/* Top platos */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="h-6 w-6 text-yellow-500" />
              Productos Más Vendidos
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
                <div className="text-center text-gray-500 py-8">
                  <Award className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p>Sin datos de productos para esta fecha</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Performance financiera */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Ventas por mesero */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Ventas por Mesero
            </h3>
            
            <div className="space-y-3">
              {waiter_performance.map((waiter, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">Mesero {waiter.waiter}</h4>
                    <span className="text-lg font-bold text-gray-900">{formatCurrency(waiter.revenue)}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <p className="text-gray-500">Ventas</p>
                      <p className="font-medium">{waiter.orders}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Ticket Prom.</p>
                      <p className="font-medium">{formatCurrency(waiter.average_ticket)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">% del Total</p>
                      <p className="font-medium">{Math.round((waiter.revenue / summary.total_revenue) * 100)}%</p>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(waiter.revenue / summary.total_revenue) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              {waiter_performance.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  <TrendingUp className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">Sin datos de ventas por mesero</p>
                </div>
              )}
            </div>
          </div>

          {/* Productos menos vendidos */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-500" />
              Productos Menos Vendidos
            </h3>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {top_dishes
                .slice()
                .sort((a, b) => a.quantity - b.quantity)
                .slice(0, 5)
                .map((dish, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm bg-red-400">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{dish.name}</p>
                      <p className="text-sm text-gray-500">{dish.category} • Solo {dish.quantity} vendidos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(dish.revenue)}</p>
                    <p className="text-xs text-red-600">Bajo rendimiento</p>
                  </div>
                </div>
              ))}
              
              {top_dishes.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  <TrendingUp className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">Sin datos de productos para esta fecha</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Estado de Items y Métodos de pago */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Estado de Items */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5 text-blue-500" />
              Estado de Items
            </h3>
            
            <div className="space-y-4">
              {item_status_breakdown && item_status_breakdown.map((status, index) => {
                const statusNames = {
                  'CREATED': 'Creados',
                  'PREPARING': 'En Preparación',
                  'SERVED': 'Entregados',
                  'PAID': 'Pagados'
                };
                
                const statusColors = {
                  'CREATED': 'bg-yellow-500',
                  'PREPARING': 'bg-blue-500',
                  'SERVED': 'bg-indigo-500', 
                  'PAID': 'bg-green-500'
                };
                
                const bgColor = statusColors[status.status] || 'bg-gray-500';
                
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded ${bgColor}`}></div>
                        <span className="font-medium text-gray-900">{statusNames[status.status] || status.status}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{status.count} items</p>
                        <p className="text-sm text-gray-500">{formatCurrency(status.amount)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`${bgColor} h-3 rounded-full transition-all duration-500`}
                        style={{ width: `${status.count_percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              
              {(!item_status_breakdown || item_status_breakdown.length === 0) && (
                <div className="text-center text-gray-500 py-8">
                  <PieChart className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p>Sin datos de estados para esta fecha</p>
                </div>
              )}
            </div>
          </div>

          {/* Métodos de pago */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-500" />
              Distribución de Métodos de Pago
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {payment_methods.map((method, index) => {
              const methodNames = {
                'CASH': 'Efectivo',
                'CARD': 'Tarjeta',
                'TRANSFER': 'Transferencia',
                'YAPE_PLIN': 'Yape/Plin'
              };
              
              const methodColors = {
                'CASH': 'bg-green-100 text-green-800 border-green-200',
                'CARD': 'bg-blue-100 text-blue-800 border-blue-200',
                'TRANSFER': 'bg-purple-100 text-purple-800 border-purple-200',
                'YAPE_PLIN': 'bg-orange-100 text-orange-800 border-orange-200'
              };
              
              return (
                <div key={index} className={`p-4 rounded-lg border-2 ${methodColors[method.method] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                  <h4 className="font-medium mb-2">{methodNames[method.method] || method.method}</h4>
                  <p className="text-2xl font-bold mb-1">{formatCurrency(method.amount)}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span>{Math.round(method.percentage)}%</span>
                    <span className="opacity-75">{method.transaction_count || 0} trans.</span>
                  </div>
                </div>
              );
            })}
            
            {payment_methods.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-8">
                <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p>Sin datos de métodos de pago para esta fecha</p>
              </div>
            )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardFinanciero;