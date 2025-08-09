import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Receipt, Printer, DollarSign, Clock, User } from 'lucide-react';
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

  const handlePrint = () => {
    window.print();
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentMethodLabel = (method) => {
    const methods = {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
      OTHER: 'Otro'
    };
    return methods[method] || method;
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
            onClick={handlePrint}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          
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

      {/* Receipt */}
      <div className="receipt-container max-w-2xl mx-auto">
        <ReceiptFormat order={order} payment={payment} />
      </div>

      {/* Información adicional para web (no se imprime) */}
      <div className="bg-white rounded-lg shadow p-8 max-w-2xl mx-auto no-print">
        {/* Restaurant Header */}
        <div className="text-center mb-8 border-b pb-4">
          <h2 className="text-3xl font-bold text-gray-900">EL FOGÓN DE DON SOTO</h2>
          <p className="text-gray-600">Comprobante de Pago</p>
        </div>

        {/* Order Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-600">Orden</p>
            <p className="font-semibold">#{order.id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Mesa</p>
            <p className="font-semibold">{order.table_number} - {order.zone_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Fecha</p>
            <p className="font-semibold">{formatDate(order.paid_at || order.created_at)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Estado</p>
            <p className="font-semibold text-green-600">Pagado</p>
          </div>
          {order.waiter && (
            <div>
              <p className="text-sm text-gray-600">Atendido por</p>
              <p className="font-semibold">{order.waiter}</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 border-b pb-2">Items</h3>
          <div className="space-y-2">
            {(() => {
              // Agrupar items por nombre de receta y notas
              const groupedItems = order.items?.reduce((acc, item) => {
                const key = `${item.recipe_name}-${item.notes || ''}`;
                if (!acc[key]) {
                  acc[key] = {
                    recipe_name: item.recipe_name,
                    notes: item.notes,
                    unit_price: item.unit_price,
                    total_price: 0,
                    quantity: 0,
                    customizations: item.customizations
                  };
                }
                acc[key].quantity += 1;
                acc[key].total_price += parseFloat(item.total_price);
                return acc;
              }, {}) || {};

              return Object.values(groupedItems).map((item, index) => (
                <div key={index} className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-semibold text-gray-700 mt-0.5">{item.quantity}x</span>
                      <div className="flex-1">
                        <p className="font-medium">{item.recipe_name}</p>
                        {item.notes && (
                          <p className="text-sm text-gray-500 italic">{item.notes}</p>
                        )}
                        {item.customizations?.length > 0 && (
                          <div className="text-sm text-gray-600 mt-1">
                            {item.customizations.map((custom, idx) => (
                              <p key={idx}>+ {custom.ingredient_name}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-medium">{formatCurrency(item.total_price)}</p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Container Sales (Envases) */}
        {order.container_sales?.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">Envases</h3>
            <div className="space-y-2">
              {order.container_sales.map((containerSale, index) => (
                <div key={index} className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-semibold text-gray-700 mt-0.5">{containerSale.quantity}x</span>
                      <div className="flex-1">
                        <p className="font-medium">{containerSale.container_name}</p>
                        <p className="text-sm text-gray-500">Para llevar</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-medium">{formatCurrency(containerSale.total_price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal (Comida):</span>
            <span>{formatCurrency(order.total_amount)}</span>
          </div>
          {order.containers_total && order.containers_total > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Envases:</span>
              <span>{formatCurrency(order.containers_total)}</span>
            </div>
          )}
          {payment?.tax_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">IGV (18%):</span>
              <span>{formatCurrency(payment.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total:</span>
            <span className="text-green-600">{formatCurrency(order.grand_total || payment?.amount || order.total_amount)}</span>
          </div>
        </div>

        {/* Payment Info */}
        {payment && (
          <div className="mt-6 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Información de Pago</h3>
            <div className="text-sm">
              <div>
                <span className="text-gray-600">Método de pago:</span>
                <span className="ml-2 font-medium">{getPaymentMethodLabel(payment.payment_method)}</span>
              </div>
            </div>
            {payment.notes && (
              <div className="mt-2">
                <span className="text-gray-600 text-sm">Notas:</span>
                <p className="text-sm mt-1">{payment.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 pt-4 border-t">
          <p className="text-gray-600">¡Gracias por su preferencia!</p>
          <p className="text-sm text-gray-500 mt-2">
            {new Date().toLocaleString('es-PE')}
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white;
          }
          .bg-white {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default OrderReceipt;