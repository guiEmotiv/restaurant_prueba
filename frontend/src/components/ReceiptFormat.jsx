import { useEffect } from 'react';

const ReceiptFormat = ({ order, payment, className = "" }) => {
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getPaymentMethodName = (method) => {
    const methods = {
      'cash': 'EFECTIVO',
      'card': 'TARJETA',
      'yape': 'YAPE',
      'plin': 'PLIN',
      'transfer': 'TRANSFERENCIA'
    };
    return methods[method] || method?.toUpperCase() || 'NO ESPECIFICADO';
  };

  if (!order || !payment) {
    return (
      <div className={`bg-white p-6 rounded-lg shadow ${className}`}>
        <div className="text-center text-gray-500">
          Datos incompletos para mostrar el comprobante
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white p-6 rounded-lg shadow ${className}`}>
      {/* Header del restaurante */}
      <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
        <h1 className="text-xl font-bold text-gray-900">
          EL FOGÓN DE DON SOTO
        </h1>
        <div className="text-center text-gray-600 text-sm mt-1">
          =====================================
        </div>
        <h2 className="text-lg font-semibold text-gray-800 mt-2">
          COMPROBANTE DE PAGO
        </h2>
        <div className="text-center text-gray-600 text-sm">
          =====================================
        </div>
      </div>

      {/* Información de la orden */}
      <div className="mb-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Orden:</span>
          <span className="font-mono">#{order.id}</span>
        </div>
        <div className="flex justify-between">
          <span>Mesa:</span>
          <span>{order.table_number || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>Zona:</span>
          <span>{order.zone_name || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>Mesero:</span>
          <span>{order.waiter || 'Sistema'}</span>
        </div>
        <div className="flex justify-between">
          <span>Fecha:</span>
          <span>{formatDate(payment.created_at || order.created_at)}</span>
        </div>
        <div className="flex justify-between">
          <span>Hora:</span>
          <span className="font-mono">{formatTime(payment.created_at || order.created_at)}</span>
        </div>
      </div>

      {/* Items de la orden */}
      <div className="border-t border-dashed border-gray-300 pt-4 mb-4">
        <div className="text-center text-gray-600 text-sm mb-2">
          -------------------------------------
        </div>
        <h3 className="font-bold text-center mb-2">ITEMS</h3>
        <div className="text-center text-gray-600 text-sm mb-4">
          -------------------------------------
        </div>
        
        {order.items && order.items.length > 0 ? (
          <div className="space-y-3">
            {order.items.map((item, index) => (
              <div key={index} className="text-sm">
                <div className="font-medium">
                  {item.recipe_name || 'Item'}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="font-mono">{item.quantity || 1}x</span>
                  <span className="font-mono">{formatCurrency(item.total_price || 0)}</span>
                </div>
                {item.notes && (
                  <div className="text-xs text-gray-600 mt-1 ml-4">
                    Notas: {item.notes}
                  </div>
                )}
                {item.is_takeaway && (
                  <div className="text-xs text-gray-600 mt-1 ml-4">
                    Para llevar (envase incl.)
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500">
            No hay items registrados
          </div>
        )}
      </div>

      {/* Totales */}
      <div className="border-t border-dashed border-gray-300 pt-4 mb-4">
        <div className="text-center text-gray-600 text-sm mb-2">
          -------------------------------------
        </div>
        
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-mono">{formatCurrency(order.total_amount || 0)}</span>
          </div>
          
          {payment.tax_amount && parseFloat(payment.tax_amount) > 0 && (
            <div className="flex justify-between">
              <span>Impuestos/Servicio:</span>
              <span className="font-mono">{formatCurrency(payment.tax_amount)}</span>
            </div>
          )}
        </div>

        <div className="text-center text-gray-600 text-sm my-2">
          =====================================
        </div>
        
        <div className="flex justify-between font-bold text-lg">
          <span>TOTAL:</span>
          <span className="font-mono">{formatCurrency(payment.amount || order.total_amount || 0)}</span>
        </div>
        
        <div className="text-center text-gray-600 text-sm mt-2">
          =====================================
        </div>
      </div>

      {/* Información del pago */}
      <div className="mb-4">
        <h3 className="font-bold text-sm mb-2">MÉTODO DE PAGO</h3>
        <div className="text-center text-gray-600 text-sm mb-2">
          -------------------------------------
        </div>
        
        <div className="flex justify-between font-bold text-sm">
          <span>{getPaymentMethodName(payment.payment_method)}:</span>
          <span className="font-mono">{formatCurrency(payment.amount)}</span>
        </div>

        {payment.notes && (
          <div className="text-xs text-gray-600 mt-2">
            Notas: {payment.notes}
          </div>
        )}
      </div>

      {/* Pie del comprobante */}
      <div className="text-center border-t border-dashed border-gray-300 pt-4">
        <div className="text-gray-600 text-sm">
          =====================================
        </div>
        <div className="font-bold text-sm mt-2">
          ¡GRACIAS POR SU VISITA!
        </div>
        <div className="text-sm text-gray-600 mt-1">
          Vuelva pronto
        </div>
        <div className="text-gray-600 text-sm mt-2">
          =====================================
        </div>
      </div>

      {/* Estilos para impresión */}
      <style jsx>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .receipt-container, .receipt-container * {
            visibility: visible;
          }
          .receipt-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ReceiptFormat;