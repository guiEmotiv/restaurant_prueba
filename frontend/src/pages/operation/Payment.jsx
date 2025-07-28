import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Split, Receipt, DollarSign } from 'lucide-react';
import Button from '../../components/common/Button';
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);

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
        // Pago completo
        const paymentPayload = {
          order: order.id,
          payment_method: splits[0].payment_method,
          tax_amount: splits[0].tax_amount || '0.00',
          amount: splits[0].amount.toFixed(2),
          payer_name: splits[0].payer_name || '',
          notes: splits[0].notes || ''
        };
        await apiService.payments.create(paymentPayload);
        showSuccess('Pago procesado exitosamente');
      }
      
      setShowPaymentModal(false);
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

  const formatCurrency = (amount) => {
    const value = parseFloat(amount) || 0;
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Orden no encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          onClick={() => navigate('/payments')}
          variant="secondary"
          size="sm"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procesar Pago</h1>
          <p className="text-gray-600">Orden #{order.id} - Mesa {order.table_number}</p>
        </div>
      </div>

      {/* Resumen de la Orden */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Resumen de la Orden
        </h2>
        
        <div className="space-y-4">
          <div className="flex justify-between py-2 border-b">
            <span className="font-medium">Mesa:</span>
            <span>{order.table_number} - {order.zone_name}</span>
          </div>
          
          <div className="space-y-2">
            <h3 className="font-medium text-gray-700">Items:</h3>
            {order.items?.map((item, index) => (
              <div key={index} className="flex justify-between text-sm py-2 border-b border-gray-100">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{item.recipe_name}</div>
                  {item.notes && (
                    <div className="text-gray-500 italic text-xs mt-1">Notas: {item.notes}</div>
                  )}
                  {item.customizations_count > 0 && (
                    <div className="text-blue-600 text-xs mt-1">
                      {item.customizations_count} personalización(es)
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatCurrency(item.total_price)}</div>
                  <div className="text-xs text-gray-500">{item.status}</div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total a pagar:</span>
              <span className="text-green-600">{formatCurrency(order.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Opciones de Pago */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 text-center">
          Seleccione una opción de pago
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pago Completo */}
          <Button
            onClick={() => setShowPaymentModal(true)}
            className="h-24 flex flex-col items-center justify-center gap-2 text-lg"
            disabled={processing}
          >
            <CreditCard className="h-8 w-8" />
            <div className="text-center">
              <div className="font-semibold">Pago Completo</div>
              <div className="text-sm opacity-90">{formatCurrency(order.total_amount)}</div>
            </div>
          </Button>
          
          {/* Dividir Cuenta */}
          <Button
            onClick={() => setShowPaymentModal(true)}
            variant="secondary"
            className="h-24 flex flex-col items-center justify-center gap-2 text-lg"
            disabled={processing}
          >
            <Split className="h-8 w-8" />
            <div className="text-center">
              <div className="font-semibold">Dividir Cuenta</div>
              <div className="text-sm opacity-75">Pagos parciales</div>
            </div>
          </Button>
        </div>
      </div>

      {/* Modal unificado de pagos */}
      <SplitPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSubmit={handlePayment}
        order={order}
        processing={processing}
      />
    </div>
  );
};

export default Payment;