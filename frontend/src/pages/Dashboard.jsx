import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  BarChart3,
  Calendar,
  Target,
  Star,
  ChefHat,
  Utensils,
  Activity,
  Settings,
  Save,
  X,
  CreditCard,
  Wine,
  Flame,
  UserCheck,
  TrendingDown,
  Award,
  Percent,
  LineChart
} from 'lucide-react';
import { apiService } from '../services/api';

const Dashboard = () => {
  console.log('🏠 Dashboard component rendering...');
  console.log('🏠 Dashboard mounted successfully');
  
  const [stats, setStats] = useState({
    // Métricas básicas
    totalOrders: 0,
    totalRevenue: 0,
    lowStockItems: 0,
    activeOrders: 0,
    
    // Métricas avanzadas
    todayRevenue: 0,
    todayOrders: 0,
    averageOrderValue: 0,
    avgServiceTime: 0,
    popularItems: [],
    revenueGrowth: 0,
    tableOccupancy: 0,
    
    // Métricas adicionales para restaurante
    drinksSalesPercentage: 0,
    grillSalesPercentage: 0,
    customerSatisfaction: 0,
    repeatCustomerRate: 0,
    waitersPerformance: [],
    peakHours: { lunch: 0, dinner: 0 },
    inventoryTurnover: 0,
    wastePercentage: 0,
    
    // Datos por períodos
    weeklyRevenue: [],
    hourlyOrders: [],
    topTables: [],
    salesByCategory: [],
    monthlyTrends: []
  });
  
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Usar fecha actual como default
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [operationalInfo, setOperationalInfo] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [operationalConfig, setOperationalConfig] = useState({
    opening_time: '20:00',
    closing_time: '03:00'
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load all data in parallel
      const [
        allOrdersList,
        ,
        allIngredients,
        operationalSummary,
        tables,
        recipes,
        operationalInfoData
      ] = await Promise.all([
        apiService.orders.getAll(),
        apiService.orders.getActive(),
        apiService.ingredients.getAll(),
        apiService.payments.getOperationalSummary(selectedDate),
        apiService.tables.getAll(),
        apiService.recipes.getAll(),
        apiService.restaurantConfig.getOperationalInfo()
      ]);

      // Use operational summary data for revenue metrics
      const todayRevenue = operationalSummary.total_amount || 0;
      const todayOrders = operationalSummary.total_orders || 0;
      
      // Actualizar información operacional
      setOperationalInfo(operationalInfoData);
      
      // Filtrar órdenes por fecha operativa seleccionada
      const selectedOperationalDate = selectedDate;
      const filteredOrdersList = allOrdersList.filter(order => {
        // Comparar con la fecha operativa de la orden si existe, o usar la fecha de creación
        const orderOperationalDate = order.operational_date || order.created_at.split('T')[0];
        return orderOperationalDate === selectedOperationalDate;
      });

      // Load detailed orders with items for paid orders only (for recipe analysis)
      const paidOrderIds = filteredOrdersList.filter(order => order.status === 'PAID').map(order => order.id);
      const allOrders = await Promise.all(
        paidOrderIds.map(async (orderId) => {
          try {
            return await apiService.orders.getById(orderId);
          } catch (error) {
            console.error(`Error loading order ${orderId}:`, error);
            return null;
          }
        })
      );
      
      // Filter out null results
      const validOrders = allOrders.filter(order => order !== null);

      // Calculate total revenue from operational summary (ya filtrado por fecha)
      const allPayments = operationalSummary.payments || [];
      const totalRevenue = todayRevenue; // Usar el revenue de la fecha operativa seleccionada
      
      const lowStockItems = allIngredients.filter(ingredient => 
        ingredient.current_stock <= 5 && ingredient.is_active
      );

      // Métricas avanzadas - todas basadas en fecha operativa seleccionada
      const averageOrderValue = todayOrders > 0 ? todayRevenue / todayOrders : 0;
      const revenueGrowth = 0; // Simplificado para fecha operativa - se puede mejorar más tarde
      
      // Agrupar recetas por grupos reales del backend
      const recipesByGroup = {};
      let grillCount = 0;
      let drinksCount = 0;
      let totalItemsCount = 0;
      
      console.log('Processing recipes, count:', recipes?.length);
      console.log('Processing paid orders with items, count:', validOrders?.length);
      console.log('Paid order IDs:', paidOrderIds);
      console.log('Valid orders sample:', validOrders.slice(0, 2));
      
      // Contar las ventas desde las órdenes usando los nombres de recetas
      validOrders.forEach(order => {
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => {
            // Buscar la receta en la lista de recetas para obtener su grupo real
            const recipe = recipes.find(r => r.name === item.recipe_name || r.id === item.recipe);
            const groupName = recipe?.group_name || 'Sin Categoría';
            
            console.log(`Processing item: ${item.recipe_name}, found recipe:`, recipe?.name, 'group:', groupName);
            
            // Contar para estadísticas de parrilla vs bebidas
            totalItemsCount++;
            if (groupName.toLowerCase().includes('bebida') || groupName.toLowerCase().includes('drink') || 
                groupName.toLowerCase().includes('jugo') || groupName.toLowerCase().includes('cocktail')) {
              drinksCount++;
            } else if (groupName.toLowerCase().includes('parrilla') || groupName.toLowerCase().includes('carne') || 
                       groupName.toLowerCase().includes('pollo') || groupName.toLowerCase().includes('entrada') ||
                       groupName.toLowerCase().includes('plato')) {
              grillCount++;
            }
            
            // Inicializar grupo si no existe
            if (!recipesByGroup[groupName]) {
              recipesByGroup[groupName] = {};
            }
            
            // Inicializar receta si no existe
            if (!recipesByGroup[groupName][item.recipe_name]) {
              recipesByGroup[groupName][item.recipe_name] = {
                name: item.recipe_name,
                count: 0
              };
            }
            
            recipesByGroup[groupName][item.recipe_name].count += 1;
          });
        }
      });

      // Convertir a formato final
      let recipeGroups = Object.entries(recipesByGroup)
        .map(([groupName, recipesObj]) => {
          const recipesArray = Object.values(recipesObj)
            .filter(recipe => recipe.count > 0)
            .sort((a, b) => b.count - a.count);
          
          const totalCount = recipesArray.reduce((sum, recipe) => sum + recipe.count, 0);
          
          return {
            category: groupName,
            totalCount,
            recipes: recipesArray
          };
        })
        .filter(group => group.totalCount > 0)
        .sort((a, b) => b.totalCount - a.totalCount);

      console.log('RecipesByGroup after processing:', recipesByGroup);
      console.log('Final recipeGroups:', recipeGroups);
      console.log('RecipeGroups length for render:', recipeGroups.length);


      // Datos para gráficos basados en fecha operativa seleccionada
      const weeklyRevenue = generateWeeklyRevenue(allPayments);
      const hourlyOrders = generateHourlyOrders(filteredOrdersList);
      const topTables = generateTopTables(filteredOrdersList);


      // Filtrar órdenes activas por fecha operativa
      const activeOrdersFiltered = filteredOrdersList.filter(order => order.status !== 'PAID');

      // Calcular porcentajes de ventas
      const grillSalesPercentage = totalItemsCount > 0 ? (grillCount / totalItemsCount) * 100 : 65;
      const drinksSalesPercentage = totalItemsCount > 0 ? (drinksCount / totalItemsCount) * 100 : 35;

      setStats({
        totalOrders: filteredOrdersList.length,
        totalRevenue,
        lowStockItems: lowStockItems.length,
        activeOrders: activeOrdersFiltered.length,
        todayRevenue,
        todayOrders: todayOrders,
        averageOrderValue,
        avgServiceTime: calculateAvgServiceTime(validOrders),
        recipeGroups: recipeGroups,
        revenueGrowth,
        tableOccupancy: calculateTableOccupancy(activeOrdersFiltered, tables),
        weeklyRevenue,
        hourlyOrders,
        topTables,
        grillSalesPercentage,
        drinksSalesPercentage,
        customerSatisfaction: 4.8,
        repeatCustomerRate: 75
      });

      // Los datos ya están procesados y almacenados en stats

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    loadOperationalConfig();
  }, []);

  // Actualizar información operacional cada minuto
  useEffect(() => {
    const updateOperationalInfo = async () => {
      try {
        const operationalInfoData = await apiService.restaurantConfig.getOperationalInfo();
        setOperationalInfo(operationalInfoData);
      } catch (error) {
        console.error('Error updating operational info:', error);
      }
    };

    // Actualizar inmediatamente
    updateOperationalInfo();
    
    // Configurar intervalo para actualizar cada minuto
    const interval = setInterval(updateOperationalInfo, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Actualizar hora actual cada segundo
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timeInterval);
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
      console.log('No hay configuración activa, usando valores por defecto');
    }
  };

  const handleSaveOperationalConfig = async () => {
    setConfigLoading(true);
    try {
      // Preparar datos con valores por defecto para campos no visibles
      const configData = {
        ...operationalConfig,
        name: 'Configuración Operativa',
        operational_cutoff_time: '05:00',
        is_active: true
      };
      
      // Intentar actualizar configuración existente o crear nueva
      try {
        const activeConfig = await apiService.restaurantConfig.getActive();
        await apiService.restaurantConfig.update(activeConfig.id, configData);
      } catch {
        // Si no existe configuración activa, crear una nueva
        await apiService.restaurantConfig.create(configData);
      }
      
      setShowConfigModal(false);
      // Recargar datos con nueva configuración
      await loadDashboardData();
      await loadOperationalConfig();
    } catch (error) {
      console.error('Error saving operational config:', error);
    } finally {
      setConfigLoading(false);
    }
  };


  // Funciones auxiliares
  const calculateAvgServiceTime = (orders) => {
    const servedOrders = orders.filter(o => o.served_at && o.created_at);
    if (servedOrders.length === 0) return 0;
    
    const totalTime = servedOrders.reduce((sum, order) => {
      const start = new Date(order.created_at);
      const end = new Date(order.served_at);
      return sum + (end - start);
    }, 0);
    
    return Math.round(totalTime / servedOrders.length / (1000 * 60)); // en minutos
  };

  const calculateTableOccupancy = (activeOrders, tables) => {
    const occupiedTables = new Set(activeOrders.map(o => o.table));
    return tables.length > 0 ? (occupiedTables.size / tables.length) * 100 : 0;
  };

  const generateWeeklyRevenue = (payments) => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const weekData = Array(7).fill(0);
    
    payments.forEach(payment => {
      const day = new Date(payment.created_at).getDay();
      weekData[day] += parseFloat(payment.amount || 0);
    });
    
    return weekData.map((revenue, index) => ({
      day: days[index],
      revenue
    }));
  };

  const generateHourlyOrders = (orders) => {
    const hourData = Array(24).fill(0);
    
    orders.forEach(order => {
      const hour = new Date(order.created_at).getHours();
      hourData[hour]++;
    });
    
    return hourData.map((count, hour) => ({
      hour: `${hour}:00`,
      orders: count
    }));
  };

  const generateTopTables = (orders) => {
    const tableRevenue = {};
    
    orders.forEach(order => {
      const tableId = order.table || order.table_number;
      tableRevenue[tableId] = (tableRevenue[tableId] || 0) + parseFloat(order.total_amount || 0);
    });
    
    return Object.entries(tableRevenue)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([table, revenue]) => ({ table, revenue }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  console.log('🏠 Dashboard about to render JSX...');
  
  return (
    <div className="space-y-6 bg-gray-50 min-h-screen -m-6 p-6">
      {console.log('🏠 Dashboard JSX rendering...')}
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Ejecutivo</h1>
          <p className="text-gray-600">
            Análisis integral del restaurante - Parrillas y Bebidas
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            {operationalInfo?.has_config && (
              <>
                <span className={`text-sm font-medium px-2 py-1 rounded ${
                  operationalInfo.is_currently_open 
                    ? 'text-green-700 bg-green-50' 
                    : 'text-red-700 bg-red-50'
                }`}>
                  {operationalInfo.is_currently_open ? '🟢 Abierto' : '🔴 Cerrado'}
                </span>
                <span className="text-sm text-gray-500">
                  🕐 {operationalInfo.business_hours}
                </span>
              </>
            )}
            {!operationalInfo?.has_config && (
              <span className="text-sm text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                ⚠️ Sin configuración operativa
              </span>
            )}
          </div>
        </div>
        
        {/* Configuración y Filtro de Fecha Operativa */}
        <div className="flex items-center gap-3">
          {/* Botón de Configuración de Horarios */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            title="Configurar Horarios"
          >
            <Settings className="h-5 w-5" />
          </button>
          
          {/* Filtro de Fecha Operativa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Operativa
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* KPIs principales - Primera fila */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ingresos del Día</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(stats.todayRevenue)}</p>
              <div className="flex items-center mt-2">
                {stats.revenueGrowth >= 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+{stats.revenueGrowth.toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                    <span className="text-sm text-red-600">{stats.revenueGrowth.toFixed(1)}%</span>
                  </>
                )}
                <span className="text-xs text-gray-500 ml-2">vs. promedio</span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-green-100 rounded-full blur-xl" />
              <DollarSign className="h-10 w-10 text-green-600 relative" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ticket Promedio</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(stats.averageOrderValue)}</p>
              <p className="text-xs text-gray-500 mt-2">{stats.todayOrders} órdenes hoy</p>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl" />
              <Target className="h-10 w-10 text-blue-600 relative" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ocupación</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.tableOccupancy.toFixed(0)}%</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${stats.tableOccupancy}%` }}
                />
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-purple-100 rounded-full blur-xl" />
              <Utensils className="h-10 w-10 text-purple-600 relative" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tiempo Servicio</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.avgServiceTime}<span className="text-lg font-normal text-gray-600">min</span></p>
              <p className="text-xs text-gray-500 mt-2">Promedio del día</p>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-orange-100 rounded-full blur-xl" />
              <Clock className="h-10 w-10 text-orange-600 relative" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs secundarios - Segunda fila */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-orange-600 text-white p-6 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-100">Ventas Parrilla</p>
              <p className="text-3xl font-bold mt-1">{stats.grillSalesPercentage.toFixed(0)}%</p>
              <p className="text-xs text-red-100 mt-2">del total de ventas</p>
            </div>
            <Flame className="h-12 w-12 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white p-6 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Ventas Bebidas</p>
              <p className="text-3xl font-bold mt-1">{stats.drinksSalesPercentage.toFixed(0)}%</p>
              <p className="text-xs text-blue-100 mt-2">del total de ventas</p>
            </div>
            <Wine className="h-12 w-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-6 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-100">Satisfacción</p>
              <p className="text-3xl font-bold mt-1">{stats.customerSatisfaction}<span className="text-lg font-normal">/5</span></p>
              <div className="flex mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    className={`h-4 w-4 ${star <= Math.floor(stats.customerSatisfaction) ? 'fill-yellow-300 text-yellow-300' : 'text-green-200'}`} 
                  />
                ))}
              </div>
            </div>
            <Award className="h-12 w-12 text-green-200" />
          </div>
        </div>
      </div>


      {/* Gráficas de Pie por Grupos de Recetas */}
      {stats.recipeGroups && stats.recipeGroups.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stats.recipeGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <ChefHat className="h-6 w-6 text-blue-500" />
                {group.category} - Distribución de Recetas
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pie Chart */}
                <div className="flex justify-center items-center">
                  <div className="relative">
                    <svg viewBox="0 0 200 200" className="w-64 h-64">
                      {(() => {
                        const recipes = group.recipes || [];
                        const totalCount = group.totalCount || 0;
                        
                        if (recipes.length === 0 || totalCount === 0) {
                          return (
                            <>
                              <circle cx="100" cy="100" r="80" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="2" />
                              <text x="100" y="105" textAnchor="middle" className="text-sm fill-gray-500">
                                Sin datos
                              </text>
                            </>
                          );
                        }
                        
                        // Generar colores dinámicamente para cada receta
                        const colorPalette = [
                          '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
                          '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
                          '#14b8a6', '#a855f7', '#e11d48', '#0ea5e9', '#22c55e'
                        ];
                        
                        let currentAngle = -90;
                        
                        // Caso especial: una sola receta
                        if (recipes.length === 1) {
                          return (
                            <circle
                              cx="100"
                              cy="100"
                              r="80"
                              fill={colorPalette[0]}
                              stroke="white"
                              strokeWidth="2"
                              className="hover:opacity-80 transition-opacity cursor-pointer"
                            />
                          );
                        }
                        
                        return recipes.map((recipe, index) => {
                          const percentage = (recipe.count / totalCount);
                          const angle = percentage * 360;
                          const startAngle = currentAngle * Math.PI / 180;
                          const endAngle = (currentAngle + angle) * Math.PI / 180;
                          
                          // Calcular puntos del arco
                          const radius = 80;
                          const x1 = 100 + radius * Math.cos(startAngle);
                          const y1 = 100 + radius * Math.sin(startAngle);
                          const x2 = 100 + radius * Math.cos(endAngle);
                          const y2 = 100 + radius * Math.sin(endAngle);
                          
                          const largeArc = angle > 180 ? 1 : 0;
                          
                          const pathData = [
                            `M 100 100`,
                            `L ${x1} ${y1}`,
                            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                            'Z'
                          ].join(' ');
                          
                          currentAngle += angle;
                          
                          return (
                            <path
                              key={index}
                              d={pathData}
                              fill={colorPalette[index % colorPalette.length]}
                              stroke="white"
                              strokeWidth="2"
                              className="hover:opacity-80 transition-opacity cursor-pointer"
                            />
                          );
                        });
                      })()}
                    </svg>
                    
                    {/* Centro del pie chart con total */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white rounded-full w-32 h-32 flex flex-col items-center justify-center shadow-inner">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-2xl font-bold text-gray-900">{group.totalCount}</p>
                        <p className="text-xs text-gray-500">unidades</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Leyenda y estadísticas */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {(() => {
                    const recipes = group.recipes || [];
                    const totalCount = group.totalCount || 0;
                    
                    const colorPalette = [
                      '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
                      '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
                      '#14b8a6', '#a855f7', '#e11d48', '#0ea5e9', '#22c55e'
                    ];
                    
                    return recipes.map((recipe, index) => {
                      const percentage = totalCount > 0 ? ((recipe.count / totalCount) * 100).toFixed(1) : '0';
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex items-center">
                            <div 
                              className="w-4 h-4 rounded-full mr-3 flex-shrink-0"
                              style={{ backgroundColor: colorPalette[index % colorPalette.length] }}
                            ></div>
                            <div>
                              <span className="font-medium text-gray-900 text-sm">{recipe.name}</span>
                              <p className="text-xs text-gray-500">{recipe.count} vendidos</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900 text-sm">{percentage}%</p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-center text-gray-500">No hay datos de recetas vendidas para mostrar</p>
        </div>
      )}

      {/* Análisis de Tendencias y Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Ingresos Semanales */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <LineChart className="h-5 w-5 text-blue-500" />
            Ingresos de la Semana
          </h3>
          <div className="h-64">
            <div className="flex h-full items-end justify-between space-x-2">
              {stats.weeklyRevenue.map((day, index) => {
                const maxRevenue = Math.max(...stats.weeklyRevenue.map(d => d.revenue));
                const heightPercentage = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-gray-200 rounded-t relative group">
                      <div 
                        className="bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all duration-300 hover:from-blue-700 hover:to-blue-500"
                        style={{ height: `${heightPercentage * 2}px` }}
                      >
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                          {formatCurrency(day.revenue)}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">{day.day}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Gráfico de Horas Pico */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-500" />
            Distribución de Órdenes por Hora
          </h3>
          <div className="h-64 overflow-x-auto">
            <div className="flex h-full items-end space-x-1 min-w-[600px]">
              {stats.hourlyOrders.filter((hour, idx) => idx >= 12 || idx <= 3).map((hour, index) => {
                const maxOrders = Math.max(...stats.hourlyOrders.map(h => h.orders));
                const heightPercentage = maxOrders > 0 ? (hour.orders / maxOrders) * 100 : 0;
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-gray-200 rounded-t relative group">
                      <div 
                        className={`rounded-t transition-all duration-300 ${
                          hour.orders > 10 
                            ? 'bg-gradient-to-t from-orange-600 to-orange-400 hover:from-orange-700 hover:to-orange-500' 
                            : 'bg-gradient-to-t from-gray-400 to-gray-300 hover:from-gray-500 hover:to-gray-400'
                        }`}
                        style={{ height: `${heightPercentage * 2}px` }}
                      >
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded px-2 py-1">
                          {hour.orders}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">{hour.hour}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span className="text-gray-600">Hora pico</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-400 rounded"></div>
              <span className="text-gray-600">Hora normal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Análisis de Rendimiento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Mesas */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-purple-500" />
            Mesas Más Productivas
          </h3>
          <div className="space-y-3">
            {stats.topTables.length > 0 ? (
              stats.topTables.map((table, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' : 
                      index === 1 ? 'bg-gray-400' : 
                      index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Mesa {table.table}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(table.revenue)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-purple-600">
                      {((table.revenue / stats.totalRevenue) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-4">Sin datos de mesas</p>
            )}
          </div>
        </div>

        {/* Alertas de Inventario */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Alertas de Inventario
          </h3>
          <div className="space-y-3">
            {stats.lowStockItems > 0 ? (
              <>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-red-900">Stock Bajo</p>
                      <p className="text-sm text-red-700">{stats.lowStockItems} ingredientes</p>
                    </div>
                    <Package className="h-8 w-8 text-red-500" />
                  </div>
                </div>
                <Link 
                  to="/inventario/ingredientes" 
                  className="block text-center py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Ver Inventario
                </Link>
              </>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-green-900">Inventario OK</p>
                    <p className="text-sm text-green-700">Todos los niveles correctos</p>
                  </div>
                  <Package className="h-8 w-8 text-green-500" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Estado Operativo */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Estado Operativo
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-blue-900">Órdenes Activas</span>
              <span className="text-lg font-bold text-blue-600">{stats.activeOrders}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <span className="text-sm font-medium text-purple-900">Mesas Ocupadas</span>
              <span className="text-lg font-bold text-purple-600">
                {Math.round((stats.tableOccupancy / 100) * 20)}/20
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <span className="text-sm font-medium text-orange-900">Tiempo Promedio</span>
              <span className="text-lg font-bold text-orange-600">{stats.avgServiceTime}min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Configuración Operativa */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Configuración de Horarios Operativos
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
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
                <p className="text-xs text-gray-500 mt-1">
                  Si cierra al día siguiente (ej: 3:00 AM), se manejará automáticamente
                </p>
              </div>

              {/* Ejemplo visual */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Configuración Actual:</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Apertura: {operationalConfig.opening_time}</p>
                  <p>• Cierre: {operationalConfig.closing_time} {operationalConfig.opening_time > operationalConfig.closing_time ? '(día siguiente)' : ''}</p>
                  <p>• Hora actual: {currentTime.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                  <p className="text-xs text-blue-600 mt-2">
                    {operationalConfig.opening_time > operationalConfig.closing_time 
                      ? `Horario nocturno: abierto desde las ${operationalConfig.opening_time} hasta las ${operationalConfig.closing_time} del día siguiente.`
                      : `Horario diurno: abierto desde las ${operationalConfig.opening_time} hasta las ${operationalConfig.closing_time} del mismo día.`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveOperationalConfig}
                disabled={configLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {configLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar Configuración
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default Dashboard;