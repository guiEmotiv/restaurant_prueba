import React from 'react';

const CartItem = ({ 
  item, 
  itemNumber, 
  onRemoveFromCart, 
  cartIndex,
  saving = false 
}) => {
  
  
  const handleRemoveClick = () => {
    onRemoveFromCart(cartIndex);
  };

  return (
    <div className="px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-4">
        {/* Número del item */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center bg-blue-100 text-blue-700">
          {itemNumber}.
        </div>
        
        {/* Info del item */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-medium text-gray-900 truncate">
              {item.recipe?.name}
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
            <p>x{item.quantity} • S/ {(item.unit_price * item.quantity).toFixed(2)}</p>
            
            {/* Mostrar desglose de envase solo si es para llevar y hay costo de envase */}
            {item.is_takeaway && (item.containerPrice || 0) > 0 && (
              <p className="text-gray-400 text-sm">
                Plato: S/ {(item.unit_price || 0).toFixed(2)} + Envase{item.containerName ? ` (${item.containerName})` : ''}: S/ {(item.containerPrice || 0).toFixed(2)}
              </p>
            )}
            
            {item.notes && (
              <p className="text-gray-400 text-sm">
                Nota: {item.notes}
              </p>
            )}
          </div>
        </div>
        
        {/* Botón para eliminar del carrito */}
        <button
          onClick={handleRemoveClick}
          disabled={saving}
          className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-500 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
          title="Eliminar del carrito"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CartItem;