import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import Button from '../../components/common/Button';
import ReceiptFormat from '../../components/ReceiptFormat';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import bluetoothPrinter from '../../services/bluetoothPrinter';

const OrderReceipt = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    loadOrderDetails();
  }, [id]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      const [orderData, paymentsData] = await Promise.all([
        apiService.orders.getById(id),
        apiService.payments.getAll()
      ]);
      
      // Buscar el pago de esta orden
      const orderPayment = paymentsData.find(p => p.order === parseInt(id));
      
      setOrder(orderData);
      setPayment(orderPayment);
    } catch (error) {
      console.error('Error loading order details:', error);
      showError('Error al cargar los detalles de la orden');
      navigate('/payment-history');
    } finally {
      setLoading(false);
    }
  };

  const handleBluetoothPrint = async () => {
    if (!order || !payment) {
      showError('No hay datos de orden o pago para imprimir');
      return;
    }

    try {
      setPrinting(true);
      
      const receiptData = {
        payment_method: payment.payment_method,
        amount: payment.amount,
        tax_amount: payment.tax_amount || '0.00',
        notes: payment.notes || '',
        order: order
      };

      await bluetoothPrinter.printPaymentReceipt(receiptData);
      showSuccess('Comprobante enviado a impresora Bluetooth');
    } catch (error) {
      console.error('Error printing via Bluetooth:', error);
      
      if (error.message.includes('Web Bluetooth no está soportado')) {
        showError('Tu navegador no soporta Bluetooth. Usa Chrome o Edge.');
      } else if (error.message.includes('conexión')) {
        showError('No se pudo conectar con la impresora. Verifica que esté encendida.');
      } else {
        showError(`Error de impresión Bluetooth: ${error.message}`);
      }
    } finally {
      setPrinting(false);
    }
  };

  const handleTestPrint = async () => {
    try {
      setPrinting(true);
      await bluetoothPrinter.printTest();
      showSuccess('Prueba de impresión completada');
    } catch (error) {
      console.error('Error in test print:', error);
      
      if (error.message.includes('Web Bluetooth no está soportado')) {
        showError('Tu navegador no soporta Bluetooth. Usa Chrome o Edge.');
      } else if (error.message.includes('conexión')) {
        showError('No se pudo conectar con la impresora. Verifica que esté encendida y el PIN sea 1234.');
      } else {
        showError(`Error de prueba de impresión: ${error.message}`);
      }
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
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
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/payment-history')}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recibo de Pago</h1>
            <p className="text-gray-600">Orden #{order.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleBluetoothPrint}
            disabled={printing}
            className="flex items-center gap-2"
          >
            {printing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Imprimiendo...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                Imprimir Bluetooth
              </>
            )}
          </Button>
          
          <Button
            onClick={handleTestPrint}
            disabled={printing}
            variant="outline"
            className="flex items-center gap-2"
          >
            {printing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                Probando...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                Probar Impresora
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Receipt - Solo el formato compacto */}
      <div className="max-w-md mx-auto">
        <ReceiptFormat order={order} payment={payment} />
      </div>
    </div>
  );
};

export default OrderReceipt;