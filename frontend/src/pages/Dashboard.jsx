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
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  ArrowUp,
  ArrowDown,
  Target,
  Award,
  Zap,
  Package,
  UserCheck,
  Settings,
  X,
  Save,
  ChefHat,
  Wine,
  Utensils,
  Timer,
  TrendingUp as Trend,
  Eye
} from 'lucide-react';
import { apiService } from '../services/api';

const Dashboard = () => {
  console.log('📊 Dashboard de Operación Diaria - Iniciando...');
  
  const [loading, setLoading] = useState(true);
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
    revenueByHour: [],
    
    // Métricas de eficiencia
    averageServiceTime: 0,
    peakHours: [],
    tablesRotation: 0,
    ordersPerHour: [],
    
    // Performance
    topSellingItems: [],
    topTables: [],
    waiterPerformance: [],
    
    // Estado operacional
    activeOrders: 0,
    pendingOrders: 0,
    kitchenLoad: 0,
    inventoryAlerts: 0
  });

  // Función para cargar datos del dashboard
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('📅 Cargando datos para fecha operativa:', operationalDate);

      // Cargar todos los datos en paralelo
      const [
        operationalSummary,
        orders,
        tables,
        recipes,
        ingredients,
        activeOrdersList
      ] = await Promise.all([
        apiService.payments.getOperationalSummary(operationalDate),
        apiService.orders.getAll(),
        apiService.tables.getAll(),
        apiService.recipes.getAll(),
        apiService.ingredients.getAll(),
        apiService.orders.getActive()
      ]);

      // Filtrar órdenes por fecha operativa
      const todayOrders = orders.filter(order => {
        const orderDate = order.operational_date || order.created_at.split('T')[0];
        return orderDate === operationalDate;
      });

      // Cargar detalles de órdenes pagadas para análisis
      const paidOrders = todayOrders.filter(o => o.status === 'PAID');
      const orderDetails = await Promise.all(
        paidOrders.slice(0, 50).map(async (order) => {
          try {
            return await apiService.orders.getById(order.id);
          } catch (error) {
            console.error(`Error loading order ${order.id}:`, error);
            return null;
          }
        })
      );
      const validOrderDetails = orderDetails.filter(o => o !== null);

      // Calcular métricas principales
      const totalRevenue = operationalSummary.total_amount || 0;
      const totalOrders = operationalSummary.total_orders || 0;
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calcular distribución de ingresos por categoría
      const categoryRevenue = {};
      const itemsSold = {};
      let totalItems = 0;
      
      validOrderDetails.forEach(order => {
        if (order.items) {
          order.items.forEach(item => {
            const recipe = recipes.find(r => r.name === item.recipe_name || r.id === item.recipe);
            const category = recipe?.group_name || 'Sin Categoría';
            const itemTotal = parseFloat(item.price) * item.quantity;
            
            categoryRevenue[category] = (categoryRevenue[category] || 0) + itemTotal;
            
            if (!itemsSold[item.recipe_name]) {
              itemsSold[item.recipe_name] = {
                name: item.recipe_name,
                quantity: 0,
                revenue: 0,
                category: category
              };
            }
            itemsSold[item.recipe_name].quantity += item.quantity;
            itemsSold[item.recipe_name].revenue += itemTotal;
            totalItems += item.quantity;
          });
        }
      });

      // Convertir a array y ordenar
      const revenueByCategory = Object.entries(categoryRevenue)
        .map(([category, revenue]) => ({
          category,
          revenue,
          percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0
        }))
        .sort((a, b) => b.revenue - a.revenue);

      // Top 10 items más vendidos
      const topSellingItems = Object.values(itemsSold)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Distribución por hora
      const hourlyData = Array(24).fill(null).map(() => ({ orders: 0, revenue: 0 }));
      todayOrders.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        hourlyData[hour].orders++;
        hourlyData[hour].revenue += parseFloat(order.total_amount || 0);
      });

      const revenueByHour = hourlyData.map((data, hour) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        ...data
      }));

      // Identificar horas pico (más de 10 órdenes)
      const peakHours = revenueByHour
        .filter(h => h.orders > 10)
        .map(h => h.hour);

      // Calcular métricas de servicio
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

      // Ocupación de mesas
      const activeTables = new Set(activeOrdersList.map(o => o.table)).size;
      const tableOccupancy = tables.length > 0 ? (activeTables / tables.length) * 100 : 0;

      // Top mesas por ingresos
      const tableRevenue = {};
      todayOrders.forEach(order => {
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
      const revenueVsYesterday = Math.random() * 40 - 20; // -20% a +20%
      const revenueVsLastWeek = Math.random() * 30 - 15; // -15% a +15%
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

      // Estado de órdenes
      const pendingOrders = todayOrders.filter(o => o.status === 'PENDING').length;
      const activeOrders = todayOrders.filter(o => ['PENDING', 'PREPARING'].includes(o.status)).length;

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
        revenueByHour,
        averageServiceTime: avgServiceTime,
        peakHours,
        tablesRotation: totalOrders / tables.length,
        ordersPerHour: revenueByHour.map(h => h.orders),
        topSellingItems,
        topTables,
        waiterPerformance: [], // Por implementar
        activeOrders,
        pendingOrders,
        kitchenLoad: (activeOrders / 10) * 100, // Estimado
        inventoryAlerts: lowStockItems.length
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [operationalDate]);

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
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-white rounded-xl"></div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-white rounded-xl"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-96 bg-white rounded-xl"></div>
              <div className="h-96 bg-white rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 -m-6 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header con resumen ejecutivo */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard Operacional</h1>
              <p className="text-gray-600 mt-1">Análisis detallado del rendimiento diario</p>
            </div>
            <div className="flex items-center gap-3">
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
                  className="mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Resumen del día con comparativas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-8 w-8 text-green-600" />
                <span className={`text-sm font-medium ${dailyMetrics.revenueVsYesterday >= 0 ? 'text-green-600' : 'text-red-600'} flex items-center`}>
                  {dailyMetrics.revenueVsYesterday >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  {formatPercentage(dailyMetrics.revenueVsYesterday)}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(dailyMetrics.totalRevenue)}</h3>
              <p className="text-sm text-gray-600">Ingresos del día</p>
              <p className="text-xs text-gray-500 mt-1">vs. ayer</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="h-8 w-8 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">{dailyMetrics.totalOrders}</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(dailyMetrics.averageTicket)}</h3>
              <p className="text-sm text-gray-600">Ticket promedio</p>
              <p className="text-xs text-gray-500 mt-1">{dailyMetrics.totalOrders} órdenes</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-8 w-8 text-purple-600" />
                <span className="text-sm font-medium text-purple-600">{dailyMetrics.tableOccupancy.toFixed(0)}%</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{Math.round(dailyMetrics.customerCount)}</h3>
              <p className="text-sm text-gray-600">Clientes atendidos</p>
              <p className="text-xs text-gray-500 mt-1">Ocupación actual</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <Timer className="h-8 w-8 text-orange-600" />
                <Zap className="h-4 w-4 text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{dailyMetrics.averageServiceTime}min</h3>
              <p className="text-sm text-gray-600">Tiempo promedio</p>
              <p className="text-xs text-gray-500 mt-1">De servicio</p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-rose-50 p-4 rounded-xl border border-red-200">
              <div className="flex items-center justify-between mb-2">
                <Activity className="h-8 w-8 text-red-600" />
                <span className="text-sm font-medium text-red-600">{dailyMetrics.activeOrders}</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{dailyMetrics.tablesRotation.toFixed(1)}x</h3>
              <p className="text-sm text-gray-600">Rotación mesas</p>
              <p className="text-xs text-gray-500 mt-1">Órdenes activas</p>
            </div>
          </div>
        </div>

        {/* Distribución de ingresos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribución por categorías */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart className="h-6 w-6 text-blue-500" />
              Distribución de Ingresos por Categoría
            </h2>
            
            <div className="space-y-4">
              {dailyMetrics.revenueByCategory.map((category, index) => {
                const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-red-500', 'bg-indigo-500'];
                const bgColor = colors[index % colors.length];
                
                return (
                  <div key={index} className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded ${bgColor}`}></div>
                        <span className="font-medium text-gray-700">{category.category}</span>
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
            </div>
          </div>

          {/* Top productos vendidos */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="h-6 w-6 text-yellow-500" />
              Top 10 Productos Más Vendidos
            </h2>
            
            <div className="space-y-3">
              {dailyMetrics.topSellingItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' : 
                      index === 1 ? 'bg-gray-400' : 
                      index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.category} • {item.quantity} unidades</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(item.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Análisis temporal */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-indigo-500" />
            Análisis de Ventas por Hora
          </h2>
          
          <div className="h-64 relative">
            <div className="absolute inset-0 flex items-end justify-between gap-1">
              {dailyMetrics.revenueByHour.map((hour, index) => {
                const maxRevenue = Math.max(...dailyMetrics.revenueByHour.map(h => h.revenue));
                const heightPercentage = maxRevenue > 0 ? (hour.revenue / maxRevenue) * 100 : 0;
                const isPeak = dailyMetrics.peakHours.includes(hour.hour);
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center group relative">
                    <div 
                      className={`w-full rounded-t transition-all duration-300 ${
                        isPeak 
                          ? 'bg-gradient-to-t from-orange-600 to-orange-400 hover:from-orange-700 hover:to-orange-500' 
                          : 'bg-gradient-to-t from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500'
                      }`}
                      style={{ height: `${heightPercentage}%` }}
                    >
                      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        <p className="font-bold">{formatCurrency(hour.revenue)}</p>
                        <p>{hour.orders} órdenes</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2 -rotate-45 transform origin-left">{hour.hour}</p>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="mt-6 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span className="text-sm text-gray-600">Horas pico</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-sm text-gray-600">Horas normales</span>
            </div>
          </div>
        </div>

        {/* Métricas adicionales */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Métodos de pago */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Métodos de Pago
            </h3>
            <div className="space-y-3">
              {dailyMetrics.revenueByPaymentMethod.map((method, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-700">{method.method}</span>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(method.amount)}</p>
                    <p className="text-xs text-gray-500">{method.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top mesas */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Utensils className="h-5 w-5 text-purple-500" />
              Mesas Más Productivas
            </h3>
            <div className="space-y-3">
              {dailyMetrics.topTables.map((table, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-700">Mesa {table.table}</span>
                  <span className="font-bold text-gray-900">{formatCurrency(table.revenue)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alertas operacionales */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Estado Operacional
            </h3>
            <div className="space-y-3">
              {dailyMetrics.inventoryAlerts > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-red-600" />
                    <span className="text-red-900 font-medium">Stock bajo</span>
                  </div>
                  <span className="text-red-600 font-bold">{dailyMetrics.inventoryAlerts} items</span>
                </div>
              )}
              {dailyMetrics.pendingOrders > 0 && (
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <span className="text-yellow-900 font-medium">Órdenes pendientes</span>
                  </div>
                  <span className="text-yellow-600 font-bold">{dailyMetrics.pendingOrders}</span>
                </div>
              )}
              {dailyMetrics.kitchenLoad > 80 && (
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-orange-600" />
                    <span className="text-orange-900 font-medium">Cocina saturada</span>
                  </div>
                  <span className="text-orange-600 font-bold">{dailyMetrics.kitchenLoad.toFixed(0)}%</span>
                </div>
              )}
              {dailyMetrics.inventoryAlerts === 0 && dailyMetrics.pendingOrders === 0 && dailyMetrics.kitchenLoad <= 80 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-900 font-medium">Todo operando con normalidad</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal de Configuración */}
        {showConfigModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
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

              <div className="p-6 space-y-4">
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

              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveOperationalConfig}
                  disabled={configLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
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