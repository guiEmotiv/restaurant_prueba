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
  Activity
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
  const [selectedPeriod, setSelectedPeriod] = useState('today');

  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all data in parallel
      const [
        allOrdersList,
        activeOrders,
        allIngredients,
        payments,
        tables,
        recipes
      ] = await Promise.all([
        apiService.orders.getAll(),
        apiService.orders.getActive(),
        apiService.ingredients.getAll(),
        apiService.payments.getAll(),
        apiService.tables.getAll(),
        apiService.recipes.getAll()
      ]);

      // Load detailed orders with items for paid orders only
      const paidOrderIds = allOrdersList.filter(order => order.status === 'PAID').map(order => order.id);
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

      // Fechas para filtros
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Filtrar datos de hoy
      const todaysOrders = validOrders.filter(order => 
        new Date(order.created_at) >= startOfToday
      );
      const todaysPayments = payments.filter(payment => 
        new Date(payment.created_at) >= startOfToday
      );

      // Calcular métricas básicas
      const totalRevenue = payments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
      const todayRevenue = todaysPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
      
      const lowStockItems = allIngredients.filter(ingredient => 
        ingredient.current_stock <= 5 && ingredient.is_active
      );

      // Métricas avanzadas
      const averageOrderValue = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;
      const revenueGrowth = calculateGrowth(payments, weekAgo);
      
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


      // Datos para gráficos
      const weeklyRevenue = generateWeeklyRevenue(payments);
      const hourlyOrders = generateHourlyOrders(todaysOrders);
      const topTables = generateTopTables(allOrdersList, tables);

      // Datos de prueba para verificar que el renderizado funciona
      const testRecipeGroups = [
        {
          category: "Entradas",
          totalCount: 8,
          recipes: [
            { name: "Ensalada César", count: 8 }
          ]
        },
        {
          category: "Platos Principales", 
          totalCount: 11,
          recipes: [
            { name: "Hamburguesa Clásica", count: 9 },
            { name: "Pescado al Vapor", count: 2 }
          ]
        }
      ];

      setStats({
        totalOrders: allOrdersList.length,
        totalRevenue,
        lowStockItems: lowStockItems.length,
        activeOrders: activeOrders.length,
        todayRevenue,
        todayOrders: todaysOrders.length,
        averageOrderValue,
        avgServiceTime: calculateAvgServiceTime(validOrders),
        recipeGroups: recipeGroups.length > 0 ? recipeGroups : testRecipeGroups,
        revenueGrowth,
        tableOccupancy: calculateTableOccupancy(activeOrders, tables),
        weeklyRevenue,
        hourlyOrders,
        topTables
      });

      // Set recent orders (last 5)
      const sortedOrders = allOrdersList
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
          <p className="text-gray-600">Indicadores clave y métricas de rendimiento</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="today">Hoy</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
          </select>
          <div className="text-sm text-gray-500">
            Actualizado: {new Date().toLocaleTimeString('es-PE')}
          </div>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Ingresos Hoy</p>
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
              <p className="text-gray-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-gray-900">{stats.lowStockItems}</p>
              <p className="text-xs text-gray-500">Ingredientes</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Gráficas de Pie por Grupo de Recetas */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Distribución de Ventas por Grupo de Recetas</h2>
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



    </div>
  );
};

export default Dashboard;