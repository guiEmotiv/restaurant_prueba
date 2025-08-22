import { useState, useMemo, useCallback } from 'react';
import { Award, XCircle } from 'lucide-react';
import { formatCurrency, getCategoryColor } from '../utils/dashboardUtils';

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

const UnsolRecipesPieChart = ({ unsold_recipes }) => {
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  // Agrupar recetas por categoría - memoizado para evitar re-cálculos
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
  
  // Calcular máximo valor para escalado - memoizado
  const maxCount = useMemo(() => 
    Math.max(...groupedData.map(cat => cat.count)), 
    [groupedData]
  );
  
  // Callbacks memoizados para eventos
  const handleMouseEnter = useCallback((e, category) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setHoveredSegment({
      ...category,
      percentage: (category.count / total) * 100
    });
  }, [total]);

  const handleMouseLeave = useCallback(() => {
    setHoveredSegment(null);
  }, []);
  
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
                  const height = maxCount > 0 ? (category.count / maxCount) * 100 : 0;
                  const absoluteHeight = maxCount > 0 ? (category.count / maxCount) * 240 : 0;
                  
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
                        onMouseEnter={(e) => handleMouseEnter(e, category)}
                        onMouseLeave={handleMouseLeave}
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
                  onMouseEnter={(e) => handleMouseEnter(e, category)}
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

export default UnsolRecipesPieChart;