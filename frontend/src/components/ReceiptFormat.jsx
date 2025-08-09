const ReceiptFormat = ({ order, payment, className }) => {
  // Ultra-safe formatting functions
  const safeFormatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'S/ 0.00';
    const num = Number(amount);
    if (isNaN(num)) return 'S/ 0.00';
    return 'S/ ' + num.toFixed(2);
  };

  const safeFormatDate = (dateStr) => {
    if (!dateStr) return '00/00/0000';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '00/00/0000';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return day + '/' + month + '/' + year;
  };

  const safeFormatTime = (dateStr) => {
    if (!dateStr) return '00:00:00';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '00:00:00';
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    return hours + ':' + minutes + ':' + seconds;
  };

  if (!order) {
    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-center text-gray-500 text-sm">
          No hay datos de la orden
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-center text-gray-500 text-sm">
          No hay datos del pago
        </div>
      </div>
    );
  }

  // Safe values
  const orderId = order.id || '0';
  const tableNumber = order.table_number || 'N/A';
  const waiterName = order.waiter || null;
  const dateStr = payment.created_at || order.created_at || null;
  const items = order.items || [];
  const totalAmount = payment.amount || order.total_amount || 0;
  const hasContainers = order.container_sales && order.container_sales.length > 0;

  // Calcular el total real de los items
  const itemsTotal = items.reduce((total, item) => {
    const price = parseFloat(item.total_price || 0);
    return total + price;
  }, 0);
  
  // Usar el total calculado de items en lugar del payment amount
  const displayTotal = itemsTotal || totalAmount || 0;

  return (
    <div className="bg-white rounded-lg shadow mx-auto" style={{ maxWidth: '320px' }}>
      <div className="p-4 font-mono text-center" style={{fontSize: '12px', lineHeight: '1.3'}}>
        
        {/* Header centrado */}
        <div className="mb-4">
          <h1 className="text-sm font-bold mb-1">EL FOGÓN DE DON SOTO</h1>
          <p className="text-xs">COMPROBANTE</p>
        </div>

        {/* Info básica alineada */}
        <div className="mb-4 text-xs text-left">
          <div className="flex justify-between mb-1">
            <span>Orden:</span>
            <span>#{orderId}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Mesa:</span>
            <span>{tableNumber}</span>
          </div>
          {waiterName && (
            <div className="flex justify-between mb-1">
              <span>Mesero:</span>
              <span>{waiterName}</span>
            </div>
          )}
          <div className="flex justify-between mb-1">
            <span>Fecha:</span>
            <span>{safeFormatDate(dateStr)}</span>
          </div>
          <div className="flex justify-between">
            <span>Hora:</span>
            <span>{safeFormatTime(dateStr)}</span>
          </div>
        </div>

        {/* Línea separadora */}
        <div className="border-t border-gray-400 mb-3"></div>

        {/* Items */}
        <div className="mb-4 text-xs text-left">
          {items.length > 0 ? (
            <div className="space-y-1">
              {items.map((item, index) => {
                const quantity = item.quantity || 1;
                const recipeName = item.recipe_name || 'Item';
                const price = item.total_price || 0;
                const isTakeaway = item.is_takeaway || hasContainers;
                
                return (
                  <div key={index}>
                    <div className="flex justify-between">
                      <span className="flex-1">{quantity}x {recipeName}</span>
                      <span className="ml-2">{safeFormatCurrency(price)}</span>
                    </div>
                    {isTakeaway && (
                      <div className="text-gray-600 ml-2 text-xs">Para llevar</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-gray-500 text-center">Sin items</div>
          )}
        </div>

        {/* Línea separadora antes del total */}
        <div className="border-t border-gray-400 mb-3"></div>

        {/* Total */}
        <div className="mb-4 text-left">
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL:</span>
            <span>{safeFormatCurrency(displayTotal)}</span>
          </div>
        </div>

        {/* Línea separadora antes del footer */}
        <div className="border-t border-gray-400 mb-3"></div>

        {/* Footer centrado */}
        <div className="text-center">
          <div className="text-xs">¡Gracias por su visita!</div>
        </div>
        
      </div>
    </div>
  );
};

export default ReceiptFormat;