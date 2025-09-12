import { useState } from 'react';
import { useToast } from '../../../../contexts/ToastContext';
import { apiService } from '../../../../services/api';

const CancelOrderButton = ({ 
  currentOrder, 
  onOrderCanceled,
  saving = false 
}) => {
  const { showError, showSuccess } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [canceling, setCanceling] = useState(false);

  const handleCancelOrder = async () => {
    if (!cancellationReason.trim()) {
      showError('El motivo de cancelación es requerido');
      return;
    }

    setCanceling(true);
    
    try {
      console.log(`[CANCEL-ORDER] 🚫 Cancelando Order #${currentOrder.id} con motivo: "${cancellationReason}"`);
      
      await apiService.orders.cancel(currentOrder.id, cancellationReason);
      
      showSuccess(`Pedido #${currentOrder.id} cancelado exitosamente`);
      console.log(`[CANCEL-ORDER] ✅ Order #${currentOrder.id} cancelada - Mesa liberada`);
      
      // Cerrar modal
      setShowModal(false);
      setCancellationReason('');
      
      // Notificar al componente padre
      if (onOrderCanceled) {
        onOrderCanceled(currentOrder.id);
      }
      
    } catch (error) {
      console.error(`[CANCEL-ORDER] ❌ Error cancelando Order #${currentOrder.id}:`, error);
      showError(error.response?.data?.error || 'Error al cancelar el pedido');
    } finally {
      setCanceling(false);
    }
  };

  return (
    <>
      {/* Botón Cancelar Pedido */}
      <button
        onClick={() => setShowModal(true)}
        disabled={saving || canceling}
        className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {canceling ? 'Cancelando...' : 'Cancelar Pedido'}
      </button>

      {/* Modal de confirmación */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Cancelar Pedido #{currentOrder.id}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Esta acción cancelará todo el pedido y liberará la mesa
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              <div className="mb-4">
                <label htmlFor="cancellationReason" className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de cancelación *
                </label>
                <textarea
                  id="cancellationReason"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows="3"
                  placeholder="Ej: Todos los items fueron cancelados por el cliente"
                  disabled={canceling}
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800">
                      <strong>¡Atención!</strong> Esta acción no se puede deshacer. El pedido será cancelado completamente.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setCancellationReason('');
                }}
                disabled={canceling}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={canceling || !cancellationReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {canceling ? 'Cancelando...' : 'Confirmar Cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CancelOrderButton;