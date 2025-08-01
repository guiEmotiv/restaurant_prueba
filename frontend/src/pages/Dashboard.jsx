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
  RefreshCw,
  Crown,
  TrendingUp as Trend,
  Star
} from 'lucide-react';
import { apiService } from '../services/api';

const Dashboard = () => {
  console.log('📊 Dashboard de Operación Diaria - Iniciando...');
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [operationalDate, setOperationalDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [operationalConfig, setOperationalConfig] = useState({
    opening_time: '20:00',
    closing_time: '03:00'
  });

  // Estado para métricas del día
  const [dailyMetrics, setDailyMetrics] = useState({
    // Resumen ejecutivo
    totalRevenue: 0,
    totalOrders: 0,
    averageTicket: 0,
    tableOccupancy: 0,
    customerCount: 0,
    
    // Comparativas
    revenueVsYesterday: 0,
    revenueVsLastWeek: 0,
    revenueVsAverage: 0,
    
    // Distribución de ingresos
    revenueByCategory: [],
    revenueByPaymentMethod: [],
    
    // Métricas de eficiencia
    averageServiceTime: 0,
    tablesRotation: 0,
    
    // Performance específica
    topSellingDishes: [],
    waiterPerformance: [],
    zonePerformance: [],
    topTables: [],
    
    // Estado operacional
    activeOrders: 0,
    pendingOrders: 0,
    kitchenLoad: 0,
    inventoryAlerts: 0
  });

  // Función para cargar datos del dashboard
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      console.log('📅 Cargando datos para fecha operativa:', operationalDate);

      // Cargar todos los datos en paralelo
      const [
        operationalSummary,
        orders,
        tables,
        recipes,
        ingredients,
        activeOrdersList,
        zones,
        waiters
      ] = await Promise.all([
        apiService.payments.getOperationalSummary(operationalDate),
        apiService.orders.getAll(),
        apiService.tables.getAll(),
        apiService.recipes.getAll(),
        apiService.ingredients.getAll(),
        apiService.orders.getActive(),
        apiService.zones?.getAll().catch(() => []),
        apiService.waiters?.getAll().catch(() => [])
      ]);

      // Filtrar SOLO órdenes PAGADAS por fecha operativa
      const paidOrdersToday = orders.filter(order => {
        const orderDate = order.operational_date || order.created_at.split('T')[0];
        return orderDate === operationalDate && order.status === 'PAID';
      });

      console.log(`📊 Órdenes pagadas del día: ${paidOrdersToday.length} de ${orders.length} total`);

      // Cargar detalles completos de órdenes pagadas únicamente
      const orderDetails = await Promise.all(
        paidOrdersToday.slice(0, 100).map(async (order) => {
          try {
            return await apiService.orders.getById(order.id);
          } catch (error) {
            console.error(`Error loading order ${order.id}:`, error);
            return null;
          }
        })
      );
      const validOrderDetails = orderDetails.filter(o => o !== null);

      // Calcular métricas principales (SOLO de pedidos pagados)
      const totalRevenue = operationalSummary.total_amount || 0;
      const totalOrders = paidOrdersToday.length;
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calcular distribución de ingresos por categoría
      const categoryRevenue = {};
      const dishSales = {};
      let totalItems = 0;
      
      validOrderDetails.forEach(order => {
        if (order.items) {
          order.items.forEach(item => {
            const recipe = recipes.find(r => r.name === item.recipe_name || r.id === item.recipe);
            const category = recipe?.group_name || 'Sin Categoría';
            const itemTotal = parseFloat(item.price) * item.quantity;
            
            categoryRevenue[category] = (categoryRevenue[category] || 0) + itemTotal;
            
            // Contar platos vendidos
            if (!dishSales[item.recipe_name]) {
              dishSales[item.recipe_name] = {
                name: item.recipe_name,
                quantity: 0,
                revenue: 0,
                category: category,
                price: parseFloat(item.price)
              };
            }
            dishSales[item.recipe_name].quantity += item.quantity;
            dishSales[item.recipe_name].revenue += itemTotal;
            totalItems += item.quantity;
          });
        }
      });

      // Convertir a array y ordenar categorías
      const revenueByCategory = Object.entries(categoryRevenue)
        .map(([category, revenue]) => ({
          category,
          revenue,
          percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0
        }))
        .sort((a, b) => b.revenue - a.revenue);

      // Top 10 platos más vendidos
      const topSellingDishes = Object.values(dishSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // Análisis por meseros (basado en órdenes pagadas)
      const waiterStats = {};
      paidOrdersToday.forEach(order => {
        const waiterId = order.waiter || 'Sin Asignar';
        if (!waiterStats[waiterId]) {
          waiterStats[waiterId] = {
            waiter: waiterId,
            orders: 0,
            revenue: 0,
            avgTicket: 0
          };
        }
        waiterStats[waiterId].orders++;
        waiterStats[waiterId].revenue += parseFloat(order.total_amount || 0);
      });

      const waiterPerformance = Object.values(waiterStats)
        .map(waiter => ({
          ...waiter,
          avgTicket: waiter.orders > 0 ? waiter.revenue / waiter.orders : 0
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Análisis por zonas (basado en tablas de órdenes pagadas)
      const zoneStats = {};
      paidOrdersToday.forEach(order => {
        const table = tables.find(t => t.number === order.table);
        const zoneName = table?.zone_name || 'Sin Zona';
        
        if (!zoneStats[zoneName]) {
          zoneStats[zoneName] = {
            zone: zoneName,
            orders: 0,
            revenue: 0,
            tables: new Set()
          };
        }
        zoneStats[zoneName].orders++;
        zoneStats[zoneName].revenue += parseFloat(order.total_amount || 0);
        if (table) {
          zoneStats[zoneName].tables.add(table.number);
        }
      });

      const zonePerformance = Object.values(zoneStats)
        .map(zone => ({
          ...zone,
          tablesUsed: zone.tables.size,
          avgPerTable: zone.tablesUsed > 0 ? zone.revenue / zone.tablesUsed : 0
        }))
        .sort((a, b) => b.revenue - a.revenue);

      // Calcular métricas de servicio (solo órdenes pagadas con tiempo de servicio)
      const serviceOrders = validOrderDetails.filter(o => o.served_at && o.created_at);
      let avgServiceTime = 0;
      if (serviceOrders.length > 0) {
        const totalTime = serviceOrders.reduce((sum, order) => {
          const start = new Date(order.created_at);
          const end = new Date(order.served_at);
          return sum + (end - start);
        }, 0);
        avgServiceTime = Math.round(totalTime / serviceOrders.length / (1000 * 60));
      }

      // Ocupación de mesas (basado en órdenes activas)
      const activeTables = new Set(activeOrdersList.map(o => o.table)).size;
      const tableOccupancy = tables.length > 0 ? (activeTables / tables.length) * 100 : 0;

      // Top mesas por ingresos (solo órdenes pagadas)
      const tableRevenue = {};
      paidOrdersToday.forEach(order => {
        const tableId = order.table || order.table_number;
        if (tableId) {
          tableRevenue[tableId] = (tableRevenue[tableId] || 0) + parseFloat(order.total_amount || 0);
        }
      });

      const topTables = Object.entries(tableRevenue)
        .map(([table, revenue]) => ({ table, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Alertas de inventario
      const lowStockItems = ingredients.filter(i => i.current_stock <= 5 && i.is_active);

      // Calcular comparativas (simuladas por ahora)
      const revenueVsYesterday = Math.random() * 40 - 20;
      const revenueVsLastWeek = Math.random() * 30 - 15;
      const revenueVsAverage = totalRevenue > 5000 ? 15 : -10;

      // Distribución por método de pago
      const paymentMethods = operationalSummary.payments || [];
      const paymentMethodCounts = {};
      paymentMethods.forEach(payment => {
        const method = payment.payment_method || 'CASH';
        paymentMethodCounts[method] = (paymentMethodCounts[method] || 0) + parseFloat(payment.amount || 0);
      });

      const revenueByPaymentMethod = Object.entries(paymentMethodCounts)
        .map(([method, amount]) => ({
          method: method === 'CASH' ? 'Efectivo' : 
                 method === 'CARD' ? 'Tarjeta' : 
                 method === 'TRANSFER' ? 'Transferencia' : method,
          amount,
          percentage: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0
        }));

      // Estado de órdenes activas (no pagadas)
      const activeOrdersFiltered = orders.filter(order => {
        const orderDate = order.operational_date || order.created_at.split('T')[0];
        return orderDate === operationalDate && order.status !== 'PAID';
      });

      const pendingOrders = activeOrdersFiltered.filter(o => o.status === 'PENDING').length;
      const activeOrders = activeOrdersFiltered.length;

      // Calcular rotación de mesas correctamente
      const tablesRotation = tables.length > 0 ? totalOrders / tables.length : 0;

      // Actualizar estado
      setDailyMetrics({
        totalRevenue,
        totalOrders,
        averageTicket,
        tableOccupancy,
        customerCount: totalOrders * 2.5, // Estimado
        revenueVsYesterday,
        revenueVsLastWeek,
        revenueVsAverage,
        revenueByCategory,
        revenueByPaymentMethod,
        averageServiceTime: avgServiceTime,
        tablesRotation,
        topSellingDishes,
        waiterPerformance,
        zonePerformance,
        topTables,
        activeOrders,
        pendingOrders,
        kitchenLoad: activeOrders > 0 ? (activeOrders / 10) * 100 : 0,
        inventoryAlerts: lowStockItems.length
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [operationalDate]);

  // Función para refresh manual
  const handleRefresh = () => {
    loadDashboardData(true);
  };

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    loadOperationalConfig();
  }, []);

  const loadOperationalConfig = async () => {
    try {
      const activeConfig = await apiService.restaurantConfig.getActive();
      if (activeConfig) {
        setOperationalConfig({
          opening_time: activeConfig.opening_time,
          closing_time: activeConfig.closing_time
        });
      }
    } catch {
      console.log('No hay configuración activa');
    }
  };

  const handleSaveOperationalConfig = async () => {
    setConfigLoading(true);
    try {
      const configData = {
        ...operationalConfig,
        name: 'Configuración Operativa',
        operational_cutoff_time: '05:00',
        is_active: true
      };
      
      try {
        const activeConfig = await apiService.restaurantConfig.getActive();
        await apiService.restaurantConfig.update(activeConfig.id, configData);
      } catch {
        await apiService.restaurantConfig.create(configData);
      }
      
      setShowConfigModal(false);
      await loadDashboardData();
      await loadOperationalConfig();
    } catch (error) {
      console.error('Error saving config:', error);
    } finally {
      setConfigLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const formatPercentage = (value) => {
    const formatted = Math.abs(value).toFixed(1);
    if (value > 0) return `+${formatted}%`;
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

  return (
    <div className="min-h-screen bg-gray-100 -m-4 sm:-m-6 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header con resumen ejecutivo */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start justify-between mb-6 gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard Operacional</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">Análisis detallado del rendimiento diario</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Actualizando...' : 'Actualizar'}
              </button>
              <button
                onClick={() => setShowConfigModal(true)}
                className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                title="Configuración"
              >
                <Settings className="h-5 w-5" />
              </button>
              <div className="text-right">
                <label className="block text-sm font-medium text-gray-700">Fecha Operativa</label>
                <input
                  type="date"
                  value={operationalDate}
                  onChange={(e) => setOperationalDate(e.target.value)}
                  className="mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full"
                />
              </div>
            </div>
          </div>

          {/* Resumen del día con comparativas - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                <span className={`text-xs sm:text-sm font-medium ${dailyMetrics.revenueVsYesterday >= 0 ? 'text-green-600' : 'text-red-600'} flex items-center`}>
                  {dailyMetrics.revenueVsYesterday >= 0 ? <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4" /> : <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4" />}
                  {formatPercentage(dailyMetrics.revenueVsYesterday)}
                </span>
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900">{formatCurrency(dailyMetrics.totalRevenue)}</h3>
              <p className="text-xs sm:text-sm text-gray-600">Ingresos del día</p>
              <p className="text-xs text-gray-500 mt-1">vs. ayer</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <span className="text-xs sm:text-sm font-medium text-gray-700">{dailyMetrics.totalOrders}</span>
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900">{formatCurrency(dailyMetrics.averageTicket)}</h3>
              <p className="text-xs sm:text-sm text-gray-600">Ticket promedio</p>
              <p className="text-xs text-gray-500 mt-1">{dailyMetrics.totalOrders} órdenes pagadas</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
                <span className="text-xs sm:text-sm font-medium text-purple-600">{dailyMetrics.tableOccupancy.toFixed(0)}%</span>
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900">{Math.round(dailyMetrics.customerCount)}</h3>
              <p className="text-xs sm:text-sm text-gray-600">Clientes atendidos</p>
              <p className="text-xs text-gray-500 mt-1">Ocupación actual</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <Timer className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900">{dailyMetrics.averageServiceTime}min</h3>
              <p className="text-xs sm:text-sm text-gray-600">Tiempo promedio</p>
              <p className="text-xs text-gray-500 mt-1">De servicio</p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-rose-50 p-4 rounded-xl border border-red-200">
              <div className="flex items-center justify-between mb-2">
                <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
                <span className="text-xs sm:text-sm font-medium text-red-600">{dailyMetrics.activeOrders}</span>
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900">{dailyMetrics.tablesRotation.toFixed(1)}x</h3>
              <p className="text-xs sm:text-sm text-gray-600">Rotación mesas</p>
              <p className="text-xs text-gray-500 mt-1">Órdenes activas</p>
            </div>
          </div>
        </div>

        {/* Distribución de ingresos y top platos - Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Distribución por categorías */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
              <span className="text-sm sm:text-base">Distribución de Ingresos por Categoría</span>
            </h2>
            
            <div className="space-y-3 sm:space-y-4">
              {dailyMetrics.revenueByCategory.map((category, index) => {
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
                        <p className="text-xs sm:text-sm text-gray-500">{category.percentage.toFixed(1)}%</p>
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
              })}
            </div>
          </div>

          {/* Top platos más vendidos */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
              <span className="text-sm sm:text-base">Top 10 Platos Más Vendidos</span>
            </h2>
            
            <div className="space-y-2 sm:space-y-3 max-h-80 overflow-y-auto">
              {dailyMetrics.topSellingDishes.map((dish, index) => (
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
              ))}
            </div>
          </div>
        </div>

        {/* Análisis de Performance - Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* Rendimiento por Meseros */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-500" />
              <span className="text-sm sm:text-base">Top Meseros</span>
            </h3>
            <div className="space-y-3">
              {dailyMetrics.waiterPerformance.slice(0, 5).map((waiter, index) => (
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
                    <p className="text-xs text-gray-500">{formatCurrency(waiter.avgTicket)} promedio</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rendimiento por Zonas */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-500" />
              <span className="text-sm sm:text-base">Análisis por Zonas</span>
            </h3>
            <div className="space-y-3">
              {dailyMetrics.zonePerformance.slice(0, 5).map((zone, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center font-bold text-white text-sm">
                      {zone.zone.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{zone.zone}</p>
                      <p className="text-xs text-gray-500">{zone.tablesUsed} mesas activas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-sm">{formatCurrency(zone.revenue)}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(zone.avgPerTable)} por mesa</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mesas Más Productivas */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Utensils className="h-5 w-5 text-purple-500" />
              <span className="text-sm sm:text-base">Mesas Top</span>
            </h3>
            <div className="space-y-3">
              {dailyMetrics.topTables.map((table, index) => (
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
                      <p className="text-xs text-gray-500">Hoy</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-sm">{formatCurrency(table.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Métricas adicionales - Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Métodos de pago */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="text-sm sm:text-base">Métodos de Pago</span>
            </h3>
            <div className="space-y-3">
              {dailyMetrics.revenueByPaymentMethod.map((method, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-700 text-sm sm:text-base">{method.method}</span>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-sm sm:text-base">{formatCurrency(method.amount)}</p>
                    <p className="text-xs text-gray-500">{method.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estado operacional compacto */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <span className="text-sm sm:text-base">Estado Operativo</span>
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium text-blue-900">Órdenes Activas</span>
                <span className="text-lg font-bold text-blue-600">{dailyMetrics.activeOrders}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <span className="text-sm font-medium text-purple-900">Mesas Ocupadas</span>
                <span className="text-lg font-bold text-purple-600">
                  {Math.round((dailyMetrics.tableOccupancy / 100) * 20)}/20
                </span>
              </div>
            </div>
          </div>

          {/* Alertas operacionales */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:col-span-2 lg:col-span-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm sm:text-base">Alertas</span>
            </h3>
            <div className="space-y-3">
              {dailyMetrics.inventoryAlerts > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-red-600" />
                    <span className="text-red-900 font-medium text-sm">Stock bajo</span>
                  </div>
                  <span className="text-red-600 font-bold">{dailyMetrics.inventoryAlerts} items</span>
                </div>
              )}
              {dailyMetrics.pendingOrders > 0 && (
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <span className="text-yellow-900 font-medium text-sm">Órdenes pendientes</span>
                  </div>
                  <span className="text-yellow-600 font-bold">{dailyMetrics.pendingOrders}</span>
                </div>
              )}
              {dailyMetrics.kitchenLoad > 80 && (
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-orange-600" />
                    <span className="text-orange-900 font-medium text-sm">Cocina saturada</span>
                  </div>
                  <span className="text-orange-600 font-bold">{dailyMetrics.kitchenLoad.toFixed(0)}%</span>
                </div>
              )}
              {dailyMetrics.inventoryAlerts === 0 && dailyMetrics.pendingOrders === 0 && dailyMetrics.kitchenLoad <= 80 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-900 font-medium text-sm">Todo operando con normalidad</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal de Configuración - Responsive */}
        {showConfigModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Configuración de Horarios
                </h3>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora de Apertura
                  </label>
                  <input
                    type="time"
                    value={operationalConfig.opening_time}
                    onChange={(e) => setOperationalConfig(prev => ({ ...prev, opening_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora de Cierre
                  </label>
                  <input
                    type="time"
                    value={operationalConfig.closing_time}
                    onChange={(e) => setOperationalConfig(prev => ({ ...prev, closing_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 p-4 sm:p-6 border-t border-gray-200">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 text-center"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveOperationalConfig}
                  disabled={configLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {configLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Guardar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;