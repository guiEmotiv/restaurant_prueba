import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import ReceiptFormat from '../../components/ReceiptFormat';
import bluetoothPrinter from '../../services/bluetoothPrinter';

const OrderReceipt = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const orderResponse = await apiService.orders.getById(id);
        
        setOrder(orderResponse);
        
        // Get payment from order.payments array
        if (orderResponse.payments && orderResponse.payments.length > 0) {
          // Use the most recent payment (last one)
          const latestPayment = orderResponse.payments[orderResponse.payments.length - 1];
          setPayment(latestPayment);
        } else {
          setPayment(null);
        }
      } catch (err) {
        console.error('Error fetching receipt data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  const handlePrintBluetooth = async () => {
    if (!order || !payment || isPrinting) return;
    
    try {
      setIsPrinting(true);
      await bluetoothPrinter.printPaymentReceipt({ order, payment });
    } catch (error) {
      console.error('Error printing receipt:', error);
      alert('Error al imprimir: ' + error.message);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleTestPrinter = async () => {
    if (isTesting) return;
    
    try {
      setIsTesting(true);
      await bluetoothPrinter.printTest();
    } catch (error) {
      console.error('Error testing printer:', error);
      alert('Error al probar impresora: ' + error.message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleBack = () => {
    navigate('/payment-history');
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            ← Volver
          </button>
          <div>
            <h1 className="text-2xl font-bold">Error</h1>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 flex items-center gap-2"
        >
          <span>←</span> Volver
        </button>
        <div>
          <h1 className="text-2xl font-bold">Recibo de Pago</h1>
          <p className="text-gray-600">Orden #{id}</p>
        </div>
      </div>

      {/* Receipt */}
      <div className="max-w-md mx-auto">
        <ReceiptFormat order={order} payment={payment} />
      </div>

      {/* Bluetooth Buttons */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={handlePrintBluetooth}
          disabled={isPrinting || !order || !payment}
          className={`px-6 py-3 rounded-lg font-medium ${
            isPrinting || !order || !payment
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isPrinting ? 'Imprimiendo...' : 'Imprimir Bluetooth'}
        </button>
        
        <button
          onClick={handleTestPrinter}
          disabled={isTesting}
          className={`px-6 py-3 rounded-lg font-medium ${
            isTesting
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {isTesting ? 'Probando...' : 'Probar Impresora'}
        </button>
      </div>
    </div>
  );
};

export default OrderReceipt;