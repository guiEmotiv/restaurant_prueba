import { useState } from 'react';
import { X, CreditCard, DollarSign, Printer } from 'lucide-react';
import Button from '../common/Button';
import bluetoothPrinter from '../../services/bluetoothPrinter';
import { useToast } from '../../contexts/ToastContext';

const PaymentModal = ({ isOpen, onClose, onSubmit, order }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    payment_method: 'CASH',
    tax_amount: '0.00',
    notes: ''
  });
  const [printing, setPrinting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const paymentData = {
      ...formData,
      amount: parseFloat(order.total_amount) + parseFloat(formData.tax_amount),
      tax_amount: parseFloat(formData.tax_amount)
    };
    
    // Ejecutar el callback de pago original
    const paymentResult = await onSubmit(paymentData);
    
    // Si el pago fue exitoso, intentar imprimir
    if (paymentResult !== false) {
      try {
        await printPaymentReceipt(paymentData);
      } catch (printError) {
        // No bloqueamos el flujo si falla la impresión
      }
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const calculateTotal = () => {
    return parseFloat(order.total_amount) + parseFloat(formData.tax_amount || 0);
  };

  const printPaymentReceipt = async (paymentData) => {
    try {
      setPrinting(true);
      
      const receiptData = {
        ...paymentData,
        order: order,
        tax_amount: paymentData.tax_amount || '0.00'
      };

      await bluetoothPrinter.printPaymentReceipt(receiptData);
      showSuccess('Comprobante impreso exitosamente');
    } catch (error) {
      if (error.message.includes('Web Bluetooth no está soportado')) {
        showError('Tu navegador no soporta Bluetooth. Usa Chrome o Edge.');
      } else if (error.message.includes('conexión')) {
        showError('No se pudo conectar con la impresora. Verifica que esté encendida.');
      } else {
        showError(`Error de impresión: ${error.message}`);
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
      if (error.message.includes('Web Bluetooth no está soportado')) {
        showError('Tu navegador no soporta Bluetooth. Usa Chrome o Edge.');
      } else if (error.message.includes('conexión')) {
        showError('No se pudo conectar con la impresora. Verifica que esté encendida y el PIN sea 1234.');
      } else {
        showError(`Error de impresión: ${error.message}`);
      }
    } finally {
      setPrinting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Procesar Pago
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Resumen de la Orden</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Orden #{order.id}</span>
                <span className="font-medium">Mesa {order.table_number || order.table}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{formatCurrency(order.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Impuestos/Servicios:</span>
                <span className="font-medium">
                  {formatCurrency(formData.tax_amount || 0)}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900">Total a Pagar:</span>
                  <span className="font-bold text-lg text-green-600">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Método de Pago
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleChange('payment_method', 'CASH')}
                className={`p-4 border-2 rounded-lg flex flex-col items-center transition-colors ${
                  formData.payment_method === 'CASH'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <DollarSign className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Efectivo</span>
              </button>
              
              <button
                type="button"
                onClick={() => handleChange('payment_method', 'CARD')}
                className={`p-4 border-2 rounded-lg flex flex-col items-center transition-colors ${
                  formData.payment_method === 'CARD'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CreditCard className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Tarjeta</span>
              </button>
            </div>
          </div>

          {/* Tax/Service Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Impuestos/Servicio (S/)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.tax_amount}
              onChange={(e) => handleChange('tax_amount', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas (Opcional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Notas del pago..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="success" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Procesar Pago
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;