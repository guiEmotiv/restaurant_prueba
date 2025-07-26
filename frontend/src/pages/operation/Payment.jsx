import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, DollarSign, Receipt, CheckCircle } from 'lucide-react';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Payment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState({
    payment_method: 'CASH',
    amount_received: '',
    include_igv: false,
    notes: ''
  });

  useEffect(() => {
    loadOrder();
  }, [id]);

  // Inicializar monto recibido cuando se cargue la orden
  useEffect(() => {
    if (order && !paymentData.amount_received) {
      const baseAmount = parseFloat(order?.total_amount) || 0;
      console.log('Initializing amount received:', baseAmount);
      setPaymentData(prev => ({
        ...prev,
        amount_received: baseAmount.toFixed(2)
      }));
    }
  }, [order]);

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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    console.log('Input change:', { name, value, type, checked });
    
    if (name === 'include_igv' && order) {
      // Actualizar inmediatamente el monto recibido cuando cambie el IGV
      const baseAmount = parseFloat(order?.total_amount) || 0;
      const tax = checked ? baseAmount * 0.18 : 0;
      const newAmount = baseAmount + tax;
      
      setPaymentData(prev => ({
        ...prev,
        [name]: checked,
        amount_received: newAmount.toFixed(2)
      }));
    } else {
      setPaymentData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleProcessPayment = async () => {
    const baseAmount = parseFloat(order?.total_amount) || 0;
    const totalWithTax = calculateTotalWithTax();
    const amountReceived = parseFloat(paymentData.amount_received) || 0;
    
    console.log('Payment Debug:', {
      baseAmount,
      totalWithTax,
      amountReceived,
      include_igv: paymentData.include_igv,
      tax: calculateTax()
    });
    
    if (!paymentData.amount_received || amountReceived <= 0) {
      showError('El monto recibido debe ser mayor a 0');
      return;
    }

    // Validar que el monto recibido sea al menos igual al monto requerido
    // Usar Math.round para evitar problemas de precisión de decimales
    const amountReceivedCents = Math.round(amountReceived * 100);
    const baseAmountCents = Math.round(baseAmount * 100);
    const totalWithTaxCents = Math.round(totalWithTax * 100);
    
    if (paymentData.include_igv) {
      // Con IGV: permitir pagar exactamente el total con IGV o más
      if (amountReceivedCents < totalWithTaxCents) {
        showError(`El monto recibido debe ser al menos ${totalWithTax.toFixed(2)} (incluye IGV)`);
        return;
      }
    } else {
      // Sin IGV: permitir pagar exactamente el monto base o más
      if (amountReceivedCents < baseAmountCents) {
        showError(`El monto recibido debe ser al menos ${baseAmount.toFixed(2)}`);
        return;
      }
    }

    setProcessing(true);
    try {
      // Crear el pago con los campos correctos según el backend
      const paymentPayload = {
        order: order.id,
        payment_method: paymentData.payment_method,
        tax_amount: paymentData.include_igv ? calculateTax().toFixed(2) : '0.00',
        amount: (paymentData.include_igv ? totalWithTax : baseAmount).toFixed(2),
        notes: paymentData.notes || ''
      };

      console.log('Payment payload:', paymentPayload);
      await apiService.payments.create(paymentPayload);
      
      // No actualizamos el estado aquí porque el backend lo hace automáticamente
      
      showSuccess('Pago procesado exitosamente');
      navigate('/payment-history');
    } catch (error) {
      console.error('Error processing payment:', error);
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.error || 
                          (error.response?.data && typeof error.response.data === 'object' ? 
                            JSON.stringify(error.response.data) : 
                            error.message);
      showError('Error al procesar el pago: ' + errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount || 0);
  };

  const calculateTax = () => {
    if (!paymentData.include_igv) return 0;
    const baseAmount = parseFloat(order?.total_amount) || 0;
    return baseAmount * 0.18; // IGV 18%
  };

  const calculateTotalWithTax = () => {
    const baseAmount = parseFloat(order?.total_amount) || 0;
    const tax = calculateTax();
    return baseAmount + tax;
  };

  const calculateChange = () => {
    const received = parseFloat(paymentData.amount_received) || 0;
    const total = calculateTotalWithTax();
    return Math.max(0, received - total);
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.recipe_name}
                    {item.notes && (
                      <span className="text-gray-500 italic"> ({item.notes})</span>
                    )}
                  </span>
                  <span className="font-medium">{formatCurrency(item.total_price)}</span>
                </div>
              ))}
            </div>
            
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">Subtotal:</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
              
              {paymentData.include_igv && (
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>IGV (18%):</span>
                  <span>{formatCurrency(calculateTax())}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                <span>Total a pagar:</span>
                <span className="text-green-600">{formatCurrency(calculateTotalWithTax())}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Formulario de Pago */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Información de Pago
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago
              </label>
              <select
                name="payment_method"
                value={paymentData.payment_method}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="YAPE_PLIN">Yape/Plin</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="include_igv"
                  checked={paymentData.include_igv}
                  onChange={handleInputChange}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Incluir IGV (18%)</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Recibido *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400 font-medium">S/</span>
                </div>
                <input
                  type="number"
                  name="amount_received"
                  value={paymentData.amount_received}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas (Opcional)
              </label>
              <textarea
                name="notes"
                value={paymentData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Ej: Cliente pagó con billete de 100"
              />
            </div>


            <div className="pt-4">
              <Button
                onClick={handleProcessPayment}
                disabled={processing || !paymentData.amount_received}
                className="w-full flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Procesar Pago
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;