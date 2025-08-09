import { useEffect } from 'react';

const ReceiptFormat = ({ order, payment, className = "" }) => {
  
  const formatCurrency = (amount) => {
    // Convert to number and handle edge cases
    const numAmount = parseFloat(amount) || 0;
    return `S/ ${numAmount.toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    try {
      if (!dateString) return new Date().toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      
      const date = new Date(dateString);
      return date.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      });
    } catch (error) {
      return new Date().toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  };

  const formatTime = (dateString) => {
    try {
      const date = dateString ? new Date(dateString) : new Date();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    } catch (error) {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }
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
    <div className={`bg-white p-4 rounded-lg shadow font-mono ${className}`} style={{fontSize: '12px', lineHeight: '1.2'}}>
      {/* Header compacto */}
      <div className="text-center mb-3">
        <h1 className="text-sm font-bold">EL FOGÓN DE DON SOTO</h1>
        <p className="text-xs">COMPROBANTE</p>
      </div>

      {/* Información básica - compacta */}
      <div className="mb-3 space-y-0.5 text-xs">
        <div className="flex justify-between">
          <span>Orden:</span>
          <span>#{order.id}</span>
        </div>
        <div className="flex justify-between">
          <span>Mesa:</span>
          <span>{order.table_number || 'N/A'}</span>
        </div>
        {order.waiter && (
          <div className="flex justify-between">
            <span>Mesero:</span>
            <span>{order.waiter}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Fecha:</span>
          <span>{formatDate(payment.created_at || order.created_at)}</span>
        </div>
        <div className="flex justify-between">
          <span>Hora:</span>
          <span>{formatTime(payment.created_at || order.created_at)}</span>
        </div>
      </div>

      {/* Items - formato compacto */}
      <div className="border-t border-gray-300 pt-2 mb-3">
        {order.items && order.items.length > 0 ? (
          <div className="space-y-1">
            {order.items.map((item, index) => (
              <div key={index} className="text-xs">
                <div className="flex justify-between">
                  <span>{(item.quantity || 1)}x {item.recipe_name || 'Item'}</span>
                  <span>{formatCurrency(item.total_price)}</span>
                </div>
                {(item.is_takeaway || (order.container_sales && order.container_sales.length > 0)) && (
                  <div className="text-xs text-gray-600 ml-2">Para llevar</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 text-xs">Sin items</div>
        )}
      </div>

      {/* Total - solo total, sin subtotales */}
      <div className="border-t border-gray-300 pt-2">
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL:</span>
          <span>{formatCurrency(payment?.amount || order?.total_amount)}</span>
        </div>
      </div>

      {/* Footer compacto */}
      <div className="text-center mt-3 pt-2 border-t border-gray-300">
        <div className="text-xs">¡Gracias por su visita!</div>
      </div>
    </div>
  );
};

export default ReceiptFormat;