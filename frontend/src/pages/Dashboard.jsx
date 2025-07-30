import { useState, useEffect } from 'react';
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
  X
} from 'lucide-react';
import { apiService } from '../services/api';

const Dashboard = () => {
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
    
    // Datos por períodos
    weeklyRevenue: [],
    hourlyOrders: [],
    topTables: []
  });
  
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStockIngredients, setLowStockIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Usar fecha actual como default
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [operationalDate, setOperationalDate] = useState(null);
  const [operationalInfo, setOperationalInfo] = useState(null);
  const [operationalSummary, setOperationalSummary] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [operationalConfig, setOperationalConfig] = useState({
    opening_time: '20:00',
    closing_time: '03:00'
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadDashboardData();
  }, [selectedDate]);

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
    } catch (error) {
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

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all data in parallel
      const [
        allOrdersList,
        activeOrders,
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
      
      // Actualizar fecha operativa mostrada e información operacional
      setOperationalDate(operationalSummary.operational_date);
      setOperationalInfo(operationalInfoData);
      setOperationalSummary(operationalSummary);
      
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
      const topTables = generateTopTables(filteredOrdersList, tables);


      // Filtrar órdenes activas por fecha operativa
      const activeOrdersFiltered = filteredOrdersList.filter(order => order.status !== 'PAID');

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
        topTables
      });

      // Set recent orders (last 5) - usar órdenes filtradas por fecha operativa
      const sortedOrders = filteredOrdersList
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);
      setRecentOrders(sortedOrders);

      // Set low stock ingredients (top 5)
      setLowStockIngredients(lowStockItems.slice(0, 5));

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Funciones auxiliares
  const calculateGrowth = (payments, weekAgo) => {
    const thisWeek = payments.filter(p => new Date(p.created_at) >= weekAgo);
    const lastWeekEnd = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeek = payments.filter(p => 
      new Date(p.created_at) >= lastWeekEnd && new Date(p.created_at) < weekAgo
    );
    
    const thisWeekRevenue = thisWeek.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const lastWeekRevenue = lastWeek.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    
    return lastWeekRevenue > 0 ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0;
  };

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

  const generateTopTables = (orders, tables) => {
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'CREATED': 'bg-yellow-100 text-yellow-800',
      'SERVED': 'bg-blue-100 text-blue-800',
      'PAID': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const statusTexts = {
      'CREATED': 'Creado',
      'SERVED': 'Entregado',
      'PAID': 'Pagado'
    };
    return statusTexts[status] || status;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(8)].map((_, i) => (
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Administrativo</h1>
          <p className="text-gray-600">
            Indicadores clave y métricas de rendimiento
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

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Ingresos Fecha Operativa</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.todayRevenue)}</p>
              <p className="text-xs text-gray-500">{stats.todayOrders} órdenes</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Ticket Promedio</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.averageOrderValue)}</p>
              <p className="text-xs text-gray-500">Por orden</p>
            </div>
            <Target className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Tiempo Servicio</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgServiceTime}m</p>
              <p className="text-xs text-gray-500">Promedio</p>
            </div>
            <Clock className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Ocupación</p>
              <p className="text-2xl font-bold text-gray-900">{stats.tableOccupancy.toFixed(1)}%</p>
              <p className="text-xs text-gray-500">Mesas activas</p>
            </div>
            <Utensils className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Total Órdenes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
              <p className="text-xs text-gray-500">Fecha operativa seleccionada</p>
            </div>
            <ShoppingCart className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Gráficas de Pie por Grupo de Recetas */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Distribución de Ventas por Grupo de Recetas
          </h2>
          <div className="text-sm text-gray-500">
            {stats.recipeGroups ? `${stats.recipeGroups.length} grupos con ventas` : 'Cargando datos...'}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.recipeGroups?.map((group, groupIndex) => {
            const colors = [
              '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
              '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
            ];
            
            return (
              <div key={groupIndex} className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{group.category}</h3>
                  <p className="text-sm text-gray-600">{group.totalCount} items vendidos</p>
                </div>
                
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <svg viewBox="0 0 200 200" className="w-40 h-40">
                      {(() => {
                        if (!group.recipes || group.recipes.length === 0 || group.totalCount === 0) {
                          return (
                            <>
                              <circle cx="100" cy="100" r="80" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="2" />
                              <text x="100" y="105" textAnchor="middle" className="text-sm fill-gray-500">
                                Sin datos
                              </text>
                            </>
                          );
                        }
                        
                        let currentAngle = -90;
                        
                        // Caso especial: una sola receta - mostrar círculo completo
                        if (group.recipes.length === 1) {
                          return (
                            <circle
                              cx="100"
                              cy="100"
                              r="80"
                              fill={colors[0]}
                              stroke="white"
                              strokeWidth="2"
                              className="hover:opacity-80 transition-opacity cursor-pointer"
                              title={`${group.recipes[0].name}: ${group.recipes[0].count} vendidas`}
                            />
                          );
                        }
                        
                        // Múltiples recetas - pie chart normal
                        return group.recipes.map((recipe, index) => {
                          const angle = (recipe.count / group.totalCount) * 360;
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
                              fill={colors[index % colors.length]}
                              stroke="white"
                              strokeWidth="2"
                              className="hover:opacity-80 transition-opacity cursor-pointer"
                              title={`${recipe.name}: ${recipe.count} vendidas`}
                            />
                          );
                        });
                      })()}
                    </svg>
                  </div>
                </div>
                
                {/* Leyenda mejorada */}
                <div className="space-y-3">
                  {group.recipes?.map((recipe, index) => {
                    const percentage = group.totalCount > 0 ? ((recipe.count / group.totalCount) * 100).toFixed(1) : '0';
                    
                    return (
                      <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center min-w-0 flex-1">
                          <div 
                            className="w-4 h-4 rounded-full mr-3 flex-shrink-0 border-2 border-white shadow-sm"
                            style={{ backgroundColor: colors[index % colors.length] }}
                          ></div>
                          <span className="text-sm font-medium text-gray-700 truncate">{recipe.name}</span>
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <div className="text-sm font-bold text-gray-900">{recipe.count}</div>
                          <div className="text-xs text-gray-500">{percentage}%</div>
                        </div>
                      </div>
                    );
                  }) || (
                    <div className="text-center py-8">
                      <ChefHat className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No hay ventas en este grupo</p>
                    </div>
                  )}
                </div>
              </div>
            );
          }) || (
            <div className="col-span-full">
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay datos de ventas</h3>
                <p className="text-gray-500 mb-4">
                  Aún no se han registrado ventas de recetas o los datos están cargando.
                </p>
                <div className="text-xs text-gray-400">
                  Debug: {stats.recipeGroups ? 'Array vacío' : 'Datos no disponibles'}
                </div>
              </div>
            </div>
          )}
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

      {/* Tarjeta de Distribución de Ventas por Grupo de Recetas */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <ChefHat className="h-6 w-6 text-purple-500" />
          Distribución de Ventas por Grupo de Recetas
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pie Chart */}
          <div className="flex justify-center items-center">
            <div className="relative">
              <svg viewBox="0 0 200 200" className="w-64 h-64">
                {(() => {
                  const groupsData = stats.recipeGroups || [];
                  const totalItems = groupsData.reduce((sum, group) => sum + group.totalCount, 0);
                  
                  if (groupsData.length === 0 || totalItems === 0) {
                    return (
                      <>
                        <circle cx="100" cy="100" r="80" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="2" />
                        <text x="100" y="105" textAnchor="middle" className="text-sm fill-gray-500">
                          Sin datos
                        </text>
                      </>
                    );
                  }
                  
                  const colors = [
                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
                  ];
                  
                  let currentAngle = -90;
                  
                  return groupsData.map((group, index) => {
                    const percentage = (group.totalCount / totalItems);
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
                        fill={colors[index % colors.length]}
                        stroke="white"
                        strokeWidth="2"
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                        title={`${group.category}: ${group.totalCount} items`}
                      />
                    );
                  });
                })()}
              </svg>
              
              {/* Centro del pie chart con total */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white rounded-full w-32 h-32 flex flex-col items-center justify-center shadow-inner">
                  <p className="text-xs text-gray-500">Total Items</p>
                  <p className="text-lg font-bold text-gray-900">
                    {stats.recipeGroups?.reduce((sum, group) => sum + group.totalCount, 0) || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Leyenda y estadísticas */}
          <div className="space-y-4">
            {(() => {
              const groupsData = stats.recipeGroups || [];
              const totalItems = groupsData.reduce((sum, group) => sum + group.totalCount, 0);
              
              const colors = [
                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
              ];
              
              return groupsData.map((group, index) => {
                const percentage = totalItems > 0 ? ((group.totalCount / totalItems) * 100).toFixed(1) : '0';
                
                return (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center">
                      <div 
                        className="w-4 h-4 rounded-full mr-3 flex-shrink-0"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      ></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{group.category}</span>
                        </div>
                        <p className="text-sm text-gray-500">{group.recipes.length} recetas diferentes</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{group.totalCount} items</p>
                      <p className="text-sm text-gray-500">{percentage}%</p>
                    </div>
                  </div>
                );
              });
            })()}
            
            {/* Resumen adicional */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Grupos activos</p>
                  <p className="text-lg font-semibold text-gray-900">{stats.recipeGroups?.length || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Promedio por grupo</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {stats.recipeGroups?.length > 0 
                      ? Math.round(stats.recipeGroups.reduce((sum, g) => sum + g.totalCount, 0) / stats.recipeGroups.length)
                      : 0
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de Pie de Ventas por Método de Pago */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Distribución de Ventas por Método de Pago
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pie Chart */}
          <div className="flex justify-center items-center">
            <div className="relative">
              <svg viewBox="0 0 200 200" className="w-64 h-64">
                {(() => {
                  const paymentData = operationalSummary?.summary_by_method || [];
                  const totalAmount = operationalSummary?.total_amount || 0;
                  
                  if (paymentData.length === 0 || totalAmount === 0) {
                    return (
                      <>
                        <circle cx="100" cy="100" r="80" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="2" />
                        <text x="100" y="105" textAnchor="middle" className="text-sm fill-gray-500">
                          Sin datos
                        </text>
                      </>
                    );
                  }
                  
                  const colors = {
                    'CASH': '#10b981',      // green
                    'CARD': '#3b82f6',      // blue
                    'YAPE_PLIN': '#8b5cf6', // purple
                    'OTHER': '#f59e0b'      // amber
                  };
                  
                  const methodNames = {
                    'CASH': 'Efectivo',
                    'CARD': 'Tarjeta',
                    'YAPE_PLIN': 'Yape/Plin',
                    'OTHER': 'Otro'
                  };
                  
                  let currentAngle = -90;
                  
                  return paymentData.map((payment, index) => {
                    const percentage = (payment.total / totalAmount);
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
                        fill={colors[payment.payment_method] || '#6b7280'}
                        stroke="white"
                        strokeWidth="2"
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                        title={`${methodNames[payment.payment_method]}: ${formatCurrency(payment.total)}`}
                      />
                    );
                  });
                })()}
              </svg>
              
              {/* Centro del pie chart con total */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white rounded-full w-32 h-32 flex flex-col items-center justify-center shadow-inner">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(operationalSummary?.total_amount || 0)}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Leyenda y estadísticas */}
          <div className="space-y-4">
            {(() => {
              const paymentData = operationalSummary?.summary_by_method || [];
              const totalAmount = operationalSummary?.total_amount || 0;
              
              const colors = {
                'CASH': '#10b981',
                'CARD': '#3b82f6',
                'YAPE_PLIN': '#8b5cf6',
                'OTHER': '#f59e0b'
              };
              
              const methodNames = {
                'CASH': 'Efectivo',
                'CARD': 'Tarjeta',
                'YAPE_PLIN': 'Yape/Plin',
                'OTHER': 'Otro'
              };
              
              const icons = {
                'CASH': '💵',
                'CARD': '💳',
                'YAPE_PLIN': '📱',
                'OTHER': '🔄'
              };
              
              return paymentData.map((payment, index) => {
                const percentage = totalAmount > 0 ? ((payment.total / totalAmount) * 100).toFixed(1) : '0';
                
                return (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center">
                      <div 
                        className="w-4 h-4 rounded-full mr-3 flex-shrink-0"
                        style={{ backgroundColor: colors[payment.payment_method] || '#6b7280' }}
                      ></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{icons[payment.payment_method]}</span>
                          <span className="font-medium text-gray-900">{methodNames[payment.payment_method]}</span>
                        </div>
                        <p className="text-sm text-gray-500">{payment.count} transacciones</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatCurrency(payment.total)}</p>
                      <p className="text-sm text-gray-500">{percentage}%</p>
                    </div>
                  </div>
                );
              });
            })()}
            
            {/* Resumen adicional */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Total de transacciones</p>
                  <p className="text-lg font-semibold text-gray-900">{operationalSummary?.total_orders || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Transacción promedio</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency((operationalSummary?.total_amount || 0) / (operationalSummary?.total_orders || 1))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;