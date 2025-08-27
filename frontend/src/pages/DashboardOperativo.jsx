import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  DollarSign,
  Users,
  ShoppingCart,
  Download,
  PieChart,
  Award,
  CreditCard,
  TrendingUp,
  Clock,
  XCircle,
  Store,
  Truck,
  FileText
} from 'lucide-react';
import { apiService } from '../services/api';
import { getPeruDate, formatCurrency, STATUS_NAMES, STATUS_COLORS, PAYMENT_METHOD_NAMES, PAYMENT_METHOD_COLORS, getCategoryColor, getRankingColor } from '../utils/dashboardUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import CustomDatePicker from '../components/CustomDatePicker';
import UnsolRecipesPieChart from '../components/UnsolRecipesPieChart';
import TopDishesBarChart from '../components/TopDishesBarChart';
import DeliveryRecipesPieChart from '../components/DeliveryRecipesPieChart';


const DashboardOperativo = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getPeruDate());
  const [dashboardData, setDashboardData] = useState(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await apiService.dashboardOperativo.getReport(selectedDate);
      setDashboardData(data);

    } catch (error) {
      setError(`Error al cargar los datos del dashboard: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Memoizar callback para descarga para evitar re-creaciones
  const handleDownloadExcel = useCallback(async () => {
    try {
      setDownloading(true);
      
      // Verificar que hay datos para exportar
      if (!dashboardData || dashboardData.summary?.total_orders === 0) {
        alert('No hay datos para exportar en la fecha seleccionada');
        return;
      }
      
      await apiService.dashboardOperativo.downloadExcel(selectedDate);
      
    } catch (error) {
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
  }, [selectedDate, dashboardData]);


  // Memoizar datos derivados para evitar re-cálculos innecesarios
  const derivedData = useMemo(() => {
    if (!dashboardData) return null;
    
    const { summary, category_breakdown, delivery_category_breakdown, top_dishes, waiter_performance, payment_methods, item_status_breakdown } = dashboardData;
    
    return {
      summary,
      category_breakdown: category_breakdown || [],
      delivery_category_breakdown: delivery_category_breakdown || [],
      top_dishes: top_dishes || [],
      waiter_performance: waiter_performance || [],
      payment_methods: payment_methods || [],
      item_status_breakdown: item_status_breakdown || [],
      unsold_recipes: dashboardData.unsold_recipes || []
    };
  }, [dashboardData]);

  // Mostrar componentes de loading/error si es necesario
  if (loading || error || !dashboardData) {
    return (
      <LoadingSpinner 
        loading={loading}
        error={error}
        onRetry={loadDashboardData}
        loadingText="Cargando datos operativos..."
        showNoData={!dashboardData}
      />
    );
  }

  const { summary, category_breakdown, delivery_category_breakdown, top_dishes, waiter_performance, payment_methods, item_status_breakdown, unsold_recipes } = derivedData;

  return (
    <div className="min-h-screen bg-gray-50 -m-4 sm:-m-6 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <CustomDatePicker
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                maxDate={getPeruDate()}
              />
              
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
          
          {/* Métricas de órdenes PAID del día */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.total_revenue)}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center text-gray-600">
                      <div className="w-4 flex justify-center">
                        <Store className="h-3 w-3" />
                      </div>
                      <span className="ml-2 flex-1">{formatCurrency(summary.restaurant_revenue || 0)} ({summary.total_revenue > 0 ? Math.round((summary.restaurant_revenue / summary.total_revenue) * 100) : 0}%)</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <div className="w-4 flex justify-center">
                        <Truck className="h-3 w-3" />
                      </div>
                      <span className="ml-2 flex-1">{formatCurrency(summary.delivery_revenue || 0)} ({summary.total_revenue > 0 ? Math.round((summary.delivery_revenue / summary.total_revenue) * 100) : 0}%)</span>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Items Vendidos</p>
                  <p className="text-2xl font-bold text-gray-900">{(summary.restaurant_items || 0) + (summary.delivery_items || 0)}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center text-gray-600">
                      <div className="w-4 flex justify-center">
                        <Store className="h-3 w-3" />
                      </div>
                      <span className="ml-2 flex-1">{summary.restaurant_items || 0} ({((summary.restaurant_items || 0) + (summary.delivery_items || 0)) > 0 ? Math.round(((summary.restaurant_items || 0) / ((summary.restaurant_items || 0) + (summary.delivery_items || 0))) * 100) : 0}%)</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <div className="w-4 flex justify-center">
                        <Truck className="h-3 w-3" />
                      </div>
                      <span className="ml-2 flex-1">{summary.delivery_items || 0} ({((summary.restaurant_items || 0) + (summary.delivery_items || 0)) > 0 ? Math.round(((summary.delivery_items || 0) / ((summary.restaurant_items || 0) + (summary.delivery_items || 0))) * 100) : 0}%)</span>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-teal-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Número de Pedidos</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.total_orders || 0}</p>
                </div>
                <div className="p-3 bg-teal-100 rounded-lg">
                  <FileText className="h-6 w-6 text-teal-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ticket Promedio</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.average_ticket)}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tiempo Promedio</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {summary.average_service_time ? (
                      summary.average_service_time >= 60 
                        ? `${Math.floor(summary.average_service_time / 60)}h ${Math.round(summary.average_service_time % 60)}m`
                        : `${Math.round(summary.average_service_time)} min`
                    ) : '0 min'}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Análisis de ventas y recetas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ventas por Categoría - Gráfico de barras */}
          <TopDishesBarChart top_dishes={top_dishes} category_breakdown={category_breakdown} />

          {/* Recetas no vendidas - Gráfica de Pie */}
          <UnsolRecipesPieChart unsold_recipes={unsold_recipes} summary={summary} />
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

          {/* Categorías Delivery - Gráfica de Pie */}
          <DeliveryRecipesPieChart delivery_category_breakdown={delivery_category_breakdown} />
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
              {item_status_breakdown.map((status, index) => {
                const bgColor = STATUS_COLORS[status.status] || 'bg-gray-500';
                
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded ${bgColor}`}></div>
                        <span className="font-medium text-gray-900">{STATUS_NAMES[status.status] || status.status}</span>
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
              
              {item_status_breakdown.length === 0 && (
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
            {payment_methods.map((method, index) => (
                <div key={index} className={`p-4 rounded-lg border-2 ${PAYMENT_METHOD_COLORS[method.method] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                  <h4 className="font-medium mb-2">{PAYMENT_METHOD_NAMES[method.method] || method.method}</h4>
                  <p className="text-2xl font-bold mb-1">{formatCurrency(method.amount)}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span>{Math.round(method.percentage)}%</span>
                    <span className="opacity-75">{method.transaction_count || 0} trans.</span>
                  </div>
                </div>
              ))}
            
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

export default DashboardOperativo;