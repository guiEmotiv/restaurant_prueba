
const CartHeader = ({ currentOrder, onClose }) => {
  
  // Log para debug de datos recibidos
  console.log('🔍 [CART-HEADER] Datos recibidos:', {
    currentOrder,
    customer_name: currentOrder?.customer_name,
    party_size: currentOrder?.party_size,
    status: currentOrder?.status,
    hasCurrentOrder: !!currentOrder
  });
  
  // Función para obtener el color del badge según el estado
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'CREATED':
        return 'bg-green-100 text-green-800';
      case 'PREPARING':
        return 'bg-yellow-100 text-yellow-800';
      case 'READY':
        return 'bg-blue-100 text-blue-800';
      case 'SERVED':
        return 'bg-purple-100 text-purple-800';
      case 'PAID':
        return 'bg-gray-100 text-gray-800';
      case 'CANCELED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  // Función para obtener el texto del estado en español
  const getStatusText = (status) => {
    switch (status) {
      case 'CREATED':
        return 'Creado';
      case 'PREPARING':
        return 'Preparando';
      case 'READY':
        return 'Listo';
      case 'SERVED':
        return 'Servido';
      case 'PAID':
        return 'Pagado';
      case 'CANCELED':
        return 'Cancelado';
      default:
        return status || 'Nuevo';
    }
  };

  return (
    <div className="p-6 border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-gray-900">
              {currentOrder ? `Pedido #${currentOrder.id}` : 'Nuevo Pedido'}
            </h2>
            {/* Estado del order oculto para meseros */}
            {false && currentOrder && currentOrder.status && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(currentOrder.status)}`}>
                {getStatusText(currentOrder.status)}
              </span>
            )}
          </div>
          {currentOrder && (
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{currentOrder.customer_name || 'Sin nombre'}</span>
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>{currentOrder.party_size ? `${currentOrder.party_size} personas` : 'Sin cantidad'}</span>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-3 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CartHeader;