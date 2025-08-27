import { useState, useMemo, useCallback } from 'react';
import { Truck, PieChart } from 'lucide-react';
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

const DeliveryRecipesPieChart = ({ delivery_category_breakdown }) => {
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  // Usar los datos reales de delivery del backend
  const deliveryData = useMemo(() => {
    if (!delivery_category_breakdown || delivery_category_breakdown.length === 0) return [];
    
    // Los datos ya vienen procesados del backend con solo order items con is_takeaway=true
    return delivery_category_breakdown.map((category, index) => ({
      ...category,
      color: getCategoryColorHex(index),
      // percentage ya viene calculado del backend
    }));
  }, [delivery_category_breakdown]);
  
  const totalRevenue = deliveryData.reduce((sum, cat) => sum + cat.revenue, 0);
  const totalQuantity = deliveryData.reduce((sum, cat) => sum + cat.quantity, 0);
  
  // Los datos ya vienen con percentages del backend
  const dataWithPercentages = deliveryData;
  
  // Generar segmentos del pie chart
  const pieSegments = useMemo(() => {
    let cumulativePercentage = 0;
    
    return dataWithPercentages.map((item, index) => {
      const startAngle = (cumulativePercentage / 100) * 2 * Math.PI - Math.PI / 2; // Start from top
      const endAngle = ((cumulativePercentage + item.percentage) / 100) * 2 * Math.PI - Math.PI / 2;
      
      cumulativePercentage += item.percentage;
      
      // Calcular coordinates del path SVG
      const radius = 70;
      const centerX = 100;
      const centerY = 100;
      
      const x1 = centerX + radius * Math.cos(startAngle);
      const y1 = centerY + radius * Math.sin(startAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);
      
      const largeArcFlag = item.percentage > 50 ? 1 : 0;
      
      // Calcular posición del label (centro del arco)
      const midAngle = (startAngle + endAngle) / 2;
      const labelRadius = radius * 0.7; // 70% del radio para poner el label
      const labelX = centerX + labelRadius * Math.cos(midAngle);
      const labelY = centerY + labelRadius * Math.sin(midAngle);
      
      // Crear path data
      let pathData;
      if (item.percentage === 100) {
        // Círculo completo
        pathData = `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY + radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY - radius}`;
      } else if (item.percentage > 0) {
        pathData = [
          `M ${centerX} ${centerY}`,
          `L ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
          'Z'
        ].join(' ');
      } else {
        pathData = '';
      }
      
      return {
        ...item,
        pathData,
        startAngle,
        endAngle,
        labelX,
        labelY,
        midAngle
      };
    });
  }, [dataWithPercentages]);
  
  // Callbacks para eventos
  const handleMouseEnter = useCallback((e, segment) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
    setHoveredSegment(segment);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredSegment(null);
  }, []);
  
  if (deliveryData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Truck className="h-5 w-5 text-blue-500" />
          Categorías Delivery
        </h3>
        <div className="text-center text-gray-500 py-8">
          <Truck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium">Sin datos</p>
          <p className="text-sm">No hay ventas delivery para esta fecha</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Truck className="h-5 w-5 text-blue-500" />
        Categorías Delivery ({totalQuantity})
      </h3>
      
      <div className="space-y-4">
        {/* Pie Chart */}
        <div className="h-80">
          <div className="h-64 flex justify-center items-center">
            <svg width="240" height="240" viewBox="0 0 200 200">
              {pieSegments.map((segment, index) => (
                segment.pathData && (
                  <g key={index}>
                    <path
                      d={segment.pathData}
                      fill={segment.color}
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="transition-opacity duration-200 hover:opacity-80 cursor-pointer"
                      onMouseEnter={(e) => handleMouseEnter(e, segment)}
                      onMouseLeave={handleMouseLeave}
                    />
                    {/* Label en el centro del segmento */}
                    {segment.percentage > 8 && ( // Solo mostrar label si el segmento es lo suficientemente grande
                      <text
                        x={segment.labelX}
                        y={segment.labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-white text-xs font-bold pointer-events-none"
                        style={{
                          filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.5))'
                        }}
                      >
                        {segment.quantity}
                      </text>
                    )}
                  </g>
                )
              ))}
            </svg>
          </div>
          
          {/* Legend (categories) */}
          <div className="h-16 flex items-center">
            <div className="flex-1 flex justify-around">
              {dataWithPercentages.map((category, index) => (
                <div 
                  key={index} 
                  className="text-xs text-gray-600 text-center cursor-pointer hover:text-gray-900 transition-colors"
                  style={{ width: `${100 / dataWithPercentages.length}%`, maxWidth: '120px' }}
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
                {hoveredSegment.recipes.length} recetas • {hoveredSegment.quantity} unidades delivery
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            {hoveredSegment.recipes && hoveredSegment.recipes.length > 0 ? (
              <div className="space-y-1">
                {hoveredSegment.recipes
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((recipe, index) => (
                    <div key={index} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-gray-800 flex-1 mr-2" title={recipe.name}>
                        {recipe.name}
                      </span>
                      <div className="text-right">
                        <span className="text-gray-900 font-medium">
                          {formatCurrency(recipe.revenue)}
                        </span>
                        <p className="text-xs text-gray-500">
                          {recipe.quantity} unidades
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm text-gray-500 italic">Sin recetas delivery</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryRecipesPieChart;