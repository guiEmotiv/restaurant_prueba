import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Split, Receipt, CheckCircle, X, AlertTriangle, Printer } from 'lucide-react';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import bluetoothPrinter from '../../services/bluetoothPrinter';

const Payment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { hasPermission } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMode, setPaymentMode] = useState(null); // null, 'full', 'split'
  const [paymentData, setPaymentData] = useState({
    payment_method: 'CASH',
    notes: ''
  });
  const [splits, setSplits] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [paidItems, setPaidItems] = useState(new Set()); // Items ya pagados parcialmente
  const [currentSplit, setCurrentSplit] = useState({
    payment_method: 'CASH',
    items: [],
    amount: 0,
    notes: ''
  });
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    // Verificar permisos - solo administradores pueden procesar pagos
    if (!hasPermission('canManagePayments')) {
      showError('No tienes permisos para procesar pagos. Solo administradores pueden realizar esta acción.');
      navigate('/orders');
      return;
    }
    loadOrder();
  }, [id, hasPermission]);

  // Cargar items ya pagados cuando se carga la orden
  useEffect(() => {
    if (order) {
      console.log('Order loaded:', order);
      
      // Inicializar selectedItems con todos los items como null (no asignados)
      const itemsMap = {};
      if (order.items) {
        order.items.forEach(item => {
          itemsMap[item.id] = null;
        });
        console.log('Initialized selectedItems:', itemsMap);
      }
      setSelectedItems(itemsMap);
      
      // Verificar items pagados
      const paidItemIds = new Set();
      if (order.payments && Array.isArray(order.payments)) {
        console.log('Payments found:', order.payments.length, 'payments');
        order.payments.forEach((payment, paymentIndex) => {
          console.log(`Payment ${paymentIndex}:`, {
            id: payment.id,
            amount: payment.amount,
            payment_items_count: payment.payment_items?.length || 0
          });
          if (payment.payment_items && Array.isArray(payment.payment_items)) {
            payment.payment_items.forEach((paymentItem, itemIndex) => {
              console.log(`  PaymentItem ${itemIndex}:`, {
                order_item: paymentItem.order_item,
                amount: paymentItem.amount
              });
              // paymentItem.order_item es el ID del order item
              paidItemIds.add(paymentItem.order_item);
            });
          }
        });
      } else {
        console.log('No payments found or payments is not an array');
      }
      
      console.log('Paid items:', Array.from(paidItemIds));
      setPaidItems(paidItemIds);
    }
  }, [order]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const orderData = await apiService.orders.getById(id);
      
      // Verificar que todos los items estén servidos antes de permitir pago
      const allItemsServed = orderData.items && orderData.items.length > 0 && 
        orderData.items.every(item => item.status === 'SERVED');
      
      if (!allItemsServed) {
        showError('Solo se pueden procesar pagos cuando todos los items han sido entregados');
        navigate('/orders');
        return;
      }
      
      setOrder(orderData);
    } catch (error) {
      console.error('Error loading order:', error);
      showError('Error al cargar la orden');
      navigate('/payments');
    } finally {
      setLoading(false);
    }
  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFullPayment = async () => {
    const orderTotal = parseFloat(order?.total_amount) || 0;
    
    if (orderTotal <= 0) {
      showError('El total de la orden debe ser mayor a 0');
      return;
    }

    setProcessing(true);
    try {
      const paymentPayload = {
        order: order.id,
        payment_method: paymentData.payment_method,
        tax_amount: '0.00',
        amount: orderTotal.toFixed(2),
        notes: paymentData.notes || ''
      };

      await apiService.payments.create(paymentPayload);
      showSuccess('Pago procesado exitosamente');

      // Intentar imprimir comprobante
      try {
        await printPaymentReceipt(paymentPayload);
      } catch (printError) {
        console.error('Error imprimiendo:', printError);
        // No bloqueamos el flujo si falla la impresión
        showError('Pago exitoso, pero falló la impresión del comprobante');
      }

      navigate('/orders');
    } catch (error) {
      console.error('Error processing payment:', error);
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.error || 
                          error.message;
      showError('Error al procesar el pago: ' + errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleSplitPayment = async () => {
    if (splits.length === 0) {
      showError('Debe agregar al menos un pago dividido');
      return;
    }

    const formattedSplits = splits.map(split => ({
      items: split.items.map(item => item.id),
      payment_method: split.payment_method,
      amount: parseFloat(split.amount) || 0,
      notes: split.notes
    }));

    setProcessing(true);
    try {
      await apiService.orders.splitPayment(order.id, { splits: formattedSplits });
      showSuccess(`Pagos divididos procesados exitosamente (${splits.length} pagos)`);

      // Intentar imprimir comprobantes divididos
      try {
        await printSplitPaymentReceipts(splits);
      } catch (printError) {
        console.error('Error imprimiendo:', printError);
        // No bloqueamos el flujo si falla la impresión
        showError('Pagos exitosos, pero falló la impresión de comprobantes');
      }

      navigate('/orders');
    } catch (error) {
      console.error('Error processing payment:', error);
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.error || 
                          error.message;
      showError('Error al procesar el pago: ' + errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const toggleItemSelection = (itemId) => {
    // Verificar si el item ya está pagado parcialmente
    if (paidItems.has(itemId)) {
      showError('Este item ya ha sido pagado parcialmente');
      return;
    }

    // Verificar si ya está asignado a otro split
    if (selectedItems[itemId] !== null) {
      return;
    }

    const item = order.items.find(i => i.id === itemId);
    if (!item) return;
    
    const isSelected = currentSplit.items.some(i => i.id === itemId);
    const itemPrice = parseFloat(item.total_price) || 0;
    
    if (isSelected) {
      setCurrentSplit(prev => ({
        ...prev,
        items: prev.items.filter(i => i.id !== itemId),
        amount: Math.max(0, prev.amount - itemPrice)
      }));
    } else {
      setCurrentSplit(prev => ({
        ...prev,
        items: [...prev.items, item],
        amount: prev.amount + itemPrice
      }));
    }
  };

  const addSplit = () => {
    if (currentSplit.items.length === 0) {
      showError('Debe seleccionar al menos un item');
      return;
    }

    const newSelectedItems = { ...selectedItems };
    currentSplit.items.forEach(item => {
      newSelectedItems[item.id] = splits.length;
    });
    setSelectedItems(newSelectedItems);

    setSplits([...splits, { ...currentSplit, id: Date.now() }]);
    
    setCurrentSplit({
      payment_method: 'CASH',
      items: [],
      amount: 0,
      notes: ''
    });
  };

  const removeSplit = (splitIndex) => {
    const newSelectedItems = { ...selectedItems };
    Object.entries(selectedItems).forEach(([itemId, assignedSplit]) => {
      if (assignedSplit === splitIndex) {
        newSelectedItems[itemId] = null;
      } else if (assignedSplit > splitIndex) {
        newSelectedItems[itemId] = assignedSplit - 1;
      }
    });
    setSelectedItems(newSelectedItems);

    setSplits(splits.filter((_, idx) => idx !== splitIndex));
  };

  // Funciones de impresión
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
      console.error('Error printing receipt:', error);
      
      if (error.message.includes('Web Bluetooth no está soportado')) {
        showError('Tu navegador no soporta Bluetooth. Usa Chrome o Edge.');
      } else if (error.message.includes('conexión')) {
        showError('No se pudo conectar con la impresora. Verifica que esté encendida.');
      } else {
        showError(`Error de impresión: ${error.message}`);
      }
      
      throw error;
    } finally {
      setPrinting(false);
    }
  };

  const printSplitPaymentReceipts = async (splitPayments) => {
    try {
      setPrinting(true);
      await bluetoothPrinter.printSplitPaymentReceipt(order, splitPayments);
      showSuccess(`${splitPayments.length} comprobantes impresos exitosamente`);
    } catch (error) {
      console.error('Error printing split receipts:', error);
      
      if (error.message.includes('Web Bluetooth no está soportado')) {
        showError('Tu navegador no soporta Bluetooth. Usa Chrome o Edge.');
      } else if (error.message.includes('conexión')) {
        showError('No se pudo conectar con la impresora. Verifica que esté encendida.');
      } else {
        showError(`Error de impresión: ${error.message}`);
      }
      
      throw error;
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
        showError(`Error de impresión: ${error.message}`);
      }
    } finally {
      setPrinting(false);
    }
  };

  const formatCurrency = (amount) => {
    const value = parseFloat(amount) || 0;
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const renderOrderItems = () => {
    return (
      <div className="bg-white rounded p-3 mx-3 mb-3">
        <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Items del Pedido
        </h3>
        
        <div className="space-y-3">
          {order.items?.map((item) => {
            const isPaid = paidItems.has(item.id);
            const isAssigned = selectedItems[item.id] !== null && selectedItems[item.id] !== undefined;
            const isSelected = currentSplit.items.some(i => i.id === item.id);
            
            // Debug logging solo si hay problemas
            if (paymentMode === 'split' && isAssigned && selectedItems[item.id] === null) {
              console.warn(`Inconsistent state for item ${item.id}: isAssigned=${isAssigned} but selectedItems[item.id]=${selectedItems[item.id]}`);
            }
            
            return (
              <div
                key={item.id}
                onClick={() => paymentMode === 'split' && !isPaid && !isAssigned && toggleItemSelection(item.id)}
                className={`p-3 rounded border transition-colors ${
                  isPaid
                    ? 'bg-green-100 border-green-300 cursor-not-allowed'
                    : paymentMode === 'split'
                    ? isAssigned
                      ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                      : isSelected
                      ? 'bg-blue-50 border-blue-500 cursor-pointer'
                      : 'hover:bg-gray-50 border-gray-200 cursor-pointer'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">{item.recipe_name}</div>
                    {item.notes && (
                      <div className="text-gray-500 italic text-sm mt-1">Notas: {item.notes}</div>
                    )}
                    {item.customizations_count > 0 && (
                      <div className="text-blue-600 text-sm mt-1">
                        {item.customizations_count} personalización(es)
                      </div>
                    )}
                    {item.is_takeaway && (
                      <div className="text-orange-600 text-sm mt-1 flex items-center gap-1">
                        <span>📦</span>
                        <span>Para llevar (envase incluido)</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-base">{formatCurrency(item.total_price)}</div>
                    {isPaid && (
                      <div className="text-sm text-green-600 font-medium">
                        ✓ Pagado parcialmente
                      </div>
                    )}
                    {isAssigned && !isPaid && paymentMode === 'split' && (
                      <div className="text-sm text-gray-500">
                        Asignado a pago {(selectedItems[item.id] ?? -1) + 1}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-base text-gray-600">Cargando pago...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-base font-medium text-gray-900 mb-2">Orden no encontrada</h2>
          <button 
            onClick={() => navigate('/orders')}
            className="text-blue-600 hover:text-blue-800 text-base"
          >
            Volver a órdenes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col h-full">
      {/* Modal/Popup inicial para selección de tipo de pago */}
      {!paymentMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded max-w-md w-full overflow-hidden">
            {/* Header del modal */}
            <div className="bg-blue-600 px-2 py-2 text-white">
              <div className="text-center">
                <h2 className="text-sm font-medium mb-1">Procesar Pago</h2>
                <p className="text-blue-100 text-xs">
                  Mesa {order.table_number} • #{order.id}
                </p>
              </div>
            </div>

            {/* Contenido del modal */}
            <div className="p-2">
              {/* Total destacado */}
              <div className="text-center mb-3 p-2 bg-gray-50 rounded">
                <p className="text-xs text-gray-500 mb-1">Total a pagar</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatCurrency(order.total_amount)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {order.items ? order.items.length : 0} items
                </p>
              </div>

              {/* Mensaje informativo si hay items pagados */}
              {paidItems.size > 0 && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-800">
                      <strong>Atención:</strong> Hay {paidItems.size} item(s) ya pagados. Solo puedes usar "Dividir Cuenta" para procesar los items restantes.
                    </p>
                  </div>
                </div>
              )}

              {/* Opciones de pago */}
              <div className="space-y-2">
                {/* Pago Completo */}
                <button
                  onClick={() => setPaymentMode('full')}
                  disabled={processing || paidItems.size > 0}
                  className={`w-full p-2 rounded border transition-colors ${
                    paidItems.size > 0 
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                      : 'border-green-300 bg-green-50 hover:bg-green-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${
                      paidItems.size > 0 ? 'bg-gray-200' : 'bg-green-500'
                    }`}>
                      <CreditCard className={`h-3 w-3 ${paidItems.size > 0 ? 'text-gray-400' : 'text-white'}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className={`text-xs font-medium ${paidItems.size > 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                        Pago Completo
                      </div>
                      <div className={`text-xs ${paidItems.size > 0 ? 'text-gray-400' : 'text-gray-600'}`}>
                        Procesa toda la cuenta
                      </div>
                    </div>
                  </div>
                </button>
                
                {/* Dividir Cuenta */}
                <button
                  onClick={() => setPaymentMode('split')}
                  disabled={processing}
                  className="w-full p-2 rounded border border-blue-300 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                      <Split className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-xs font-medium text-gray-900">Dividir Cuenta</div>
                      <div className="text-xs text-gray-600">
                        {order.items ? order.items.filter(item => !paidItems.has(item.id)).length : 0} items disponibles
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {/* Botón cancelar */}
              <div className="mt-3 pt-2 border-t border-gray-200">
                <button
                  onClick={() => navigate('/orders')}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-50 text-xs flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Items del pedido - solo para split payment */}
      {paymentMode === 'split' && renderOrderItems()}

      {/* Formulario de Pago Completo */}
      {paymentMode === 'full' && (
        <div className="flex flex-col h-full">
          {/* Header fijo estandarizado reducido 70% */}
          <div className="bg-white border-b border-gray-200 p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 flex-1">
                <button
                  onClick={() => setPaymentMode(null)}
                  className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                </button>
                <div className="text-center flex-1">
                  <h1 className="text-xs font-medium text-gray-900">Pago Completo</h1>
                  <p className="text-xs text-gray-500">Mesa {order.table_number} • #{order.id}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(order.total_amount)}</p>
              </div>
            </div>
          </div>

          {/* Contenido scrollable */}
          <div className="flex-1 overflow-y-auto p-2" style={{maxHeight: 'calc(100vh - 140px)'}}>
            <div className="max-w-md mx-auto">
              <div className="bg-white rounded border border-gray-200 overflow-hidden">
                <div className="p-2">
                  <div className="space-y-3">
                    {/* Método de pago */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Método de Pago
                      </label>
                      <select
                        name="payment_method"
                        value={paymentData.payment_method}
                        onChange={handleInputChange}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
                      >
                        <option value="CASH">💵 Efectivo</option>
                        <option value="CARD">💳 Tarjeta</option>
                        <option value="TRANSFER">🏦 Transferencia</option>
                        <option value="YAPE_PLIN">📱 Yape/Plin</option>
                        <option value="OTHER">🔗 Otro</option>
                      </select>
                    </div>

                    {/* Notas */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Notas (Opcional)
                      </label>
                      <input
                        type="text"
                        name="notes"
                        value={paymentData.notes}
                        onChange={handleInputChange}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
                        placeholder="Ej: Cliente pagó con billete de 100..."
                      />
                    </div>
                  </div>

                  {/* Resumen del pago */}
                  <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                    <div className="text-center">
                      <h3 className="text-xs font-medium text-gray-900">Resumen del Pago</h3>
                      <p className="text-xs text-gray-600 mt-1">{order.items ? order.items.length : 0} items</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">{formatCurrency(order.total_amount)}</p>
                    </div>
                  </div>

                  {/* Botón de pago */}
                  <div className="mt-3">
                    <button
                      onClick={handleFullPayment}
                      disabled={processing}
                      className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 font-medium text-xs flex items-center justify-center gap-1"
                    >
                      {processing ? (
                        <>
                          <div className="animate-spin rounded h-3 w-3 border border-white border-t-transparent"></div>
                          Procesando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          Confirmar Pago
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulario de División de Cuenta */}
      {paymentMode === 'split' && (
        <div className="flex flex-col h-full">
          {/* Header compacto */}
          <div className="bg-white border-b border-gray-200 shadow-sm p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 flex-1">
                <button
                  onClick={() => setPaymentMode(null)}
                  className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                </button>
                <div className="text-center flex-1">
                  <h1 className="text-xs font-medium text-gray-900">Dividir Cuenta</h1>
                  <p className="text-xs text-gray-600">#{order.id} • Mesa {order.table_number}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(order.total_amount)}</p>
              </div>
            </div>
          </div>
          
          {/* Contenido scrollable */}
          <div className="flex-1 overflow-y-auto p-2" style={{maxHeight: 'calc(100vh - 140px)'}}>
            <div className="max-w-md mx-auto">
              <div className="bg-white rounded border border-gray-200 overflow-hidden">
                <div className="p-2">
                  <div className="space-y-2">
                    {/* Formulario de split actual */}
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Método de Pago
                        </label>
                        <select
                          value={currentSplit.payment_method}
                          onChange={(e) => setCurrentSplit({ ...currentSplit, payment_method: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="CASH">💵 Efectivo</option>
                          <option value="CARD">💳 Tarjeta</option>
                          <option value="YAPE_PLIN">📱 Yape/Plin</option>
                          <option value="TRANSFER">🏦 Transferencia</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Items Seleccionados
                        </label>
                        <div className="bg-gray-50 rounded p-2 min-h-[40px]">
                          {currentSplit.items.length === 0 ? (
                            <p className="text-xs text-gray-500 text-center py-2">Seleccione items arriba</p>
                          ) : (
                            <div className="space-y-1">
                              {currentSplit.items.map(item => (
                                <div key={item.id} className="flex justify-between text-xs">
                                  <span className="truncate">{item.recipe_name}</span>
                                  <span className="font-medium ml-1">{formatCurrency(item.total_price)}</span>
                                </div>
                              ))}
                              <div className="border-t pt-1 mt-1">
                                <div className="flex justify-between font-medium text-xs">
                                  <span>Total:</span>
                                  <span>{formatCurrency(currentSplit.amount)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={addSplit}
                        disabled={currentSplit.items.length === 0}
                        className="flex-1 bg-blue-600 text-white px-2 py-1.5 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        Agregar Pago
                      </button>
                      
                      {splits.length > 0 && (
                        <button
                          onClick={handleSplitPayment}
                          disabled={processing || splits.length === 0}
                          className="flex-1 bg-green-600 text-white px-2 py-1.5 rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-0.5"
                        >
                          {processing ? (
                            <>
                              <div className="animate-spin rounded-full h-2.5 w-2.5 border border-white border-t-transparent"></div>
                              Procesando...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-2.5 w-2.5" />
                              Procesar {splits.length}
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Pagos agregados */}
                    {splits.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-900 mb-1">Pagos Agregados</h4>
                        <div className="space-y-1">
                          {splits.map((split, idx) => (
                            <div key={split.id} className="bg-gray-50 rounded p-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-medium">Pago {idx + 1}</span>
                                    <span className="text-xs text-gray-600 truncate">
                                      ({split.payment_method})
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    {split.items.length} item(s) - {formatCurrency(split.amount)}
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeSplit(idx)}
                                  className="text-red-600 hover:text-red-800 p-0.5 ml-1"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payment;