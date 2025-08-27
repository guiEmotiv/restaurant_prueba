import { useState, useMemo, useCallback } from 'react';
import { Award, TrendingUp } from 'lucide-react';
import { formatCurrency, getCategoryColor } from '../utils/dashboardUtils';

// Colores para las categorías - consistentes con dashboard
const getCategoryColorHex = (index) => {
  const colorMap = {
    'bg-blue-500': '#3b82f6',
    'bg-green-500': '#22c55e', 
    'bg-yellow-500': '#eab308',
    'bg-purple-500': '#8b5cf6',
    'bg-red-500': '#ef4444',
    'bg-indigo-500': '#6366f1',
    'bg-pink-500': '#ec4899',
    'bg-orange-500': '#f97316',
    'bg-teal-500': '#14b8a6',
    'bg-cyan-500': '#06b6d4'
  };
  
  const bgClass = getCategoryColor(index);
  return colorMap[bgClass] || '#6b7280'; // gray-500 como fallback
};

const TopDishesBarChart = ({ top_dishes, category_breakdown }) => {
  const [hoveredBar, setHoveredBar] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  // Agrupar platos por categoría y combinar con category_breakdown para obtener totales
  const groupedData = useMemo(() => {
    // Crear mapa de categorías con sus ingresos totales
    const categoryMap = {};
    
    // Primero, usar category_breakdown para los totales reales
    if (category_breakdown && category_breakdown.length > 0) {
      category_breakdown.forEach((cat, index) => {
        categoryMap[cat.category] = {
          category: cat.category,
          revenue: cat.revenue,
          quantity: cat.quantity,
          percentage: cat.percentage,
          recipes: [],
          color: getCategoryColorHex(index)
        };
      });
    }
    
    // Luego, agregar los platos a cada categoría
    top_dishes.forEach(dish => {
      const category = dish.category || 'Sin Categoría';
      if (!categoryMap[category]) {
        // Si la categoría no está en category_breakdown, crearla
        categoryMap[category] = {
          category,
          revenue: 0,
          quantity: 0,
          percentage: 0,
          recipes: [],
          color: getCategoryColorHex(Object.keys(categoryMap).length)
        };
      }
      
      // Agregar el plato a la categoría
      categoryMap[category].recipes.push({
        name: dish.name,
        quantity: dish.quantity,
        revenue: dish.revenue,
        unit_price: dish.unit_price
      });
    });
    
    // Convertir a array y ordenar por ingresos
    return Object.values(categoryMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Máximo 10 categorías
  }, [top_dishes, category_breakdown]);
  
  // Calcular máximo valor para escalado
  const maxRevenue = useMemo(() => 
    Math.max(...groupedData.map(cat => cat.revenue)), 
    [groupedData]
  );
  
  // Callbacks memoizados para eventos
  const handleMouseEnter = useCallback((e, category, index) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setHoveredBar({
      ...category,
      index: index,
      percentageOfMax: (category.revenue / maxRevenue) * 100
    });
  }, [maxRevenue]);

  const handleMouseLeave = useCallback(() => {
    setHoveredBar(null);
  }, []);
  
  if (groupedData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          Ventas por Categoría
        </h3>
        <div className="text-center text-gray-500 py-8">
          <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium">Sin datos</p>
          <p className="text-sm">No hay categorías para esta fecha</p>
        </div>
      </div>
    );
  }
  
  const total = groupedData.reduce((sum, cat) => sum + cat.quantity, 0);
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-blue-500" />
        Ventas por Categoría ({total})
      </h3>
      
      <div className="space-y-4">
        {/* Gráfica de Barras */}
        <div className="h-80">
          <div className="h-64 flex">
            {/* Y-axis Scale */}
            <div className="w-12 flex flex-col justify-between py-4 text-xs text-gray-500">
              {(() => {
                const scale = [
                  maxRevenue,
                  Math.floor(maxRevenue * 0.75),
                  Math.floor(maxRevenue * 0.5),
                  Math.floor(maxRevenue * 0.25),
                  0
                ];
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
                  const height = maxRevenue > 0 ? (category.revenue / maxRevenue) * 100 : 0;
                  const absoluteHeight = maxRevenue > 0 ? (category.revenue / maxRevenue) * 240 : 0;
                  
                  return (
                    <div key={index} className="flex flex-col items-center justify-end h-full" style={{ width: `${100 / groupedData.length}%`, maxWidth: '120px' }}>
                      {/* Bar */}
                      <div 
                        className="w-full max-w-16 rounded-t transition-all duration-300 hover:opacity-80 flex items-center justify-center cursor-pointer"
                        style={{ 
                          height: `${absoluteHeight}px`,
                          backgroundColor: category.color,
                          minHeight: category.revenue > 0 ? '8px' : '0px'
                        }}
                        onMouseEnter={(e) => handleMouseEnter(e, category, index)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {/* Value label inside bar if space permits */}
                        {absoluteHeight > 20 && (
                          <span className="text-xs font-bold text-white drop-shadow-sm">
                            {category.quantity}
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
                  onMouseEnter={(e) => handleMouseEnter(e, category, index)}
                  onMouseLeave={handleMouseLeave}
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
      {hoveredBar && (
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
              style={{ backgroundColor: hoveredBar.color }}
            />
            <div>
              <h4 className="font-semibold text-gray-900">{hoveredBar.category}</h4>
              <p className="text-xs text-gray-500">
                {hoveredBar.recipes.length} recetas • {hoveredBar.quantity} unidades totales
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            {hoveredBar.recipes && hoveredBar.recipes.length > 0 ? (
              <div className="space-y-1">
                {hoveredBar.recipes
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((recipe, index) => (
                    <div key={index} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-gray-800 flex-1 mr-2" title={recipe.name}>
                        {recipe.name}
                      </span>
                      <span className="text-gray-600 text-xs">
                        {formatCurrency(recipe.revenue)}
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

export default TopDishesBarChart;