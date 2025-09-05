import { useMemo, useState } from 'react';

const ShoppingCart = ({ 
  isOpen, 
  onToggle, 
  cart, 
  currentOrder, 
  onRemoveFromCart, 
  onSaveOrder, 
  onCancelOrderItem,
  onCloseOrder,
  saving, 
  userRole, 
  getItemStatusColor,
  canCancelItem,
  filterActiveItems 
}) => {
  // Estados para nueva información del pedido
  const [customerName, setCustomerName] = useState('');
  const [partySize, setPartySize] = useState('');

  // Resetear formulario cuando se cierra el carrito
  const handleToggle = () => {
    if (isOpen) {
      setCustomerName('');
      setPartySize('');
    }
    onToggle();
  };

  // Calcular totales
  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => {
      // Para items para llevar, el unit_price ya incluye el costo del envase
      const itemTotal = item.unit_price * item.quantity;
      return total + itemTotal;
    }, 0);
  }, [cart]);

  const orderTotal = useMemo(() => {
    if (!currentOrder?.items) return 0;
    const activeItems = filterActiveItems(currentOrder.items);
    return activeItems.reduce((total, item) => total + parseFloat(item.total_with_container || item.total_price || 0), 0);
  }, [currentOrder?.items, filterActiveItems]);

  const grandTotal = cartTotal + orderTotal;

  const handleSaveOrder = async () => {
    if (!currentOrder && (!customerName.trim() || !partySize.trim())) {
      return;
    }
    
    await onSaveOrder({
      customer_name: customerName.trim() || currentOrder?.customer_name,
      party_size: parseInt(partySize) || currentOrder?.party_size
    });
    
    // Limpiar formulario después de guardar
    setCustomerName('');
    setPartySize('');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" 
        onClick={handleToggle}
      />
      
      {/* Panel lateral */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col">
        
        {/* Header del carrito */}
        <div className="p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">
              {currentOrder ? `Pedido #${currentOrder.id}` : 'Nuevo Pedido'}
            </h2>
            <button
              onClick={handleToggle}
              className="p-3 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Información del cliente - Solo si no hay pedido actual */}
        {!currentOrder && (
          <div className="p-6 bg-blue-50 border-b border-blue-100">
            <h3 className="font-semibold text-blue-900 mb-4 text-lg">Información del Cliente</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-lg font-medium text-blue-700 mb-2">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-4 text-lg border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ingrese el nombre"
                  required
                />
              </div>
              <div>
                <label className="block text-lg font-medium text-blue-700 mb-2">
                  Cantidad de Personas
                </label>
                <input
                  type="number"
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value)}
                  className="w-full p-4 text-lg border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Número de personas"
                  min="1"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {/* Mostrar información del cliente si hay pedido actual */}
        {currentOrder && currentOrder.customer_name && (
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg text-gray-600">Cliente: <span className="font-semibold">{currentOrder.customer_name}</span></p>
                <p className="text-lg text-gray-600 mt-1">Personas: <span className="font-semibold">{currentOrder.party_size}</span></p>
              </div>
            </div>
          </div>
        )}

        {/* Lista de items */}
        <div className="flex-1 flex flex-col min-h-0">
          {(() => {
            const activeItems = currentOrder?.items ? filterActiveItems(currentOrder.items) : [];
            const hasItems = activeItems.length > 0 || cart.length > 0;
            
            return hasItems ? (
              <div className="flex-1 overflow-y-auto">
                {/* Combinar todos los items para renderizado uniforme */}
                {(() => {
                  // Crear lista unificada de todos los items
                  const allItems = [
                    // Items existentes del pedido (si hay)
                    ...activeItems.map((item, index) => ({
                      id: `existing-${item.id || index}`,
                      type: 'existing',
                      name: item.recipe_name || item.recipe?.name,
                      quantity: item.quantity,
                      is_takeaway: item.is_takeaway,
                      notes: item.notes,
                      totalPrice: parseFloat(item.total_with_container || item.total_price || 0),
                      basePrice: parseFloat(item.total_price || 0),
                      containerPrice: item.container_info?.total_price || 0,
                      containerName: item.container_info?.container_name,
                      originalItem: item,
                      canCancel: canCancelItem(item) && userRole !== 'cajeros',
                      status: item.status || 'CREATED'
                    })),
                    // Items del carrito (nuevos)
                    ...cart.map((item, index) => ({
                      id: `cart-${index}`,
                      type: 'cart',
                      name: item.recipe.name,
                      quantity: item.quantity,
                      is_takeaway: item.is_takeaway,
                      notes: item.notes,
                      totalPrice: item.unit_price * item.quantity,
                      basePrice: parseFloat(item.recipe.price || item.recipe.base_price || 0) * item.quantity,
                      containerPrice: (item.container_price || 0) * item.quantity,
                      containerName: null,
                      originalItem: item,
                      cartIndex: index,
                      status: 'NEW' // Los items del carrito son nuevos
                    }))
                  ];

                  return allItems.map((item, index) => {
                    const itemNumber = index + 1;
                    
                    // Determinar color del círculo según el estado
                    const getStatusColor = (status) => {
                      switch(status) {
                        case 'CREATED':
                          return 'bg-green-100 text-green-600';
                        case 'PREPARING':
                          return 'bg-yellow-100 text-yellow-600';
                        case 'SERVED':
                          return 'bg-blue-100 text-blue-600';
                        case 'NEW':
                          return 'bg-gray-100 text-gray-600';
                        default:
                          return 'bg-gray-100 text-gray-600';
                      }
                    };
                    
                    return (
                      <div key={item.id} className="px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          {/* Número del item */}
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center ${getStatusColor(item.status)}`}>
                            {itemNumber}.
                          </div>
                          
                          {/* Info del item */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-medium text-gray-900 truncate">
                                {item.name}
                              </h4>
                              {item.is_takeaway && (
                                <div className="flex items-center bg-orange-100 text-orange-600 p-2 rounded-full" title="Delivery">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="text-lg text-gray-500 mt-1">
                              <p>x{item.quantity} • S/ {item.totalPrice.toFixed(2)}</p>
                              {/* Mostrar desglose de envase solo si es para llevar y hay costo de envase */}
                              {item.is_takeaway && item.containerPrice > 0 && (
                                <p className="text-gray-400 text-sm">
                                  Plato: S/ {item.basePrice.toFixed(2)} + Envase{item.containerName ? ` (${item.containerName})` : ''}: S/ {item.containerPrice.toFixed(2)}
                                </p>
                              )}
                              {item.notes && (
                                <p className="text-gray-400 text-sm">
                                  Nota: {item.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {/* Botón de acción - uniforme para todos */}
                          {item.type === 'existing' && item.canCancel ? (
                            <button
                              onClick={() => onCancelOrderItem(item.originalItem.id)}
                              disabled={saving}
                              className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-500 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
                              title="Cancelar producto"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          ) : item.type === 'cart' ? (
                            <button
                              onClick={() => onRemoveFromCart(item.cartIndex)}
                              disabled={saving}
                              className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-500 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
                              title="Eliminar del carrito"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 text-lg">
                <p>No hay items en el pedido</p>
              </div>
            );
          })()}
        </div>

        {/* Footer con total y botón de acción */}
        <div className="p-6 bg-gray-50 flex-shrink-0">
          {/* Total con estilo minimalista */}
          <div className="bg-white rounded-xl p-6 mb-4 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-lg text-gray-600">Total</span>
              <span className="text-2xl font-bold text-gray-900">
                S/ {grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Botón para guardar/actualizar pedido */}
            {cart.length > 0 && (
              <button
                onClick={handleSaveOrder}
                disabled={saving || (!currentOrder && (!customerName.trim() || !partySize.trim()))}
                className={`w-full py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 font-medium text-lg ${
                  !saving && (currentOrder || (customerName.trim() && partySize.trim()))
                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                    : 'bg-blue-400 text-blue-200 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{currentOrder ? 'Actualizar Pedido' : 'Crear Pedido'}</span>
                  </>
                )}
              </button>
            )}
            
            {/* Botón cerrar cuenta - solo cuando el order está PREPARING y no hay items en carrito */}
            {currentOrder && currentOrder.status === 'PREPARING' && cart.length === 0 && (() => {
              const activeItems = currentOrder?.items ? filterActiveItems(currentOrder.items) : [];
              // Solo mostrar si hay items PREPARING (no cancelados)
              const preparingItems = activeItems.filter(item => item.status === 'PREPARING');
              return preparingItems.length > 0;
            })() && (
              <button
                onClick={() => onCloseOrder(currentOrder.id)}
                disabled={saving}
                className={`w-full py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 font-medium text-lg ${
                  !saving
                    ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                    : 'bg-green-400 text-green-200'
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Cerrar Cuenta</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ShoppingCart;