import { useState, useEffect, useMemo, useCallback } from 'react';
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

const AnalyticsCharts = ({ 
  dashboardData, 
  selectedDate, 
  selectedPeriod, 
  chartType, 
  goals,
  onDateChange, 
  onPeriodChange,
  onChartTypeChange,
  onGoalsChange 
}) => {
  const [analyticsData, setAnalyticsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

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

  // Función para formatear fechas - movida fuera del useMemo para ser accesible
  const formatDate = useCallback((dateStr) => {
    try {
      if (!dateStr) return 'Hoy';
      // Parsear fecha sin conversión de zona horaria
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      return date.toLocaleDateString('es-ES', { 
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    } catch (e) {
      return dateStr || 'Hoy';
    }
  }, []);

  // Función para obtener color consistente de categoría basado en orden global
  const getCategoryColor = useCallback((categoryName) => {
    if (!dashboardData?.category_breakdown) return categoryColors[0];
    
    const globalOrder = dashboardData.category_breakdown
      .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
      .map(cat => cat.category);
    
    const categoryIndex = globalOrder.indexOf(categoryName);
    return categoryColors[categoryIndex >= 0 ? categoryIndex % categoryColors.length : 0];
  }, [dashboardData]);

  
  // Use dashboardData passed from parent
  useEffect(() => {
    if (dashboardData) {
      // CRÍTICO: Loggear la estructura completa de datos del backend
      console.log('🔍 RAW DASHBOARD DATA STRUCTURE:', {
        hasSalesByDay: !!dashboardData.sales_by_day,
        salesByDayLength: dashboardData.sales_by_day?.length || 0,
        firstDayData: dashboardData.sales_by_day?.[0],
        topDishesInFirstDay: dashboardData.sales_by_day?.[0]?.top_dishes?.length || 0,
        sampleTopDishes: dashboardData.sales_by_day?.[0]?.top_dishes?.slice(0, 3) || []
      });
      
      // El backend ya filtra los datos según el período seleccionado
      // Usar directamente los sales_by_day del backend que contiene las fechas del view
      if (dashboardData.sales_by_day && Array.isArray(dashboardData.sales_by_day) && dashboardData.sales_by_day.length > 0) {
        // Usar datos REALES del backend - NO calcular proporcionalmente
        const processedData = dashboardData.sales_by_day.map(dayData => {
          console.log(`📅 Processing day ${dayData.date}:`, {
            topDishesCount: dayData.top_dishes?.length || 0,
            categoryBreakdownCount: dayData.category_breakdown?.length || 0,
            sampleTopDish: dayData.top_dishes?.[0] || null
          });
          
          return {
            date: dayData.date,
            summary: {
              total_revenue: dayData.revenue || 0,
              total_orders: dayData.orders || 0,
              total_items: dayData.items || 0
            },
            // Usar category_breakdown REAL del backend para este día específico
            category_breakdown: dayData.category_breakdown || [],
            top_dishes: dayData.top_dishes || [] // Usar top_dishes específicos del día si están disponibles
          };
        });
        
        console.log('✅ PROCESSED ANALYTICS DATA:', processedData);
        setAnalyticsData(processedData);
      } else {
        // Si no hay sales_by_day, usar el summary general como single data point
        setAnalyticsData([{
          date: selectedDate,
          summary: dashboardData.summary || {},
          top_dishes: dashboardData.top_dishes || [],
          category_breakdown: dashboardData.category_breakdown || []
        }]);
      }
      setLoading(false);
    }
  }, [dashboardData, selectedDate]);

  // Procesar datos para gráficas basadas en datos reales
  const chartData = useMemo(() => {
    if (!analyticsData || analyticsData.length === 0) {
      return { sales: [], production: [], customers: [] };
    }

    // Vista VENTAS - Métrica: Total de ventas por día
    const salesData = analyticsData.map(data => {
      const revenue = Number(data.summary?.total_revenue || 0);
      
      // Usar category_breakdown REAL del backend para este día específico
      let categoryBreakdown = {};
      if (Array.isArray(data.category_breakdown) && data.category_breakdown.length > 0) {
        data.category_breakdown.forEach(cat => {
          categoryBreakdown[cat.category || 'Sin categoría'] = cat.revenue || 0;
        });
      }
      
      
      return {
        date: formatDate(data.date || selectedDate),
        value: revenue,
        categoryBreakdown: categoryBreakdown
      };
    });

    // Vista PRODUCCIÓN - Métrica: Cantidad de items por día
    const productionData = analyticsData.map(data => {
      const totalItems = Number(data.summary?.total_items || 0);
      
      // Usar category_breakdown REAL del backend para este día específico
      let categoryBreakdown = {};
      if (Array.isArray(data.category_breakdown) && data.category_breakdown.length > 0) {
        data.category_breakdown.forEach(cat => {
          categoryBreakdown[cat.category || 'Sin categoría'] = cat.quantity || 0;
        });
      }
      
      
      return {
        date: formatDate(data.date || selectedDate),
        value: totalItems,
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
  }, [analyticsData, selectedDate, formatDate]);
  
  // Clear tooltip when chart type changes
  useEffect(() => {
    setIsHovering(false);
    setHoveredSegment(null);
    setTooltipPosition({ x: 0, y: 0 });
  }, [chartType]);
  
  // Las metas ahora vienen del componente padre
  // No necesitamos actualizar metas aquí

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

  // Función para obtener recetas por categoría de la fecha específica
  const getCategoryRecipes = (categoryName, viewType = 'production', specificDate = null) => {
    console.log('🔍 getCategoryRecipes called:', { categoryName, viewType, specificDate, selectedDate, analyticsDataLength: analyticsData.length });
    
    // AGREGAR: Log completo de analyticsData para debuggear
    console.log('📊 FULL analyticsData:', analyticsData.map(data => ({
      date: data.date,
      revenue: data.summary?.total_revenue,
      items: data.summary?.total_items,
      topDishesCount: data.top_dishes?.length || 0,
      categoryBreakdownCount: data.category_breakdown?.length || 0,
      topDishesPreview: data.top_dishes?.slice(0,2)?.map(dish => ({
        name: dish.name,
        category: dish.category,
        quantity: dish.quantity,
        revenue: dish.revenue
      })) || []
    })));
    
    // CRÍTICO: Log de TODAS las categorías disponibles en los datos
    analyticsData.forEach(data => {
      if (data.top_dishes && data.top_dishes.length > 0) {
        const categories = [...new Set(data.top_dishes.map(dish => dish.category))];
        console.log(`📅 Date ${data.date} - Available categories:`, categories);
        console.log(`🔍 Looking for category "${categoryName}" - Case sensitive match:`, categories.includes(categoryName));
      }
    });
    
    
    // ARREGLADO: Buscar en la fecha específica del segmento si se proporciona
    const targetDate = specificDate || selectedDate;
    console.log('🔍 SEARCHING FOR CATEGORY ON SPECIFIC DATE:', { categoryName, targetDate });
    
    // Buscar datos de la fecha específica del segmento
    const currentDayData = analyticsData.find(data => {
      // Comparar la fecha del segmento con los datos disponibles
      const rawDataDate = data.date;
      const formattedDataDate = formatDate(data.date);
      const rawTargetDate = targetDate;
      const formattedTargetDate = formatDate(targetDate);
      
      console.log('📅 SPECIFIC DATE COMPARISON:', { 
        rawDataDate, 
        formattedDataDate,
        rawTargetDate,
        formattedTargetDate,
        rawMatch: rawDataDate === rawTargetDate,
        formattedMatch: formattedDataDate === formattedTargetDate
      });
      
      // Intentar múltiples comparaciones para encontrar la fecha exacta
      return rawDataDate === rawTargetDate || 
             formattedDataDate === formattedTargetDate ||
             rawDataDate === formattedTargetDate ||
             formattedDataDate === rawTargetDate;
    });
    
    console.log('📊 Current day data found:', currentDayData ? 'YES' : 'NO', currentDayData?.top_dishes?.length || 0, 'top_dishes');
    
    // Si encontramos datos del día específico y tiene top_dishes, usar esos
    if (currentDayData && currentDayData.top_dishes && Array.isArray(currentDayData.top_dishes) && currentDayData.top_dishes.length > 0) {
      console.log('🔍 DEBUGGING FILTER - Available dishes:', currentDayData.top_dishes.map(dish => ({
        name: dish.name,
        category: dish.category,
        categoryLength: dish.category?.length,
        targetCategory: categoryName,
        targetLength: categoryName?.length,
        exactMatch: dish.category === categoryName,
        trimmedMatch: dish.category?.trim() === categoryName?.trim()
      })));
      
      // MEJORADO: Filtro más robusto con trimming
      const filteredDishes = currentDayData.top_dishes.filter(dish => {
        const dishCategory = dish.category?.trim();
        const targetCategory = categoryName?.trim();
        return dishCategory === targetCategory;
      });
      
      console.log('🍽️ Filtered dishes for category:', categoryName, filteredDishes.length, filteredDishes);
      
      // AGREGAR: Log total de valores para verificar consistencia
      const totalRevenue = filteredDishes.reduce((sum, dish) => sum + (Number(dish.revenue) || 0), 0);
      const totalQuantity = filteredDishes.reduce((sum, dish) => sum + (Number(dish.quantity) || 0), 0);
      console.log('💰 TOOLTIP VALUES:', {
        categoryName,
        expectedRevenue: 'Should match bar segment value',
        calculatedRevenue: totalRevenue.toFixed(2),
        expectedQuantity: 'Should match bar segment quantity',
        calculatedQuantity: totalQuantity,
        dishCount: filteredDishes.length
      });
      
      return filteredDishes.sort((a, b) => {
          if (viewType === 'sales') {
            return (Number(b.revenue || 0)) - (Number(a.revenue || 0));
          } else {
            return (Number(b.quantity || 0)) - (Number(a.quantity || 0));
          }
        });
    }
    
    // Si no hay top_dishes específicos pero hay category_breakdown, mostrar solo mensaje de categoría
    if (currentDayData && currentDayData.category_breakdown && Array.isArray(currentDayData.category_breakdown)) {
      const categoryData = currentDayData.category_breakdown.find(cat => cat.category === categoryName);
      if (categoryData) {
        // Devolver datos básicos de la categoría para el día específico
        return [{
          name: `${categoryName} (${formatDate(selectedDate)})`,
          category: categoryName,
          quantity: categoryData.quantity || 0,
          revenue: categoryData.revenue || 0,
          unit_price: categoryData.revenue && categoryData.quantity ? (categoryData.revenue / categoryData.quantity).toFixed(2) : 0
        }];
      }
    }
    
    // MEJORADO: Fallback más inteligente - buscar en cualquier día disponible si no hay datos específicos
    if (analyticsData.length > 0) {
      console.log('🔍 Searching in all available days for category:', categoryName);
      
      for (const dayData of analyticsData) {
        if (dayData.top_dishes && Array.isArray(dayData.top_dishes) && dayData.top_dishes.length > 0) {
          const filteredDishes = dayData.top_dishes.filter(dish => dish.category === categoryName);
          if (filteredDishes.length > 0) {
            console.log('🍽️ Found fallback dishes from date:', dayData.date, filteredDishes.length);
            return filteredDishes.sort((a, b) => {
              if (viewType === 'sales') {
                return (Number(b.revenue || 0)) - (Number(a.revenue || 0));
              } else {
                return (Number(b.quantity || 0)) - (Number(a.quantity || 0));
              }
            });
          }
        }
      }
    }
    
    // Último fallback: no hay datos
    console.log('❌ No recipe data found for category:', categoryName);
    return [];
  };

  // Tooltip Component
  const Tooltip = ({ data, position }) => {
    if (!data) return null;
    
    const recipes = getCategoryRecipes(data.category, data.type, data.date);
    
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
          {recipes.length > 0 ? recipes.slice(0, 6).map((recipe, index) => {
            // Calcular el ancho basado en el tipo de vista
            let maxValue, currentValue, barWidth;
            
            if (data.type === 'sales') {
              // Para vista de ventas: usar revenue
              maxValue = Math.max(...recipes.map(r => Number(r.revenue || 0)));
              currentValue = Number(recipe.revenue || 0);
              barWidth = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
            } else {
              // Para vista de producción: usar quantity
              maxValue = Math.max(...recipes.map(r => Number(r.quantity || 0)));
              currentValue = Number(recipe.quantity || 0);
              barWidth = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
            }
            
            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate flex-1 mr-2" title={recipe.name}>
                    {recipe.name}
                  </span>
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
                    {data.type === 'sales' ? 
                      `S/ ${currentValue.toFixed(2)}` : 
                      `${Math.round(currentValue)}`
                    }
                  </span>
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 italic">
                {data.category === 'Sin Categoría' ? 
                  'No hay recetas en esta categoría' : 
                  `No hay recetas de ${data.category} disponibles`
                }
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Valor total: {data.type === 'sales' ? `S/ ${data.value.toFixed(2)}` : `${data.value} items`}
              </p>
            </div>
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
      <div className="relative" style={{ height: 'auto', aspectRatio: '16/9', minHeight: '340px' }}>
        <div className="flex" style={{ height: 'calc(100% - 4rem)' }}>
          {/* Y-axis Scale */}
          <div className="w-16 flex flex-col justify-between py-4 text-xs text-gray-500">
            {[maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0].map((value, index) => {
              // Redondear valores para evitar muchos decimales
              let displayValue = value;
              if (chartType === 'sales') {
                // Para ventas, redondear a enteros si es mayor a 100, sino a 2 decimales
                displayValue = value > 100 ? Math.round(value) : Math.round(value * 100) / 100;
                return (
                  <div key={index} className="text-right pr-2">
                    S/ {displayValue.toFixed(value > 100 ? 0 : 2)}
                  </div>
                );
              } else if (chartType === 'production') {
                // Para producción, siempre enteros
                displayValue = Math.round(value);
                return (
                  <div key={index} className="text-right pr-2">
                    {displayValue}
                  </div>
                );
              } else {
                // Para otros casos
                displayValue = Math.round(value * 10) / 10;
                return (
                  <div key={index} className="text-right pr-2">
                    {displayValue.toFixed(1)}
                  </div>
                );
              }
            })}
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
                    Promedio
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
                    Máximo
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
                                {chartType === 'sales' ? value.toFixed(2) : value}
                              </span>
                            </div>
                          )}
                          
                          {/* Category segments - APILADOS VERTICALMENTE */}
                          {categories.map(([category, count], catIndex) => {
                            const segmentValue = count;
                            const segmentHeight = value > 0 ? (count / value) * 100 : 0;
                            const categoryColor = getCategoryColor(category);
                            
                            
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
                                  console.log('🔥 HOVER ACTIVATED on segment:', { category, segmentValue, chartType, itemDate: item.date });
                                  setIsHovering(true);
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTooltipPosition({ 
                                    x: rect.right, 
                                    y: rect.top + rect.height / 2 
                                  });
                                  setHoveredSegment({
                                    category,
                                    value: segmentValue,
                                    color: categoryColor,
                                    type: chartType,
                                    date: item.date // ARREGLADO: Pasar la fecha específica del segmento
                                  });
                                }}
                                onMouseLeave={() => {
                                  setIsHovering(false);
                                  setHoveredSegment(null);
                                  setTooltipPosition({ x: 0, y: 0 });
                                }}
                              >
                                {/* Etiqueta de valor para cada segmento - TODAS las divisiones etiquetadas */}
                                {segmentHeight > 8 && segmentValue > 0 && (
                                  <span className="text-xs font-bold text-white drop-shadow-sm">
                                    {chartType === 'sales' ? 
                                      segmentValue.toFixed(2) : 
                                      `${segmentValue}`
                                    }
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Total label below bar */}
                      <div className="mt-2 text-center">
                        <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                          {chartType === 'sales' ? `S/ ${value.toFixed(2)}` : `${Math.round(value)}`}
                        </span>
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
                            {chartType === 'sales' ? value.toFixed(2) : 
                             chartType === 'customers' ? value.toFixed(1) : 
                             value.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Total label below bar */}
                    <div className="mt-2 text-center">
                      <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                        {chartType === 'sales' ? `S/ ${value.toFixed(2)}` : 
                         chartType === 'customers' ? value.toFixed(1) : 
                         `${Math.round(value)}`}
                      </span>
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
      {/* Main Chart - Solo UNA gráfica por vista */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        {chartType === 'sales' && (
          <div>            
            <SimpleBarChart 
              data={chartData.sales} 
              dataKey="value" 
              color="#10B981"
              goalLines={goals.sales}
              chartType="sales"
              categoryColors={categoryColors}
            />
            
            {/* Legend for category colors - Vista de Ventas */}
            {dashboardData?.category_breakdown && dashboardData.category_breakdown.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Leyenda por Categorías - Total Período</h4>
                <div className="flex flex-wrap gap-3">
                  {dashboardData.category_breakdown
                    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0)) // Ordenar por ingreso descendente
                    .map((category, index) => {
                      return (
                        <div key={category.category} className="flex items-center gap-2 bg-white px-3 py-2 rounded shadow-sm">
                          <div 
                            className="w-4 h-4 rounded border border-gray-200"
                            style={{ backgroundColor: getCategoryColor(category.category) }}
                          ></div>
                          <div>
                            <span className="text-sm font-medium text-gray-800">{category.category}</span>
                            <div className="text-xs text-gray-500">
                              S/ {(category.revenue || 0).toFixed(2)} ({Math.round(category.percentage || 0)}%)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {chartType === 'production' && (
          <div>            
            <SimpleBarChart 
              data={chartData.production} 
              dataKey="value" 
              color="#3B82F6"
              goalLines={goals.production}
              chartType="production"
              categoryColors={categoryColors}
            />
            
            {/* Legend for category colors - Vista de Producción */}
            {dashboardData?.category_breakdown && dashboardData.category_breakdown.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Leyenda por Categorías - Total Período</h4>
                <div className="flex flex-wrap gap-3">
                  {dashboardData.category_breakdown
                    .sort((a, b) => (b.quantity || 0) - (a.quantity || 0)) // Ordenar por cantidad descendente
                    .map((category, index) => {
                      return (
                        <div key={category.category} className="flex items-center gap-2 bg-white px-3 py-2 rounded shadow-sm">
                          <div 
                            className="w-4 h-4 rounded border border-gray-200"
                            style={{ backgroundColor: getCategoryColor(category.category) }}
                          ></div>
                          <div>
                            <span className="text-sm font-medium text-gray-800">{category.category}</span>
                            <div className="text-xs text-gray-500">
                              {category.quantity || 0} items ({Math.round(category.percentage || 0)}%)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Tooltip - Only show when actively hovering over a segment */}
      {console.log('🔍 TOOLTIP STATE:', { isHovering, hasHoveredSegment: !!hoveredSegment, tooltipPosition }) || null}
      {isHovering && hoveredSegment && tooltipPosition.x > 0 && tooltipPosition.y > 0 ? (
        <>
          {console.log('✅ RENDERING TOOLTIP:', hoveredSegment) || null}
          <Tooltip 
            data={hoveredSegment} 
            position={tooltipPosition}
          />
        </>
      ) : (
        console.log('❌ TOOLTIP NOT RENDERED - Conditions:', {
          isHovering,
          hasHoveredSegment: !!hoveredSegment,
          validPosition: tooltipPosition.x > 0 && tooltipPosition.y > 0
        }) || null
      )}

    </div>
  );
};

export default AnalyticsCharts;