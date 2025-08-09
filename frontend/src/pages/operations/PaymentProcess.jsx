import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { 
  ArrowLeft,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  DollarSign,
  Check
} from 'lucide-react';
import { apiService } from '../../services/api';

const PaymentProcess = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const [table, setTable] = useState(null);
  const [orders, setOrders] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, [tableId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tableData, ordersData] = await Promise.all([
        apiService.tables.getById(tableId),
        apiService.orders.getAll()
      ]);
      
      setTable(tableData);
      
      const tableOrders = Array.isArray(ordersData) 
        ? ordersData.filter(order => 
            order.table === parseInt(tableId) && 
            order.status === 'SERVED'
          )
        : [];
      
      setOrders(tableOrders);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const getTotalAmount = () => {
    return orders.reduce((total, order) => total + parseFloat(order.total_amount || 0), 0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const paymentMethods = [
    { id: 'CASH', name: 'Efectivo', icon: Banknote, color: 'bg-green-100 text-green-700 border-green-200' },
    { id: 'CARD', name: 'Tarjeta', icon: CreditCard, color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { id: 'YAPE_PLIN', name: 'Yape/Plin', icon: Smartphone, color: 'bg-purple-100 text-purple-700 border-purple-200' },
    { id: 'TRANSFER', name: 'Transferencia', icon: Building2, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  ];

  const handlePayment = async () => {
    if (!paymentMethod) {
      showError('Selecciona un método de pago');
      return;
    }

    if (orders.length === 0) {
      showError('No hay órdenes para procesar');
      return;
    }

    try {
      setProcessing(true);

      for (const order of orders) {
        // Crear el pago
        await apiService.payments.create({
          order: order.id,
          amount: order.total_amount,
          payment_method: paymentMethod
        });

        // Actualizar el estado de la orden a PAID
        await apiService.orders.updateStatus(order.id, 'PAID');
      }

      showSuccess('Pago procesado exitosamente');
      navigate('/operations');
    } catch (error) {
      console.error('Error processing payment:', error);
      showError('Error al procesar el pago');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-40 px-4 py-3 border-b">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="pt-20 px-3 space-y-4">
          <div className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm p-3 animate-pulse">
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header fijo */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-40 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/operations/table/${tableId}/manage`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          
          <h1 className="text-lg font-bold text-gray-900">Procesar Pago</h1>
          
          <div className="w-10"></div>
        </div>
      </div>

      <div className="pt-20 px-3">
        {/* Resumen del pago */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Total a Pagar</h2>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(getTotalAmount())}</p>
            <p className="text-sm text-gray-500 mt-2">
              {orders.length} cuenta{orders.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Métodos de pago */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Método de Pago</h3>
          <div className="space-y-3">
            {paymentMethods.map((method) => {
              const IconComponent = method.icon;
              const isSelected = paymentMethod === method.id;
              
              return (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${method.color}`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <div className="flex-1 text-left">
                      <h4 className="font-semibold text-gray-900">{method.name}</h4>
                      <p className="text-sm text-gray-500">
                        Pagar con {method.name.toLowerCase()}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detalles de las cuentas */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Detalles del Pago</h3>
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <span className="text-sm text-gray-600">Cuenta #{order.id}</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(order.total_amount)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t-2 border-gray-200">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(getTotalAmount())}
              </span>
            </div>
          </div>
        </div>

        {/* Botón de confirmación */}
        <button
          onClick={handlePayment}
          disabled={!paymentMethod || processing}
          className="w-full py-4 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Procesando...
            </>
          ) : (
            <>
              <CreditCard className="h-5 w-5" />
              Confirmar Pago
            </>
          )}
        </button>

        {/* Advertencia */}
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            Al confirmar el pago, todas las cuentas de esta mesa se marcarán como pagadas y la mesa quedará disponible.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentProcess;