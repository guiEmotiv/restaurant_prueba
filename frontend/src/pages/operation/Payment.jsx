import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SplitPaymentModal from '../../components/orders/SplitPaymentModal';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Payment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const orderData = await apiService.orders.getById(id);
      
      if (orderData.status !== 'SERVED') {
        showError('Solo se pueden procesar pagos de órdenes entregadas');
        navigate('/payments');
        return;
      }
      
      setOrder(orderData);
    } catch (error) {
      console.error('Error loading order:', error);
      showError('Error al cargar la orden');
      navigate('/payments');
    } finally {
      setLoading(false);
    }
  };


  const handlePayment = async (splits, isSplit) => {
    setProcessing(true);
    try {
      if (isSplit) {
        // Usar el endpoint de pagos divididos
        await apiService.orders.splitPayment(order.id, { splits });
        showSuccess(`Pagos divididos procesados exitosamente (${splits.length} pagos)`);
      } else {
        // Pago completo usando el endpoint tradicional
        const paymentPayload = {
          order: order.id,
          payment_method: splits[0].payment_method,
          tax_amount: splits[0].tax_amount || '0.00',
          amount: splits[0].amount.toFixed(2),
          payer_name: splits[0].payer_name,
          notes: splits[0].notes || ''
        };
        await apiService.payments.create(paymentPayload);
        showSuccess('Pago procesado exitosamente');
      }
      
      navigate('/payment-history');
    } catch (error) {
      console.error('Error processing payment:', error);
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.error || 
                          error.message;
      showError('Error al procesar el pago: ' + errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-center text-gray-600">Cargando orden...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <p className="text-center text-gray-600">Orden no encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <SplitPaymentModal
      isOpen={true}
      onClose={() => navigate('/payments')}
      onSubmit={handlePayment}
      order={order}
      processing={processing}
    />
  );
};

export default Payment;