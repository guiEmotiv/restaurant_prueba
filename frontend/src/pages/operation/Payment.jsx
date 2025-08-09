import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  CreditCard, 
  Split, 
  Receipt, 
  CheckCircle, 
  X, 
  AlertTriangle, 
  Printer,
  ShoppingCart,
  Clock,
  Package,
  Check,
  Wallet,
  Smartphone,
  Building2,
  Link,
  Users,
  Eye,
  Coffee
} from 'lucide-react';
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
      showSuccess('¡Pago procesado exitosamente!');

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
      showSuccess(`¡Pagos divididos procesados exitosamente! (${splits.length} pagos)`);

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

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'CASH': return <Wallet className="h-5 w-5" />;
      case 'CARD': return <CreditCard className="h-5 w-5" />;
      case 'YAPE_PLIN': return <Smartphone className="h-5 w-5" />;
      case 'TRANSFER': return <Building2 className="h-5 w-5" />;
      default: return <Link className="h-5 w-5" />;
    }
  };

  const getPaymentMethodName = (method) => {
    switch (method) {
      case 'CASH': return 'Efectivo';
      case 'CARD': return 'Tarjeta';
      case 'YAPE_PLIN': return 'Yape/Plin';
      case 'TRANSFER': return 'Transferencia';
      default: return 'Otro';
    }
  };

  const renderOrderItems = () => {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              <Receipt className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Items del Pedido</h3>
              <p className="text-sm text-gray-500">Selecciona los items para el pago dividido</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          {order.items?.map((item) => {
            const isPaid = paidItems.has(item.id);
            const isAssigned = selectedItems[item.id] !== null && selectedItems[item.id] !== undefined;
            const isSelected = currentSplit.items.some(i => i.id === item.id);
            
            return (
              <div
                key={item.id}
                onClick={() => paymentMode === 'split' && !isPaid && !isAssigned && toggleItemSelection(item.id)}
                className={`relative p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                  isPaid
                    ? 'bg-emerald-50 border-emerald-200 cursor-not-allowed'
                    : paymentMode === 'split'
                    ? isAssigned
                      ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                      : isSelected
                      ? 'bg-blue-50 border-blue-500 scale-[1.02] shadow-lg'
                      : 'hover:bg-gray-50 border-gray-200 hover:border-gray-300'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-red-100 rounded-xl flex items-center justify-center">
                    <Coffee className="h-6 w-6 text-orange-500" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900">{item.recipe_name}</h4>
                      {isPaid && (
                        <span className="px-2 py-1 bg-emerald-500 text-white rounded-lg text-xs font-medium">
                          ✓ Pagado
                        </span>
                      )}
                      {isAssigned && !isPaid && paymentMode === 'split' && (
                        <span className="px-2 py-1 bg-gray-500 text-white rounded-lg text-xs font-medium">
                          Pago {(selectedItems[item.id] ?? -1) + 1}
                        </span>
                      )}
                    </div>
                    
                    {item.notes && (
                      <p className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-lg mb-2">{item.notes}</p>
                    )}
                    
                    <div className="flex gap-2 mb-2">
                      {item.is_takeaway && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs">
                          <Package className="h-3 w-3" />
                          Para llevar
                        </span>
                      )}
                      {item.has_taper && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">
                          <Check className="h-3 w-3" />
                          Envase incluido
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">{formatCurrency(item.total_price)}</div>
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-200 border-t-blue-600"></div>
          </div>
          <p className="text-gray-600 font-medium">Cargando pago...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Orden no encontrada</h2>
          <button 
            onClick={() => navigate('/orders')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Volver a órdenes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Modal inicial para selección de tipo de pago */}
      {!paymentMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-bold mb-1">Procesar Pago</h2>
                <p className="text-blue-100">
                  Mesa {order.table_number} • #{order.id}
                </p>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-6">
              {/* Total destacado */}
              <div className="text-center mb-6 p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border border-emerald-200">
                <p className="text-sm text-emerald-600 mb-1 font-semibold">Total a pagar</p>
                <p className="text-3xl font-bold text-emerald-700">
                  {formatCurrency(order.total_amount)}
                </p>
                <p className="text-sm text-emerald-600 mt-1">
                  {order.items ? order.items.length : 0} items
                </p>
              </div>

              {/* Mensaje informativo si hay items pagados */}
              {paidItems.size > 0 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-800 mb-1">¡Atención!</p>
                      <p className="text-sm text-amber-700">
                        Hay {paidItems.size} item(s) ya pagados. Solo puedes usar "Dividir Cuenta" para procesar los items restantes.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Opciones de pago */}
              <div className="space-y-4">
                {/* Pago Completo */}
                <button
                  onClick={() => setPaymentMode('full')}
                  disabled={processing || paidItems.size > 0}
                  className={`w-full p-4 rounded-2xl border-2 transition-all duration-200 ${
                    paidItems.size > 0 
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                      : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 hover:scale-[1.02] shadow-lg'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
                      paidItems.size > 0 ? 'bg-gray-200' : 'bg-emerald-500'
                    }`}>
                      <CreditCard className={`h-6 w-6 ${paidItems.size > 0 ? 'text-gray-400' : 'text-white'}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className={`font-bold text-lg ${paidItems.size > 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                        Pago Completo
                      </div>
                      <div className={`text-sm ${paidItems.size > 0 ? 'text-gray-400' : 'text-emerald-600'}`}>
                        Procesa toda la cuenta de una vez
                      </div>
                    </div>
                  </div>
                </button>
                
                {/* Dividir Cuenta */}
                <button
                  onClick={() => setPaymentMode('split')}
                  disabled={processing}
                  className="w-full p-4 rounded-2xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 hover:scale-[1.02] transition-all duration-200 shadow-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-md">
                      <Split className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-lg text-gray-900">Dividir Cuenta</div>
                      <div className="text-sm text-blue-600">
                        {order.items ? order.items.filter(item => !paidItems.has(item.id)).length : 0} items disponibles
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {/* Botón cancelar */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => navigate('/orders')}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Items del pedido - solo para split payment */}
      {paymentMode === 'split' && renderOrderItems()}

      {/* Vista de Pago Completo */}
      {paymentMode === 'full' && (
        <div className="min-h-screen">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-green-700 text-white sticky top-0 z-40 shadow-lg">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => setPaymentMode(null)}
                    className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 text-white" />
                  </button>
                  
                  <div className="flex-1">
                    <h1 className="font-bold">Pago Completo</h1>
                    <p className="text-emerald-100 text-sm">Mesa {order.table_number} • #{order.id}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-emerald-200 text-sm">Total</p>
                  <p className="text-xl font-bold">{formatCurrency(order.total_amount)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contenido */}
          <div className="px-4 py-6">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-w-lg mx-auto">
              <div className="p-6 space-y-6">
                {/* Método de pago */}
                <div>
                  <label className="block font-bold text-gray-700 mb-3">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'CASH', icon: <Wallet className="h-5 w-5" />, name: 'Efectivo' },
                      { value: 'CARD', icon: <CreditCard className="h-5 w-5" />, name: 'Tarjeta' },
                      { value: 'YAPE_PLIN', icon: <Smartphone className="h-5 w-5" />, name: 'Yape/Plin' },
                      { value: 'TRANSFER', icon: <Building2 className="h-5 w-5" />, name: 'Transferencia' }
                    ].map((method) => (
                      <button
                        key={method.value}
                        onClick={() => setPaymentData({ ...paymentData, payment_method: method.value })}
                        className={`p-3 rounded-xl border-2 transition-all duration-200 flex items-center gap-2 ${
                          paymentData.payment_method === method.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {method.icon}
                        <span className="font-semibold text-sm">{method.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <label className="block font-bold text-gray-700 mb-2">
                    Notas (Opcional)
                  </label>
                  <input
                    type="text"
                    name="notes"
                    value={paymentData.notes}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Ej: Cliente pagó con billete de 100..."
                  />
                </div>

                {/* Resumen del pago */}
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border border-emerald-200">
                  <div className="text-center">
                    <h3 className="font-bold text-gray-900 mb-2">Resumen del Pago</h3>
                    <p className="text-sm text-emerald-600 mb-2">{order.items ? order.items.length : 0} items</p>
                    <p className="text-3xl font-bold text-emerald-700">{formatCurrency(order.total_amount)}</p>
                  </div>
                </div>

                {/* Botón de pago */}
                <button
                  onClick={handleFullPayment}
                  disabled={processing}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl hover:bg-emerald-700 disabled:opacity-50 font-bold text-lg flex items-center justify-center gap-2 transition-colors shadow-lg"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Procesando pago...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Confirmar Pago
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vista de División de Cuenta */}
      {paymentMode === 'split' && (
        <div className="min-h-screen">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white sticky top-0 z-40 shadow-lg">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => setPaymentMode(null)}
                    className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 text-white" />
                  </button>
                  
                  <div className="flex-1">
                    <h1 className="font-bold">Dividir Cuenta</h1>
                    <p className="text-blue-100 text-sm">#{order.id} • Mesa {order.table_number}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-blue-200 text-sm">Total</p>
                  <p className="text-xl font-bold">{formatCurrency(order.total_amount)}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Contenido */}
          <div className="px-4 py-6">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-w-lg mx-auto">
              <div className="p-6 space-y-6">
                {/* Formulario de split actual */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-4">Crear Nuevo Pago</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-2">
                        Método de Pago
                      </label>
                      <select
                        value={currentSplit.payment_method}
                        onChange={(e) => setCurrentSplit({ ...currentSplit, payment_method: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="CASH">💵 Efectivo</option>
                        <option value="CARD">💳 Tarjeta</option>
                        <option value="YAPE_PLIN">📱 Yape/Plin</option>
                        <option value="TRANSFER">🏦 Transferencia</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-2">
                        Items Seleccionados
                      </label>
                      <div className="bg-gray-50 rounded-xl p-4 min-h-[80px]">
                        {currentSplit.items.length === 0 ? (
                          <p className="text-gray-500 text-center py-6">Selecciona items de arriba</p>
                        ) : (
                          <div className="space-y-2">
                            {currentSplit.items.map(item => (
                              <div key={item.id} className="flex justify-between text-sm bg-white p-2 rounded-lg">
                                <span className="font-medium">{item.recipe_name}</span>
                                <span className="text-emerald-600 font-bold">{formatCurrency(item.total_price)}</span>
                              </div>
                            ))}
                            <div className="border-t pt-2 mt-2">
                              <div className="flex justify-between font-bold text-lg">
                                <span>Total:</span>
                                <span className="text-emerald-600">{formatCurrency(currentSplit.amount)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={addSplit}
                      disabled={currentSplit.items.length === 0}
                      className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Agregar Pago
                    </button>
                    
                    {splits.length > 0 && (
                      <button
                        onClick={handleSplitPayment}
                        disabled={processing || splits.length === 0}
                        className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                      >
                        {processing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            Procesando...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Procesar ({splits.length})
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Pagos agregados */}
                {splits.length > 0 && (
                  <div>
                    <h4 className="font-bold text-gray-900 mb-4">Pagos Agregados ({splits.length})</h4>
                    <div className="space-y-3">
                      {splits.map((split, idx) => (
                        <div key={split.id} className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {getPaymentMethodIcon(split.payment_method)}
                                <span className="font-bold">Pago {idx + 1}</span>
                                <span className="text-sm text-blue-600">({getPaymentMethodName(split.payment_method)})</span>
                              </div>
                              <div className="text-sm text-gray-600">
                                {split.items.length} item(s) • <span className="font-bold text-emerald-600">{formatCurrency(split.amount)}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => removeSplit(idx)}
                              className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors ml-3"
                            >
                              <X className="h-4 w-4" />
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
      )}
    </div>
  );
};

export default Payment;