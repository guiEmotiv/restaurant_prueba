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
  const [isQZAvailable, setIsQZAvailable] = useState(false);

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

    // Check if QZ Tray is available
    const checkQZAvailability = () => {
      setIsQZAvailable(typeof window.qz !== 'undefined');
    };

    if (id) {
      fetchData();
    }
    
    checkQZAvailability();
    // Check again after a delay in case QZ loads later
    setTimeout(checkQZAvailability, 1000);
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

  // QZ Tray handlers for UTF-8 support
  const handlePrintQZTray = async () => {
    if (!order || !payment || isPrinting) return;
    
    try {
      setIsPrinting(true);
      await bluetoothPrinter.printPaymentReceiptQZ({ order, payment });
      alert('✅ Ticket impreso con caracteres especiales (QZ Tray)');
    } catch (error) {
      console.error('Error printing with QZ Tray:', error);
      alert('Error al imprimir con QZ Tray: ' + error.message + '\n\nAsegúrese de que QZ Tray esté instalado y ejecutándose.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleTestQZTray = async () => {
    if (isTesting) return;
    
    try {
      setIsTesting(true);
      await bluetoothPrinter.printTestQZ();
      alert('✅ Test QZ Tray completado con caracteres especiales');
    } catch (error) {
      console.error('Error testing QZ Tray:', error);
      alert('Error en test QZ Tray: ' + error.message + '\n\nAsegúrese de que QZ Tray esté instalado y ejecutándose.');
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
      <div className="space-y-4">
        {/* Web Bluetooth API (método original) */}
        <div>
          <h3 className="text-lg font-medium mb-3 text-center text-gray-700">Web Bluetooth API (Original)</h3>
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
          <p className="text-sm text-gray-500 text-center mt-2">
            ⚠️ Caracteres especiales pueden no imprimirse correctamente
          </p>
        </div>

        {/* QZ Tray (método mejorado) */}
        <div>
          <h3 className="text-lg font-medium mb-3 text-center text-purple-700">QZ Tray (UTF-8 Completo)</h3>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handlePrintQZTray}
              disabled={isPrinting || !order || !payment || !isQZAvailable}
              className={`px-6 py-3 rounded-lg font-medium ${
                isPrinting || !order || !payment || !isQZAvailable
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {isPrinting ? 'Imprimiendo...' : '🎫 Imprimir QZ Tray'}
            </button>
            
            <button
              onClick={handleTestQZTray}
              disabled={isTesting || !isQZAvailable}
              className={`px-6 py-3 rounded-lg font-medium ${
                isTesting || !isQZAvailable
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              {isTesting ? 'Probando...' : '🔧 Test QZ Tray'}
            </button>
          </div>
          <div className="text-sm text-center mt-2">
            {isQZAvailable ? (
              <p className="text-green-600">✅ QZ Tray disponible - Soporta FOGÓN y ¡ correctamente</p>
            ) : (
              <p className="text-red-600">❌ QZ Tray no detectado - Instale QZ Tray y cargue qz-tray.js</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderReceipt;