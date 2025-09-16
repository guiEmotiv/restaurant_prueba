import { useState } from 'react';
import { apiService } from '../../../../../../services/api';
import { useToast } from '../../../../../../contexts/ToastContext';
import CancelOrderButton from '../../CancelOrderButton';

const OrderActions = ({
  cart,
  currentOrder,
  customerName,
  partySize,
  onSaveOrder,
  onUpdateCurrentOrder,
  onCloseOrder,
  onNavigateToZones,
  onOrderCanceled,
  saving = false,
  // Permission props
  userRole
}) => {
  const { showSuccess, showError } = useToast();
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  
  // Verificar si todos los OrderItems NO CANCELADOS están en PREPARING
  const activeItems = currentOrder?.items?.filter(item => item.status !== 'CANCELED') || [];
  const allItemsInPreparing = activeItems.length > 0 && 
    activeItems.every(item => item.status === 'PREPARING');

  // Verificar si todos los OrderItems están CANCELED (y no hay items en el carrito)
  const allItemsAreCanceled = currentOrder?.items?.length > 0 &&
    activeItems.length === 0 &&
    cart.length === 0;

  // Verificar si el usuario puede cancelar pedidos completos (solo administradores)
  const canCancelOrder = userRole === 'administradores';

  // Función para manejar confirmación de cerrar pedido
  const handleCloseOrderConfirm = () => {
    console.log('🔴 [ORDER-ACTIONS] Cerrando pedido confirmado:', {
      currentOrderId: currentOrder?.id,
      onCloseOrderAvailable: !!onCloseOrder,
      allItemsInPreparing,
      cartLength: cart.length
    });

    if (onCloseOrder && currentOrder) {
      onCloseOrder(currentOrder.id);
    }
    setShowCloseConfirmModal(false);
  };

  // LOG: Estado de condiciones para botones
  console.log('🟦 [ORDER-ACTIONS] RENDER - Estado de condiciones para botones:', {
    hasCurrentOrder: !!currentOrder,
    currentOrderId: currentOrder?.id,
    hasOrderItems: currentOrder?.items?.length > 0,
    totalItemCount: currentOrder?.items?.length || 0,
    activeItemCount: activeItems.length,
    canceledItemCount: (currentOrder?.items?.length || 0) - activeItems.length,
    allItemsInPreparing,
    allItemsAreCanceled,
    cartLength: cart.length,
    cartEmpty: cart.length === 0,
    shouldShowCloseButton: !!(activeItems.length > 0 && allItemsInPreparing && cart.length === 0),
    shouldShowCancelOrderButton: allItemsAreCanceled && canCancelOrder,
    // 🔐 Permission debugging
    userRole,
    canCancelOrder,
    isAdmin: userRole === 'administradores',
    allItemStatuses: currentOrder?.items?.map(item => ({ id: item.id, status: item.status })),
    activeItemStatuses: activeItems.map(item => ({ id: item.id, status: item.status })),
    timestamp: new Date().toISOString()
  });
  
  // Determinar el texto del botón según el contexto
  const isUpdatingExistingOrder = currentOrder && currentOrder.id && cart.length > 0;
  const buttonText = isUpdatingExistingOrder ? 'Actualizar Pedido' : 'Crear Pedido';
  
  // Determinar si se puede guardar - Para actualizar no necesitamos customerName/partySize
  // Convertir partySize a string para poder usar trim()
  const partySizeStr = String(partySize || '');
  const customerNameStr = String(customerName || '');
  
  const canSave = cart.length > 0 && (
    isUpdatingExistingOrder || (customerNameStr.trim() && partySizeStr.trim())
  );
  
  
  // Handler para crear/actualizar pedido
  const handleSaveOrder = () => {
    onSaveOrder({
      customerName: customerNameStr.trim(),
      partySize: partySizeStr.trim()
    });
  };




  return (
    <div className="p-6 space-y-4">
      
      {/* Crear/Actualizar Pedido */}
      {cart.length > 0 && (
        <button
          onClick={handleSaveOrder}
          disabled={saving || !canSave}
          className={`w-full py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 font-medium text-lg ${
            !saving && canSave
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
            <span>{buttonText}</span>
          )}
        </button>
      )}

      
      {/* Cerrar Pedido - Solo mostrar si TODOS los items activos están en PREPARING Y NO HAY ITEMS NUEVOS */}
      {activeItems.length > 0 && allItemsInPreparing && cart.length === 0 && (
        <button
          onClick={() => setShowCloseConfirmModal(true)}
          disabled={saving}
          className={`w-full py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 font-medium text-lg ${
            !saving
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              : 'bg-blue-400 text-blue-200 cursor-not-allowed'
          }`}
        >
          <span>Cerrar Pedido</span>
        </button>
      )}
      {/* Cancelar Pedido Completo - Solo para administradores cuando todos los items están cancelados */}
      {allItemsAreCanceled && canCancelOrder && (
        <CancelOrderButton
          currentOrder={currentOrder}
          onOrderCanceled={onOrderCanceled}
          saving={saving}
        />
      )}





      {/* Modal de confirmación para cerrar pedido */}
      {showCloseConfirmModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // Solo cerrar si se hace click en el backdrop, no en el modal
            if (e.target === e.currentTarget) {
              setShowCloseConfirmModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                ¿Cerrar el Pedido?
              </h3>

              <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                Estás a punto de <strong>cerrar el pedido #{currentOrder?.id}</strong>.
                <br />
                Esta acción marcará el pedido como <strong>completado</strong> y liberará la mesa.
                <br /><br />
                <span className="text-amber-600 font-medium">¿Estás seguro de continuar?</span>
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCloseConfirmModal(false)}
                  className="flex-1 py-3 px-4 rounded-lg transition-colors duration-200 bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleCloseOrderConfirm}
                  disabled={saving}
                  className={`flex-1 py-3 px-4 rounded-lg transition-colors duration-200 font-medium ${
                    !saving
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-blue-400 text-blue-200 cursor-not-allowed'
                  }`}
                >
                  {saving ? 'Cerrando...' : 'Sí, Cerrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderActions;