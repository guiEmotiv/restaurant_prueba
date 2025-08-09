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

  return (
    <div className="bg-white p-4 rounded-lg shadow font-mono" style={{fontSize: '12px', lineHeight: '1.2'}}>
      {/* Header */}
      <div className="text-center mb-3">
        <h1 className="text-sm font-bold">EL FOGÓN DE DON SOTO</h1>
        <p className="text-xs">COMPROBANTE</p>
      </div>

      {/* Info básica */}
      <div className="mb-3 space-y-0.5 text-xs">
        <div className="flex justify-between">
          <span>Orden:</span>
          <span>#{orderId}</span>
        </div>
        <div className="flex justify-between">
          <span>Mesa:</span>
          <span>{tableNumber}</span>
        </div>
        {waiterName && (
          <div className="flex justify-between">
            <span>Mesero:</span>
            <span>{waiterName}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Fecha:</span>
          <span>{safeFormatDate(dateStr)}</span>
        </div>
        <div className="flex justify-between">
          <span>Hora:</span>
          <span>{safeFormatTime(dateStr)}</span>
        </div>
      </div>

      {/* Items */}
      <div className="border-t border-gray-300 pt-2 mb-3">
        {items.length > 0 ? (
          <div className="space-y-1">
            {items.map((item, index) => {
              const quantity = item.quantity || 1;
              const recipeName = item.recipe_name || 'Item';
              const price = item.total_price || 0;
              const isTakeaway = item.is_takeaway || hasContainers;
              
              return (
                <div key={index} className="text-xs">
                  <div className="flex justify-between">
                    <span>{quantity}x {recipeName}</span>
                    <span>{safeFormatCurrency(price)}</span>
                  </div>
                  {isTakeaway && (
                    <div className="text-xs text-gray-600 ml-2">Para llevar</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-gray-500 text-xs">Sin items</div>
        )}
      </div>

      {/* Total */}
      <div className="border-t border-gray-300 pt-2">
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL:</span>
          <span>{safeFormatCurrency(totalAmount)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-3 pt-2 border-t border-gray-300">
        <div className="text-xs">¡Gracias por su visita!</div>
      </div>
    </div>
  );
};

export default ReceiptFormat;