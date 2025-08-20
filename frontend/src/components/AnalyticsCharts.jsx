import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  PieChart,
  LineChart,
  Target,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Filter,
  Users,
  Clock,
  Award,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { apiService, API_BASE_URL } from '../services/api';

const AnalyticsCharts = ({ dashboardData, selectedDate, onDateChange }) => {
  const [timePeriod, setTimePeriod] = useState('monthly');
  const [analyticsData, setAnalyticsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState('production');
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [goals, setGoals] = useState({
    sales: { meta300: 300, meta500: 500 }, // Ventas en soles
    production: { meta300: 20, meta500: 50 } // Cantidad de recetas vendidas
  });

  // Colores para categorías - Definido a nivel del componente
  const categoryColors = [
    '#ef4444', // red-500
    '#f97316', // orange-500  
    '#eab308', // yellow-500
    '#22c55e', // green-500
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
  ];

  // Use dashboardData passed from parent or load real data
  useEffect(() => {
    if (dashboardData) {
      // Use the data passed from DashboardFinanciero
      setAnalyticsData([dashboardData]);
      setLoading(false);
    } else {
      // Fallback: load real data if no data passed
      loadRealTimeData();
    }
  }, [dashboardData, timePeriod, selectedDate]);
  
  const loadRealTimeData = async () => {
    setLoading(true);
    try {
      // Get the last 7 days of real data from the database
      const promises = [];
      const dates = [];
      const baseDate = new Date(selectedDate);
      
      // Generate last 7 days including selected date
      for (let i = 6; i >= 0; i--) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dates.push(dateStr);
        promises.push(apiService.dashboard.getReport(dateStr));
      }
      
      
      // Fetch all data in parallel
      const results = await Promise.all(promises.map(p => p.catch(e => null)));
      
      // Filter out failed requests and add date info
      const validData = results
        .map((data, index) => data ? { ...data, date: dates[index] } : null)
        .filter(Boolean);
      
      
      setAnalyticsData(validData);
      
    } catch (error) {
      console.error('🚨 Error loading analytics data:', error);
      setAnalyticsData([]);
    } finally {
      setLoading(false);
    }
  };

  // Clear tooltip when chart type changes
  useEffect(() => {
    setIsHovering(false);
    setHoveredSegment(null);
    setTooltipPosition({ x: 0, y: 0 });
  }, [chartType]);

  // Procesar datos para gráficas basadas en datos reales
  const chartData = useMemo(() => {
    if (!analyticsData || analyticsData.length === 0) {
      return { sales: [], production: [], customers: [] };
    }

    const formatDate = (dateStr) => {
      try {
        if (!dateStr) return 'Hoy';
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', { 
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        });
      } catch (e) {
        return dateStr || 'Hoy';
      }
    };

    // Vista VENTAS - Métrica: Total de ventas por categoría
    const salesData = analyticsData.map(data => {
      const revenue = Number(data.summary?.total_revenue || 0);
      const dishes = Array.isArray(data.top_dishes) ? data.top_dishes : [];
      
      
      // Agrupar ingresos por categorías
      const categoryBreakdown = {};
      dishes.forEach(dish => {
        const category = dish.category || 'Sin categoría';
        if (!categoryBreakdown[category]) {
          categoryBreakdown[category] = 0;
        }
        categoryBreakdown[category] += Number(dish.revenue) || 0;
      });
      
      
      return {
        date: formatDate(data.date || selectedDate),
        value: revenue,
        categoryBreakdown: categoryBreakdown
      };
    });

    // Vista PRODUCCIÓN - Métrica: Cantidad de recetas por categoría
    const productionData = analyticsData.map(data => {
      const dishes = Array.isArray(data.top_dishes) ? data.top_dishes : [];
      
      // Calcular total de recetas vendidas y agrupar por categoría
      const totalRecipes = dishes.reduce((sum, dish) => sum + (Number(dish.quantity) || 0), 0);
      
      
      // Agrupar por categorías para las barras divididas
      const categoryBreakdown = {};
      dishes.forEach(dish => {
        const category = dish.category || 'Sin categoría';
        if (!categoryBreakdown[category]) {
          categoryBreakdown[category] = 0;
        }
        categoryBreakdown[category] += Number(dish.quantity) || 0;
      });
      
      
      return {
        date: formatDate(data.date || selectedDate),
        value: totalRecipes,
        categoryBreakdown: categoryBreakdown
      };
    });

    // Vista CLIENTES - Métrica simple: Platos promedio por pedido
    const customersData = analyticsData.map(data => {
      const totalOrders = Number(data.summary?.total_orders || 0);
      const dishes = Array.isArray(data.top_dishes) ? data.top_dishes : [];
      
      // Calcular total de platos vendidos
      const totalDishes = dishes.reduce((sum, dish) => sum + (Number(dish.quantity) || 0), 0);
      
      // Promedio de platos por pedido
      const dishesPerOrder = totalOrders > 0 ? totalDishes / totalOrders : 0;
      
      return {
        date: formatDate(data.date || selectedDate),
        value: Math.round(dishesPerOrder * 10) / 10
      };
    });

    return { sales: salesData, production: productionData, customers: customersData };
  }, [analyticsData, selectedDate, timePeriod]);

  // Función para generar recomendaciones
  const generateRecommendations = (data, revenueGrowth, orderGrowth) => {
    if (!data || !data.summary) return [];
    
    const recommendations = [];
    
    try {
      // Análisis de ventas
      if (revenueGrowth < -10) {
        recommendations.push({
          type: 'warning',
          category: 'Ventas',
          title: 'Ingresos en declive',
          message: 'Los ingresos han bajado más del 10%. Considera promociones o revisar la calidad del servicio.',
          action: 'Implementar estrategia de recuperación'
        });
      } else if (revenueGrowth > 20) {
        recommendations.push({
          type: 'success',
          category: 'Ventas',
          title: 'Excelente crecimiento',
          message: 'Los ingresos han crecido más del 20%. Mantén la estrategia actual.',
          action: 'Optimizar operaciones para sostener crecimiento'
        });
      }

      // Análisis de producción
      const avgServiceTime = Number(data.summary?.average_service_time || 0);
      if (avgServiceTime > 45) {
        recommendations.push({
          type: 'warning',
          category: 'Producción',
          title: 'Tiempo de servicio alto',
          message: 'El tiempo promedio de servicio es mayor a 45 minutos.',
          action: 'Revisar procesos de cocina y optimizar flujo de trabajo'
        });
      } else if (avgServiceTime > 0 && avgServiceTime < 20) {
        recommendations.push({
          type: 'success',
          category: 'Producción',
          title: 'Excelente tiempo de servicio',
          message: `Tiempo promedio de ${avgServiceTime.toFixed(0)} minutos es muy eficiente.`,
          action: 'Mantener estándares actuales de servicio'
        });
      }

      // Análisis de personal
      const waiterCount = Array.isArray(data.waiter_performance) ? data.waiter_performance.length : 0;
      const totalOrders = Number(data.summary?.total_orders || 0);
      const ordersPerWaiter = waiterCount > 0 ? totalOrders / waiterCount : 0;
      
      if (ordersPerWaiter > 15) {
        recommendations.push({
          type: 'info',
          category: 'Personal',
          title: 'Alta carga de trabajo',
          message: `${ordersPerWaiter.toFixed(1)} órdenes por mesero. Considera reforzar el equipo en horarios pico.`,
          action: 'Evaluar contratación de personal adicional'
        });
      } else if (ordersPerWaiter > 0 && ordersPerWaiter < 5) {
        recommendations.push({
          type: 'info',
          category: 'Personal',
          title: 'Baja utilización del personal',
          message: `Solo ${ordersPerWaiter.toFixed(1)} órdenes por mesero. Optimizar asignación.`,
          action: 'Considerar redistribución de turnos'
        });
      }

      // Análisis de productos
      const topDish = Array.isArray(data.top_dishes) && data.top_dishes.length > 0 ? data.top_dishes[0] : null;
      if (topDish && Number(topDish.quantity || 0) > 10) {
        recommendations.push({
          type: 'success',
          category: 'Productos',
          title: 'Producto estrella identificado',
          message: `${topDish.name} es muy popular (${topDish.quantity} vendidos).`,
          action: 'Considerar crear variaciones o promociones especiales'
        });
      }

      // Recomendación general si hay ventas
      if (totalOrders > 0 && recommendations.length === 0) {
        recommendations.push({
          type: 'info',
          category: 'General',
          title: 'Operación estable',
          message: 'Las métricas están dentro de rangos normales.',
          action: 'Continuar monitoreando tendencias para identificar oportunidades'
        });
      }

    } catch (error) {
      console.error('Error generating recommendations:', error);
    }

    return recommendations.slice(0, 4); // Máximo 4 recomendaciones
  };

  // Métricas y recomendaciones
  const insights = useMemo(() => {
    if (!analyticsData || analyticsData.length === 0) {
      return {
        revenueGrowth: 0,
        orderGrowth: 0,
        recommendations: []
      };
    }

    const currentData = analyticsData[analyticsData.length - 1]; // Último día
    const currentRevenue = Number(currentData.summary?.total_revenue || 0);
    const revenues = analyticsData.map(d => Number(d.summary?.total_revenue || 0));
    const avgRevenue = revenues.reduce((sum, rev) => sum + rev, 0) / revenues.length;
    const revenueGrowth = avgRevenue > 0 ? ((currentRevenue - avgRevenue) / avgRevenue * 100) : 0;

    const currentOrders = Number(currentData.summary?.total_orders || 0);
    const orders = analyticsData.map(d => Number(d.summary?.total_orders || 0));
    const avgOrders = orders.reduce((sum, ord) => sum + ord, 0) / orders.length;
    const orderGrowth = avgOrders > 0 ? ((currentOrders - avgOrders) / avgOrders * 100) : 0;

    return {
      revenueGrowth: isNaN(revenueGrowth) ? 0 : revenueGrowth,
      orderGrowth: isNaN(orderGrowth) ? 0 : orderGrowth,
      recommendations: generateRecommendations(currentData, revenueGrowth, orderGrowth)
    };
  }, [analyticsData]);

  // Función para obtener recetas por categoría
  const getCategoryRecipes = (categoryName, viewType = 'production') => {
    if (!analyticsData || analyticsData.length === 0) return [];
    
    const currentData = analyticsData[analyticsData.length - 1];
    if (!currentData || !currentData.top_dishes) return [];
    
    return currentData.top_dishes
      .filter(dish => dish.category === categoryName)
      .sort((a, b) => {
        if (viewType === 'sales') {
          // Ordenar por revenue (mayor a menor)
          return (Number(b.revenue || 0)) - (Number(a.revenue || 0));
        } else {
          // Ordenar por quantity (mayor a menor)
          return b.quantity - a.quantity;
        }
      });
  };

  // Tooltip Component
  const Tooltip = ({ data, position }) => {
    if (!data) return null;
    
    const recipes = getCategoryRecipes(data.category, data.type);
    
    // Calculate responsive positioning
    const tooltipWidth = 320;
    const tooltipHeight = 280;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = position.x + 10;
    let top = position.y - tooltipHeight / 2;
    
    // Adjust if tooltip goes beyond viewport
    if (left + tooltipWidth > viewportWidth) {
      left = position.x - tooltipWidth - 10;
    }
    if (top < 10) {
      top = 10;
    } else if (top + tooltipHeight > viewportHeight) {
      top = viewportHeight - tooltipHeight - 10;
    }
    
    return (
      <div 
        className="fixed z-50 bg-white border-2 border-gray-200 rounded-lg shadow-xl p-4 w-80 max-h-72 overflow-y-auto"
        style={{ 
          left, 
          top,
          pointerEvents: 'none'
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b">
          <div 
            className="w-4 h-4 rounded"
            style={{ backgroundColor: data.color }}
          ></div>
          <div>
            <h4 className="font-semibold text-gray-900">{data.category}</h4>
            <p className="text-xs text-gray-500">
              {data.type === 'sales' ? `S/ ${data.value.toFixed(2)}` : `${data.value} recetas`}
            </p>
          </div>
        </div>
        
        {/* Mini Bar Chart of Recipes */}
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700 mb-2">Recetas más vendidas:</h5>
          {recipes.slice(0, 6).map((recipe, index) => {
            // Calcular el ancho basado en el tipo de vista
            let maxValue, currentValue, barWidth;
            
            if (data.type === 'sales') {
              // Para vista de ventas: usar revenue
              maxValue = Math.max(...recipes.map(r => Number(r.revenue || 0)));
              currentValue = Number(recipe.revenue || 0);
              barWidth = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
            } else {
              // Para vista de producción: usar quantity
              maxValue = recipes[0]?.quantity || 1;
              currentValue = recipe.quantity;
              barWidth = (currentValue / maxValue) * 100;
            }
            
            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate flex-1 mr-2" title={recipe.name}>
                    {recipe.name}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Solo mostrar info adicional si es necesario - eliminando duplicación */}
                  </div>
                </div>
                
                {/* Mini bar with single number */}
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="h-3 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.max(barWidth, 10)}%`,
                        backgroundColor: data.color,
                        opacity: 0.8
                      }}
                    />
                  </div>
                  {/* Single label positioned outside the bar */}
                  <span className="absolute right-0 top-0 text-xs font-medium text-gray-600 -translate-y-4">
                    {data.type === 'sales' ? `S/ ${Number(recipe.revenue || 0).toFixed(2)}` : recipe.quantity}
                  </span>
                </div>
              </div>
            );
          })}
          
          {recipes.length === 0 && (
            <p className="text-sm text-gray-500 italic text-center py-2">
              No hay recetas disponibles
            </p>
          )}
          
          {recipes.length > 6 && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              +{recipes.length - 6} recetas más...
            </p>
          )}
        </div>
      </div>
    );
  };

  const MetricCard = ({ title, value, subtitle, trend, icon: Icon, color = 'blue' }) => {
    const colorClasses = {
      blue: {
        border: 'border-blue-500',
        bg: 'bg-blue-100',
        icon: 'text-blue-600'
      },
      green: {
        border: 'border-green-500',
        bg: 'bg-green-100',
        icon: 'text-green-600'
      },
      orange: {
        border: 'border-orange-500',
        bg: 'bg-orange-100',
        icon: 'text-orange-600'
      },
      purple: {
        border: 'border-purple-500',
        bg: 'bg-purple-100',
        icon: 'text-purple-600'
      }
    };

    const styles = colorClasses[color] || colorClasses.blue;

    return (
      <div className={`bg-white rounded-xl p-6 shadow-sm border-l-4 ${styles.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          <div className={`p-3 ${styles.bg} rounded-lg`}>
            <Icon className={`h-6 w-6 ${styles.icon}`} />
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-3 flex items-center">
            {trend >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
            <span className="text-sm text-gray-500 ml-1">vs promedio</span>
          </div>
        )}
      </div>
    );
  };

  const ChartContainer = ({ title, children, className = '' }) => (
    <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );

  const SimpleBarChart = ({ data, dataKey, color = '#3B82F6', goalLines = null, chartType = 'default', categoryColors = [] }) => {
    if (!data || data.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500">No hay datos disponibles</p>
        </div>
      );
    }

    const values = data.map(d => Number(d[dataKey] || 0));
    
    // Check if all values are 0 (no real data)
    const hasRealData = values.some(value => value > 0);
    
    if (!hasRealData) {
      return (
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500">No hay datos para mostrar</p>
        </div>
      );
    }
    
    const goalValues = goalLines ? [goalLines.meta300, goalLines.meta500] : [];
    const maxValue = Math.max(...values, ...goalValues, 1);
    

    return (
      <div className="relative" style={{ height: 'auto', aspectRatio: '16/9', minHeight: '320px' }}>
        <div className="flex" style={{ height: 'calc(100% - 4rem)' }}>
          {/* Y-axis Scale */}
          <div className="w-16 flex flex-col justify-between py-4 text-xs text-gray-500">
            {[maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0].map((value, index) => (
              <div key={index} className="text-right pr-2">
                {chartType === 'sales' ? `S/ ${value.toFixed(0)}` : 
                 chartType === 'customers' ? value.toFixed(1) : 
                 value.toFixed(0)}
              </div>
            ))}
          </div>
          
          {/* Chart Area */}
          <div className="flex-1 relative">
            {/* Goal Lines - Marca de agua delgada */}
            {goalLines && (
              <>
                {/* Meta 300 Goal Line */}
                <div 
                  className="absolute w-full border-dashed border-green-300 opacity-30 z-0"
                  style={{ 
                    bottom: `${(goalLines.meta300 / maxValue) * 100}%`,
                    height: '0px',
                    borderWidth: '1px'
                  }}
                >
                  <span className="absolute right-0 -top-3 text-xs text-green-500 opacity-60 bg-white bg-opacity-80 px-1 rounded">
                    Meta 300
                  </span>
                </div>
                
                {/* Meta 500 Goal Line */}
                <div 
                  className="absolute w-full border-dashed border-orange-300 opacity-30 z-0"
                  style={{ 
                    bottom: `${(goalLines.meta500 / maxValue) * 100}%`,
                    height: '0px',
                    borderWidth: '1px'
                  }}
                >
                  <span className="absolute right-0 -top-3 text-xs text-orange-500 opacity-60 bg-white bg-opacity-80 px-1 rounded">
                    Meta 500
                  </span>
                </div>
              </>
            )}
            
            {/* Bars Container */}
            <div className="h-full flex items-end justify-around px-2 relative z-10">
              {data.map((item, index) => {
                const value = Number(item[dataKey] || 0);
                const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                const categoryBreakdown = item.categoryBreakdown || {};
                
                
                // For charts with category breakdown (production and sales)
                if ((chartType === 'production' || chartType === 'sales') && Object.keys(categoryBreakdown).length > 0) {
                  const categories = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);
                  
                  return (
                    <div key={index} className="flex flex-col items-center" style={{ width: data.length === 1 ? '120px' : '80px', height: '100%' }}>
                      {/* Stacked Bar */}
                      <div className="flex flex-col items-center h-full justify-end relative">
                        <div 
                          className="w-full rounded-t transition-all duration-300 hover:opacity-80 flex flex-col-reverse overflow-hidden relative z-20"
                          style={{ 
                            height: `${Math.max(height, 20)}%`,
                            minHeight: '80px',
                            minWidth: data.length === 1 ? '100px' : '70px'
                          }}
                        >
                          {/* Single total value label for the entire bar */}
                          {height > 15 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                              <span className="text-xs font-bold text-white text-center leading-tight px-1 drop-shadow-sm">
                                {value}
                              </span>
                            </div>
                          )}
                          
                          {/* Category segments - APILADOS VERTICALMENTE */}
                          {categories.map(([category, count], catIndex) => {
                            const segmentValue = count;
                            const segmentHeight = value > 0 ? (count / value) * 100 : 0;
                            const categoryColor = categoryColors[catIndex % categoryColors.length];
                            
                            
                            return (
                              <div
                                key={catIndex}
                                className="w-full flex items-center justify-center relative group cursor-pointer transition-all duration-200 hover:opacity-90 hover:brightness-110 z-30"
                                style={{
                                  height: `${segmentHeight}%`,
                                  backgroundColor: categoryColor,
                                  minHeight: segmentHeight > 0 ? '15px' : '0px',
                                  opacity: 1,
                                  border: '1px solid rgba(255,255,255,0.3)'
                                }}
                                onMouseEnter={(e) => {
                                  setIsHovering(true);
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTooltipPosition({ 
                                    x: rect.right, 
                                    y: rect.top + rect.height / 2 
                                  });
                                  setHoveredSegment({
                                    category,
                                    value: count,
                                    color: categoryColor,
                                    type: chartType
                                  });
                                }}
                                onMouseLeave={() => {
                                  setIsHovering(false);
                                  setHoveredSegment(null);
                                  setTooltipPosition({ x: 0, y: 0 });
                                }}
                              >
                                {/* Etiqueta de valor para cada segmento */}
                                {segmentHeight > 10 && count > 0 && (
                                  <span className="text-xs font-bold text-white drop-shadow-sm">
                                    {count}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Default single-color bar for sales and other charts
                let barColor = color;
                if (goalLines) {
                  if (value >= goalLines.meta500) {
                    barColor = '#f97316'; // orange-500
                  } else if (value >= goalLines.meta300) {
                    barColor = '#22c55e'; // green-500
                  } else {
                    barColor = '#ef4444'; // red-500
                  }
                }
                
                return (
                  <div key={index} className="flex flex-col items-center" style={{ width: data.length === 1 ? '120px' : '80px', height: '100%' }}>
                    {/* Bar */}
                    <div className="flex items-end h-full">
                      <div 
                        className="w-full rounded-t transition-all duration-300 hover:opacity-80 flex items-center justify-center"
                        style={{ 
                          height: `${Math.max(height, 20)}%`,
                          backgroundColor: barColor,
                          minHeight: '80px',
                          minWidth: data.length === 1 ? '100px' : '70px'
                        }}
                      >
                        {/* Value centered in bar */}
                        {height > 0 && (
                          <span className="text-xs font-bold text-white text-center leading-tight px-1">
                            {chartType === 'sales' ? `${value.toFixed(0)}` : 
                             chartType === 'customers' ? value.toFixed(1) : 
                             value.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* X-axis (dates) */}
        <div className="flex items-center pl-16" style={{ height: '4rem' }}>
          <div className="flex-1 flex justify-around">
            {data.map((item, index) => (
              <span key={index} className="text-xs text-gray-600 text-center" style={{ width: data.length === 1 ? '120px' : '80px' }}>
                {item.date || 'N/A'}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-4"></div>
          <span className="text-gray-600">Cargando analytics...</span>
        </div>
      </div>
    );
  }

  if (!analyticsData || analyticsData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <span className="text-gray-600">No hay datos de analytics disponibles</span>
            <div className="text-xs text-gray-400 mt-2">
              analyticsData: {analyticsData ? `${analyticsData.length} items` : 'Missing'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Period Selector */}
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Período:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {[
                { key: 'monthly', label: 'Mensual' },
                { key: 'quarterly', label: 'Trimestral' },
                { key: 'semester', label: 'Semestral' },
                { key: 'annual', label: 'Anual' }
              ].map(period => (
                <button
                  key={period.key}
                  onClick={() => setTimePeriod(period.key)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    timePeriod === period.key
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Type Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Vista:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {[
                { key: 'sales', label: 'Ventas', icon: DollarSign },
                { key: 'production', label: 'Producción', icon: Clock }
              ].map(chart => {
                const Icon = chart.icon;
                return (
                  <button
                    key={chart.key}
                    onClick={() => setChartType(chart.key)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                      chartType === chart.key
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {chart.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Goal Configuration - Solo para la vista actual */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Meta 300:</label>
            <input
              type="number"
              value={goals[chartType].meta300}
              onChange={(e) => setGoals(prev => ({
                ...prev,
                [chartType]: { ...prev[chartType], meta300: Number(e.target.value) }
              }))}
              className="w-20 px-2 py-1 text-sm border border-green-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <span className="text-xs text-gray-500">
              {chartType === 'sales' ? 'S/' : 'recetas'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Meta 500:</label>
            <input
              type="number"
              value={goals[chartType].meta500}
              onChange={(e) => setGoals(prev => ({
                ...prev,
                [chartType]: { ...prev[chartType], meta500: Number(e.target.value) }
              }))}
              className="w-20 px-2 py-1 text-sm border border-orange-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <span className="text-xs text-gray-500">
              {chartType === 'sales' ? 'S/' : 'recetas'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Chart - Solo UNA gráfica por vista */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        {chartType === 'sales' && (
          <div>
            
            {/* Legend for category colors - Vista de Ventas */}
            {chartData.sales && chartData.sales.length > 0 && chartData.sales[0].categoryBreakdown && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Leyenda por Categorías</h4>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(chartData.sales[0].categoryBreakdown)
                    .sort((a, b) => b[1] - a[1]) // Ordenar por ingreso descendente
                    .map(([category, amount], index) => {
                      const total = Object.values(chartData.sales[0].categoryBreakdown).reduce((sum, c) => sum + c, 0);
                      const percentage = total > 0 ? (amount / total * 100) : 0;
                      
                      return (
                        <div key={category} className="flex items-center gap-2 bg-white px-3 py-2 rounded shadow-sm">
                          <div 
                            className="w-4 h-4 rounded border border-gray-200"
                            style={{ backgroundColor: categoryColors[index % categoryColors.length] }}
                          ></div>
                          <div>
                            <span className="text-sm font-medium text-gray-800">{category}</span>
                            <div className="text-xs text-gray-500">
                              S/ {amount.toFixed(2)} ({Math.round(percentage)}%)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            
            <SimpleBarChart 
              data={chartData.sales} 
              dataKey="value" 
              color="#10B981"
              goalLines={goals.sales}
              chartType="sales"
              categoryColors={categoryColors}
            />
          </div>
        )}

        {chartType === 'production' && (
          <div>
            
            {/* Legend for category colors - Vista de Producción */}
            {chartData.production && chartData.production.length > 0 && chartData.production[0].categoryBreakdown && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Leyenda por Categorías</h4>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(chartData.production[0].categoryBreakdown)
                    .sort((a, b) => b[1] - a[1]) // Ordenar por cantidad descendente
                    .map(([category, count], index) => {
                      const total = Object.values(chartData.production[0].categoryBreakdown).reduce((sum, c) => sum + c, 0);
                      const percentage = total > 0 ? (count / total * 100) : 0;
                      
                      return (
                        <div key={category} className="flex items-center gap-2 bg-white px-3 py-2 rounded shadow-sm">
                          <div 
                            className="w-4 h-4 rounded border border-gray-200"
                            style={{ backgroundColor: categoryColors[index % categoryColors.length] }}
                          ></div>
                          <div>
                            <span className="text-sm font-medium text-gray-800">{category}</span>
                            <div className="text-xs text-gray-500">
                              {count} recetas ({Math.round(percentage)}%)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            
            <SimpleBarChart 
              data={chartData.production} 
              dataKey="value" 
              color="#3B82F6"
              goalLines={goals.production}
              chartType="production"
              categoryColors={categoryColors}
            />
          </div>
        )}

      </div>

      {/* Tooltip - Only show when actively hovering over a segment */}
      {isHovering && hoveredSegment && tooltipPosition.x > 0 && tooltipPosition.y > 0 && (
        <Tooltip 
          data={hoveredSegment} 
          position={tooltipPosition}
        />
      )}

    </div>
  );
};

export default AnalyticsCharts;