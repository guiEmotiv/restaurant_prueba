import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  DollarSign,
  Users,
  ShoppingCart,
  Download,
  Calendar,
  PieChart,
  Award,
  CreditCard,
  TrendingUp,
  Clock,
  XCircle
} from 'lucide-react';
import { apiService } from '../services/api';
import { getPeruDate, formatCurrency, STATUS_NAMES, STATUS_COLORS, PAYMENT_METHOD_NAMES, PAYMENT_METHOD_COLORS, getCategoryColor, getRankingColor } from '../utils/dashboardUtils';
import LoadingSpinner from '../components/LoadingSpinner';

// Colores para las categorías - consistentes con dashboard financiero
const getCategoryColorHex = (index) => {
  const colorMap = {
    'bg-blue-500': '#3b82f6',
    'bg-green-500': '#22c55e', 
    'bg-yellow-500': '#eab308',
    'bg-purple-500': '#8b5cf6',
    'bg-red-500': '#ef4444'
  };
  
  const bgClass = getCategoryColor(index);
  return colorMap[bgClass] || '#6b7280'; // gray-500 como fallback
};

// Componente para la gráfica de pie de recetas no vendidas
const UnsolRecipesPieChart = ({ unsold_recipes }) => {
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  // Agrupar recetas por categoría
  const groupedData = useMemo(() => {
    const groups = {};
    unsold_recipes.forEach(recipe => {
      const category = recipe.category || 'Sin categoría';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(recipe);
    });
    
    return Object.entries(groups).map(([category, recipes], index) => ({
      category,
      count: recipes.length,
      recipes: recipes.sort((a, b) => a.name.localeCompare(b.name)),
      color: getCategoryColorHex(index)
    })).sort((a, b) => b.count - a.count);
  }, [unsold_recipes]);
  
  const total = unsold_recipes.length;
  
  
  if (total === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-green-500" />
          Recetas No Vendidas
        </h3>
        <div className="text-center text-green-500 py-8">
          <Award className="h-16 w-16 text-green-300 mx-auto mb-4" />
          <p className="text-lg font-medium">¡Excelente!</p>
          <p className="text-sm">Todas las recetas fueron vendidas</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <XCircle className="h-5 w-5 text-red-500" />
        Recetas No Vendidas ({total})
      </h3>
      
      <div className="space-y-4">
        {/* Gráfica de Barras */}
        <div className="h-80">
          <div className="h-64 flex">
            {/* Y-axis Scale */}
            <div className="w-12 flex flex-col justify-between py-4 text-xs text-gray-500">
              {(() => {
                const maxCount = Math.max(...groupedData.map(cat => cat.count));
                const scale = [maxCount, Math.floor(maxCount * 0.75), Math.floor(maxCount * 0.5), Math.floor(maxCount * 0.25), 0];
                return scale.map((value, index) => (
                  <div key={index} className="text-right pr-2">
                    {value}
                  </div>
                ));
              })()}
            </div>
            
            {/* Chart Area */}
            <div className="flex-1 relative">
              {/* Bars Container */}
              <div className="h-full flex items-end justify-around px-4 relative">
                {groupedData.map((category, index) => {
                  const maxCount = Math.max(...groupedData.map(cat => cat.count));
                  const height = maxCount > 0 ? (category.count / maxCount) * 100 : 0; // Alto proporcional al máximo
                  const absoluteHeight = maxCount > 0 ? (category.count / maxCount) * 240 : 0; // 240px es la altura del área de chart (h-64 = 256px - padding)
                  
                  return (
                    <div key={index} className="flex flex-col items-center justify-end h-full" style={{ width: `${100 / groupedData.length}%`, maxWidth: '120px' }}>
                      {/* Bar */}
                      <div 
                        className="w-full max-w-16 rounded-t transition-all duration-300 hover:opacity-80 flex items-end justify-center cursor-pointer"
                        style={{ 
                          height: `${absoluteHeight}px`,
                          backgroundColor: category.color,
                          minHeight: category.count > 0 ? '8px' : '0px'
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipPosition({
                            x: rect.left + rect.width / 2,
                            y: rect.top
                          });
                          setHoveredSegment({
                            ...category,
                            percentage: (category.count / total) * 100
                          });
                        }}
                        onMouseLeave={() => {
                          setHoveredSegment(null);
                        }}
                      >
                        {/* Value label inside bar */}
                        {absoluteHeight > 20 && (
                          <span className="text-xs font-bold text-white mb-2 drop-shadow-sm">
                            {category.count}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* X-axis (categories) */}
          <div className="h-16 flex items-center pl-12">
            <div className="flex-1 flex justify-around">
              {groupedData.map((category, index) => (
                <div 
                  key={index} 
                  className="text-xs text-gray-600 text-center cursor-pointer hover:text-gray-900 transition-colors"
                  style={{ width: `${100 / groupedData.length}%`, maxWidth: '120px' }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipPosition({
                      x: rect.left + rect.width / 2,
                      y: rect.top - 10
                    });
                    setHoveredSegment({
                      ...category,
                      percentage: (category.count / total) * 100
                    });
                  }}
                  onMouseLeave={() => {
                    setHoveredSegment(null);
                  }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="truncate">{category.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Tooltip */}
      {hoveredSegment && (
        <div
          className="fixed z-50 bg-white border-2 border-gray-200 rounded-lg shadow-xl p-4 w-96 pointer-events-none"
          style={{
            left: tooltipPosition.x + 10,
            top: Math.max(10, tooltipPosition.y - 200),
            transform: tooltipPosition.x > window.innerWidth - 400 ? 'translateX(-100%)' : 'none',
            maxHeight: 'calc(100vh - 20px)',
            overflowY: 'auto'
          }}
        >
          <div className="flex items-center gap-2 mb-3 pb-2 border-b">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: hoveredSegment.color }}
            />
            <div>
              <h4 className="font-semibold text-gray-900">{hoveredSegment.category}</h4>
              <p className="text-xs text-gray-500">
                {hoveredSegment.recipes.filter(r => r && r.name).length} recetas válidas ({hoveredSegment.percentage.toFixed(1)}%)
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            {hoveredSegment.recipes && hoveredSegment.recipes.length > 0 ? (
              <div className="space-y-1">
                {hoveredSegment.recipes
                  .filter(recipe => recipe && recipe.name)
                  .map((recipe, index) => (
                    <div key={index} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-gray-800 flex-1 mr-2" title={recipe.name}>
                        {recipe.name}
                      </span>
                      <span className="text-gray-600 text-xs">
                        {recipe.price ? formatCurrency(recipe.price) : 'S/ 0.00'}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm text-gray-500 italic">Sin recetas</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

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
      
      const data = await apiService.dashboard.getReport(selectedDate);
      setDashboardData(data);

    } catch (error) {
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


  // Memoizar datos derivados para evitar re-cálculos innecesarios
  const derivedData = useMemo(() => {
    if (!dashboardData) return null;
    
    const { summary, category_breakdown, top_dishes, waiter_performance, payment_methods, item_status_breakdown } = dashboardData;
    
    return {
      summary,
      category_breakdown: category_breakdown || [],
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

  const { summary, category_breakdown, top_dishes, waiter_performance, payment_methods, item_status_breakdown, unsold_recipes } = derivedData;

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
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.total_revenue)}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ventas Realizadas</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.total_orders}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
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
                    {summary.average_service_time ? `${Math.round(summary.average_service_time)}` : '0'}
                  </p>
                  <p className="text-xs text-gray-500">minutos</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
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
                const bgColor = getCategoryColor(index);
                
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
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm ${getRankingColor(index)}`}>
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

          {/* Recetas no vendidas - Gráfica de Pie */}
          <UnsolRecipesPieChart unsold_recipes={unsold_recipes} />
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