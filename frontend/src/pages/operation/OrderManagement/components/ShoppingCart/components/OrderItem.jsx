import { memo } from 'react';
import { getItemStatusColor } from '../../../utils/orderHelpers';

const OrderItem = ({
  item,
  itemNumber,
  onCancelItem,
  onStatusChange,
  onRetryPrint,
  saving = false
}) => {

  // 🔍 DEBUGGING: Log solo si hay problema de pricing
  if (!item.unit_price || !item.total_price) {
    console.log('🚨 ORDER-ITEM PRICING ISSUE:', {
      itemId: item.id,
      recipe_name: item.recipe_name,
      unit_price: item.unit_price,
      total_price: item.total_price,
      total_with_container: item.total_with_container,
      fullItem: item
    });
  }

  // Manejar cancelación del item
  const handleCancelItem = () => {
    if (onCancelItem && item.id) {
      onCancelItem(item.id);
    }
  };

  // Usar la verificación de cancelación que viene del componente padre (incluye verificación de roles)
  const canCancel = item.canCancel;

  // Renderizar indicador de estado con información de impresión
  const renderStatusIndicator = () => {
    // CREATED sin imprimir = problema de impresión
    if (item.status === 'CREATED' && !item.print_confirmed) {
      return (
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span className="text-xs text-red-600 font-medium">Sin imprimir</span>
        </div>
      );
    }

    // CREATED impreso = esperando confirmación
    if (item.status === 'CREATED' && item.print_confirmed) {
      return (
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          <span className="text-xs text-blue-600 font-medium">Impreso</span>
        </div>
      );
    }

    // PREPARING = en cocina
    if (item.status === 'PREPARING') {
      return (
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
          <span className="text-xs text-yellow-600 font-medium">Preparando</span>
        </div>
      );
    }

    // SERVED = servido
    if (item.status === 'SERVED') {
      return (
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span className="text-xs text-green-600 font-medium">Servido</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="px-6 py-4 border-b border-gray-100 bg-blue-50/30">
      <div className="flex items-center gap-4">
        {/* Número del item con color de estado */}
        <div className="flex-shrink-0">
          <div 
            className={`w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center text-white ${getItemStatusColor(item.status)}`}
            title={`Estado: ${item.status}`}
          >
            {itemNumber}.
          </div>
        </div>
        
        {/* Info del item */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-medium text-gray-900 truncate">
              {item.recipe_name || item.recipe?.name || item.name}
            </h4>
            
            {item.is_takeaway && (
              <div className="flex items-center bg-orange-100 text-orange-600 p-2 rounded-full" title="Para llevar">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            )}
          </div>
          
          <div className="text-lg text-gray-500 mt-1">
            <p>x{item.quantity} • S/ {(item.total_with_container || item.total_price || 0).toFixed(2)}</p>
            
            {/* Mostrar desglose de envase solo si es para llevar y hay costo de envase */}
            {item.is_takeaway && item.container_price > 0 && (
              <p className="text-gray-400 text-sm">
                Plato: S/ {(item.unit_price || 0).toFixed(2)} + Envase: S/ {(item.container_price || 0).toFixed(2)}
              </p>
            )}
            
            {item.notes && (
              <p className="text-gray-400 text-sm">
                Nota: {item.notes}
              </p>
            )}
          </div>
        </div>

        {/* Estado y acciones en la derecha extrema */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {/* Indicador de estado */}
          <div>
            {renderStatusIndicator()}
          </div>

          {/* Botón de reintento de impresión - Solo para CREATED sin imprimir */}
          {item.status === 'CREATED' && !item.print_confirmed && onRetryPrint && (
            <button
              onClick={() => onRetryPrint(item.id)}
              disabled={saving}
              className="p-1 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-full transition-colors disabled:opacity-50"
              title="Reintentar impresión"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}

          {/* Icono de cancelar - Solo para CREATED y PREPARING */}
          {canCancel && onCancelItem && (
            <button
              onClick={handleCancelItem}
              disabled={saving}
              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
              title="Cancelar item"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Memoize optimizado para evitar re-renders innecesarios
export default memo(OrderItem, (prevProps, nextProps) => {
  // Comparación más estricta para mejor rendimiento
  const itemChanged = (
    prevProps.item.id !== nextProps.item.id ||
    prevProps.item.status !== nextProps.item.status ||
    prevProps.item.recipe_name !== nextProps.item.recipe_name ||
    prevProps.item.quantity !== nextProps.item.quantity ||
    prevProps.item.total_with_container !== nextProps.item.total_with_container ||
    prevProps.item.print_confirmed !== nextProps.item.print_confirmed
  );

  const propsChanged = (
    prevProps.itemNumber !== nextProps.itemNumber ||
    prevProps.saving !== nextProps.saving ||
    prevProps.onStatusChange !== nextProps.onStatusChange ||
    prevProps.onCancelItem !== nextProps.onCancelItem
  );

  // Solo re-render si hay cambios reales
  return !itemChanged && !propsChanged;
});