import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Split, Receipt, CheckCircle, X, AlertTriangle } from 'lucide-react';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Payment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
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

  useEffect(() => {
    loadOrder();
  }, [id]);

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
    const orderTotal = parseFloat(order?.grand_total || order?.total_amount) || 0;
    
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
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Items del Pedido
        </h3>
        
        <div className="space-y-2">
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
                className={`p-3 rounded-lg border transition-colors ${
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
                    <div className="font-medium text-gray-900">{item.recipe_name}</div>
                    {item.notes && (
                      <div className="text-gray-500 italic text-xs mt-1">Notas: {item.notes}</div>
                    )}
                    {item.customizations_count > 0 && (
                      <div className="text-blue-600 text-xs mt-1">
                        {item.customizations_count} personalización(es)
                      </div>
                    )}
                    {item.is_takeaway && (
                      <div className="text-orange-600 text-xs mt-1 flex items-center gap-1">
                        <span>📦</span>
                        <span>Para llevar</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(item.total_price)}</div>
                    {isPaid && (
                      <div className="text-xs text-green-600 font-medium">
                        ✓ Pagado parcialmente
                      </div>
                    )}
                    {isAssigned && !isPaid && paymentMode === 'split' && (
                      <div className="text-xs text-gray-500">
                        Asignado a pago {(selectedItems[item.id] ?? -1) + 1}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Container Sales - Envases para llevar */}
        {order.container_sales && order.container_sales.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📦</span>
              Envases para llevar
            </h4>
            <div className="space-y-2">
              {order.container_sales.map((containerSale) => (
                <div key={containerSale.id} className="p-3 rounded-lg border border-orange-200 bg-orange-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {containerSale.container_name} x{containerSale.quantity}
                      </div>
                      <div className="text-gray-600 text-xs mt-1">
                        Adicional por servicio para llevar
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-orange-700">
                        {formatCurrency(containerSale.total_price)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(containerSale.unit_price)} c/u
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 p-2 bg-orange-100 rounded-lg">
              <div className="text-xs text-orange-800">
                💡 Los envases se cobran por separado del precio de los alimentos
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
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
    <div className="min-h-screen bg-gray-50">
      {/* Modal/Popup inicial para selección de tipo de pago */}
      {!paymentMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            {/* Header del modal */}
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-gray-900">Procesar Pago</h1>
              <p className="text-gray-600 mt-2">
                Orden #{order.id} - Mesa {order.table_number}
              </p>
              
              {/* Breakdown de totales */}
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Alimentos:</span>
                  <span className="font-medium">{formatCurrency(order.total_amount)}</span>
                </div>
                {order.containers_total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-600">Envases para llevar:</span>
                    <span className="font-medium text-orange-600">{formatCurrency(order.containers_total)}</span>
                  </div>
                )}
                <div className="border-t pt-1">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Total:</span>
                    <span className="text-2xl font-bold text-blue-600">{formatCurrency(order.grand_total || order.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mensaje informativo si hay items pagados */}
            {paidItems.size > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 text-center">
                  <AlertTriangle className="inline-block h-4 w-4 mr-1" />
                  Existen {paidItems.size} item(s) pagados parcialmente. Solo puede continuar con dividir cuenta.
                </p>
              </div>
            )}

            {/* Opciones de pago */}
            <div className="space-y-3">
              {/* Pago Completo */}
              <Button
                onClick={() => setPaymentMode('full')}
                className={`w-full h-16 flex items-center justify-center gap-3 text-lg ${
                  paidItems.size > 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={processing || paidItems.size > 0}
                title={paidItems.size > 0 ? "No disponible: existen items pagados parcialmente" : ""}
              >
                <CreditCard className={`h-6 w-6 ${paidItems.size > 0 ? 'text-gray-400' : ''}`} />
                <div className="text-center">
                  <div className={`font-semibold ${paidItems.size > 0 ? 'text-gray-500' : ''}`}>
                    Pago Completo
                  </div>
                </div>
              </Button>
              
              {/* Dividir Cuenta */}
              <Button
                onClick={() => setPaymentMode('split')}
                variant="secondary"
                className="w-full h-16 flex items-center justify-center gap-3 text-lg"
                disabled={processing}
              >
                <Split className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-semibold">Dividir Cuenta</div>
                </div>
              </Button>
            </div>

            {/* Botón cancelar */}
            <div className="mt-6">
              <Button
                onClick={() => navigate('/orders')}
                variant="secondary"
                className="w-full flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Items del pedido - solo para split payment */}
      {paymentMode === 'split' && renderOrderItems()}

      {/* Formulario de Pago Completo */}
      {paymentMode === 'full' && (
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 p-4 bg-white rounded-lg shadow">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setPaymentMode(null)}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Pago Completo</h1>
                <p className="text-gray-600">Orden #{order.id} - Mesa {order.table_number}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total a pagar</p>
              <div className="space-y-1">
                <div className="flex justify-end text-xs text-gray-600">
                  Alimentos: {formatCurrency(order.total_amount)}
                </div>
                {order.containers_total > 0 && (
                  <div className="flex justify-end text-xs text-orange-600">
                    Envases: {formatCurrency(order.containers_total)}
                  </div>
                )}
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(order.grand_total || order.total_amount)}</p>
              </div>
            </div>
          </div>

          {/* Formulario centrado */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Método de pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pago
                </label>
                <select
                  name="payment_method"
                  value={paymentData.payment_method}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="YAPE_PLIN">Yape/Plin</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas (Opcional)
                </label>
                <input
                  type="text"
                  name="notes"
                  value={paymentData.notes}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Ej: Cliente pagó con billete de 100"
                />
              </div>
            </div>

            {/* Botón de pago */}
            <div className="mt-8">
              <Button
                onClick={handleFullPayment}
                disabled={processing}
                className="w-full h-14 flex items-center justify-center gap-3 text-lg font-semibold"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Procesando pago...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Procesar Pago - {formatCurrency(order.grand_total || order.total_amount)}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario de División de Cuenta */}
      {paymentMode === 'split' && (
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 p-4 bg-white rounded-lg shadow">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setPaymentMode(null)}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Dividir Cuenta</h1>
                <p className="text-gray-600">Orden #{order.id} - Mesa {order.table_number}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total a dividir</p>
              <div className="space-y-1">
                <div className="flex justify-end text-xs text-gray-600">
                  Alimentos: {formatCurrency(order.total_amount)}
                </div>
                {order.containers_total > 0 && (
                  <div className="flex justify-end text-xs text-orange-600">
                    Envases: {formatCurrency(order.containers_total)}
                  </div>
                )}
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(order.grand_total || order.total_amount)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            {/* Información sobre envases para llevar */}
            {order.container_sales && order.container_sales.length > 0 && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span>📦</span>
                  <h4 className="text-sm font-medium text-orange-800">
                    Envases para llevar incluidos
                  </h4>
                </div>
                <div className="text-xs text-orange-700">
                  Total en envases: {formatCurrency(order.containers_total)} - 
                  Los envases se cobran por separado del precio de los alimentos
                </div>
              </div>
            )}
            
            <div className="space-y-6">
            {/* Formulario de split actual */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pago
                </label>
                <select
                  value={currentSplit.payment_method}
                  onChange={(e) => setCurrentSplit({ ...currentSplit, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="YAPE_PLIN">Yape/Plin</option>
                  <option value="TRANSFER">Transferencia</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Items Seleccionados
                </label>
                <div className="bg-gray-50 rounded-lg p-3">
                  {currentSplit.items.length === 0 ? (
                    <p className="text-sm text-gray-500">Seleccione items arriba</p>
                  ) : (
                    <div className="space-y-1">
                      {currentSplit.items.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>{item.recipe_name}</span>
                          <span className="font-medium">{formatCurrency(item.total_price)}</span>
                        </div>
                      ))}
                      <div className="border-t pt-1 mt-2">
                        <div className="flex justify-between font-medium">
                          <span>Total:</span>
                          <span>{formatCurrency(currentSplit.amount)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={addSplit}
                disabled={currentSplit.items.length === 0}
                className="flex-1"
              >
                Agregar Pago
              </Button>
              
              {splits.length > 0 && (
                <Button
                  onClick={handleSplitPayment}
                  disabled={processing || splits.length === 0}
                  variant="success"
                  className="flex-1"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Procesar {splits.length} Pagos
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Pagos agregados */}
            {splits.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Pagos Agregados</h4>
                <div className="space-y-2">
                  {splits.map((split, idx) => (
                    <div key={split.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Pago {idx + 1}</span>
                            <span className="text-sm text-gray-600">
                              ({split.payment_method})
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {split.items.length} item(s) - {formatCurrency(split.amount)}
                          </div>
                        </div>
                        <button
                          onClick={() => removeSplit(idx)}
                          className="text-red-600 hover:text-red-800"
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
      )}
    </div>
  );
};

export default Payment;