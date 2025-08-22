import { useState, useEffect } from 'react';
import { X, CreditCard, DollarSign, Users, Split, Check, Smartphone } from 'lucide-react';
import Button from '../common/Button';
import { useToast } from '../../contexts/ToastContext';

const SplitPaymentModal = ({ isOpen, onClose, onSubmit, order, processing = false, onFullPayment }) => {
  const { showError } = useToast();
  const [paymentMode, setPaymentMode] = useState('full'); // 'full' or 'split'
  const [splits, setSplits] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [paidItems, setPaidItems] = useState(new Set()); // Items ya pagados
  const [splitStarted, setSplitStarted] = useState(false); // Si ya se inició división
  const [currentSplit, setCurrentSplit] = useState({
    payer_name: '',
    payment_method: 'CASH',
    items: [],
    amount: 0,
    notes: ''
  });

  useEffect(() => {
    if (isOpen && order?.items) {
      // Resetear estados cuando se abre el modal
      const itemsMap = {};
      order.items.forEach(item => {
        itemsMap[item.id] = null; // null = no asignado
      });
      setSelectedItems(itemsMap);
      setSplits([]);
      setSplitStarted(false);
      setPaidItems(new Set());
      setPaymentMode('full');
      setCurrentSplit({
        payer_name: '',
        payment_method: 'CASH',
        items: [],
        amount: 0,
        notes: ''
      });
    }
  }, [isOpen, order]);

  const handleFullPayment = () => {
    const orderTotal = parseFloat(order.total_amount) || 0;
    if (orderTotal <= 0) {
      showError('El total de la orden debe ser mayor a 0');
      return;
    }

    // Verificar que no haya items ya pagados
    if (paidItems.size > 0) {
      showError('No se puede procesar pago completo si ya hay items pagados parcialmente');
      return;
    }

    const paymentData = {
      payment_method: currentSplit.payment_method,
      amount: orderTotal,
      payer_name: currentSplit.payer_name || '',
      notes: currentSplit.notes,
      tax_amount: 0
    };
    onSubmit([paymentData], false); // false = pago completo
  };

  const handleSplitPayment = () => {
    if (splits.length === 0) {
      showError('Debe agregar al menos un pago dividido');
      return;
    }

    // Verificar que todos los items estén asignados
    const unassignedItems = Object.entries(selectedItems).filter(([id, splitIdx]) => splitIdx === null);
    if (unassignedItems.length > 0) {
      showError('Todos los items deben estar asignados a un pago');
      return;
    }

    // Verificar que el monto total coincida
    const orderTotal = parseFloat(order.total_amount) || 0;
    const totalAssigned = getTotalAssigned();
    const difference = Math.abs(orderTotal - totalAssigned);
    
    if (difference > 0.01) { // Tolerancia de 1 centavo
      showError(`El total de los pagos (${formatCurrency(totalAssigned)}) no coincide con el total de la orden (${formatCurrency(orderTotal)})`);
      return;
    }

    // Transformar splits al formato esperado por el backend
    const formattedSplits = splits.map(split => ({
      items: split.items.map(item => item.id),
      payment_method: split.payment_method,
      amount: parseFloat(split.amount) || 0,
      payer_name: split.payer_name,
      notes: split.notes
    }));

    onSubmit(formattedSplits, true); // true = pago dividido
  };

  const toggleItemSelection = (itemId) => {
    // Verificar si el item ya está pagado
    if (paidItems.has(itemId)) {
      showError('Este item ya ha sido pagado');
      return;
    }

    if (selectedItems[itemId] !== null) {
      // Si ya está asignado a un split, no hacer nada
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

    // Marcar que se inició la división de cuenta
    setSplitStarted(true);

    // Marcar items como asignados
    const newSelectedItems = { ...selectedItems };
    currentSplit.items.forEach(item => {
      newSelectedItems[item.id] = splits.length;
    });
    setSelectedItems(newSelectedItems);

    // Agregar split
    setSplits([...splits, { ...currentSplit, id: Date.now() }]);
    
    // Limpiar formulario
    setCurrentSplit({
      payer_name: '',
      payment_method: 'CASH',
      items: [],
      amount: 0,
      notes: ''
    });
  };

  const removeSplit = (splitIndex) => {
    // Liberar items del split
    const newSelectedItems = { ...selectedItems };
    Object.entries(selectedItems).forEach(([itemId, assignedSplit]) => {
      if (assignedSplit === splitIndex) {
        newSelectedItems[itemId] = null;
      } else if (assignedSplit > splitIndex) {
        // Ajustar índices
        newSelectedItems[itemId] = assignedSplit - 1;
      }
    });
    setSelectedItems(newSelectedItems);

    // Remover split
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

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'CASH':
        return <DollarSign className="h-4 w-4" />;
      case 'CARD':
        return <CreditCard className="h-4 w-4" />;
      case 'YAPE_PLIN':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'CASH':
        return 'Efectivo';
      case 'CARD':
        return 'Tarjeta';
      case 'TRANSFER':
        return 'Transferencia';
      case 'YAPE_PLIN':
        return 'Yape/Plin';
      default:
        return 'Otro';
    }
  };

  const getTotalAssigned = () => {
    return splits.reduce((sum, split) => {
      const splitAmount = parseFloat(split.amount) || 0;
      return sum + splitAmount;
    }, 0);
  };

  const getPendingAmount = () => {
    const orderTotal = parseFloat(order.total_amount) || 0;
    const totalAssigned = getTotalAssigned();
    const currentAmount = parseFloat(currentSplit.amount) || 0;
    return Math.max(0, orderTotal - totalAssigned - currentAmount);
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Procesar Pago - Mesa {order.table_number}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Total: {formatCurrency(order.total_amount)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          {/* Modo de pago */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setPaymentMode('full')}
              disabled={splitStarted}
              className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                splitStarted
                  ? 'border-gray-200 bg-gray-100 cursor-not-allowed'
                  : paymentMode === 'full'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <CreditCard className={`h-6 w-6 mx-auto mb-2 ${splitStarted ? 'text-gray-400' : 'text-gray-700'}`} />
              <div className={`font-medium ${splitStarted ? 'text-gray-400' : ''}`}>Pago Completo</div>
              <div className={`text-sm ${splitStarted ? 'text-gray-400' : 'text-gray-600'}`}>
                {splitStarted ? 'No disponible' : 'Pagar toda la cuenta'}
              </div>
            </button>
            
            <button
              onClick={() => setPaymentMode('split')}
              className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                paymentMode === 'split'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Split className="h-6 w-6 mx-auto mb-2 text-gray-700" />
              <div className="font-medium">Dividir Cuenta</div>
              <div className="text-sm text-gray-600">Pagar por separado</div>
            </button>
          </div>

          {paymentMode === 'full' ? (
            // Pago completo
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Cliente (Opcional)
                </label>
                <input
                  type="text"
                  value={currentSplit.payer_name}
                  onChange={(e) => setCurrentSplit({ ...currentSplit, payer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Nombre del cliente"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pago
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['CASH', 'CARD', 'YAPE_PLIN', 'TRANSFER'].map(method => (
                    <button
                      key={method}
                      onClick={() => setCurrentSplit({ ...currentSplit, payment_method: method })}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        currentSplit.payment_method === method
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {getPaymentMethodIcon(method)}
                        <span className="text-base font-medium">{getPaymentMethodLabel(method)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas (Opcional)
                </label>
                <textarea
                  value={currentSplit.notes}
                  onChange={(e) => setCurrentSplit({ ...currentSplit, notes: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base"
                  rows={3}
                  placeholder="Notas del pago..."
                />
              </div>
            </div>
          ) : (
            // Pago dividido
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Items disponibles */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Items del Pedido</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-3">
                  {order.items.map(item => {
                    const isAssigned = selectedItems[item.id] !== null;
                    const isSelected = currentSplit.items.some(i => i.id === item.id);
                    const isPaid = paidItems.has(item.id);
                    
                    return (
                      <div
                        key={item.id}
                        onClick={() => !isAssigned && !isPaid && toggleItemSelection(item.id)}
                        className={`p-3 rounded-lg border transition-colors ${
                          isPaid
                            ? 'bg-green-100 border-green-300 cursor-not-allowed opacity-60'
                            : isAssigned
                            ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                            : isSelected
                            ? 'bg-blue-50 border-blue-500 cursor-pointer'
                            : 'hover:bg-gray-50 border-gray-200 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{item.recipe_name}</div>
                            {item.notes && (
                              <div className="text-sm text-gray-600 italic">{item.notes}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(item.total_price)}</div>
                            {isPaid && (
                              <div className="text-xs text-green-600 font-medium">
                                ✓ Pagado
                              </div>
                            )}
                            {isAssigned && !isPaid && (
                              <div className="text-xs text-gray-500">
                                Asignado a: {splits[selectedItems[item.id]]?.payer_name || 'Sin nombre'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Formulario de split actual */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Nuevo Pago Dividido</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre del Pagador (Opcional)
                    </label>
                    <input
                      type="text"
                      value={currentSplit.payer_name}
                      onChange={(e) => setCurrentSplit({ ...currentSplit, payer_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Ej: Juan (opcional)"
                    />
                  </div>

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
                        <p className="text-sm text-gray-500">Seleccione items del lado izquierdo</p>
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

                  <Button
                    onClick={addSplit}
                    disabled={currentSplit.items.length === 0}
                    className="w-full"
                  >
                    Agregar Pago
                  </Button>
                </div>

                {/* Pagos agregados */}
                {splits.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium text-gray-900 mb-3">Pagos Divididos</h4>
                    <div className="space-y-2">
                      {splits.map((split, idx) => (
                        <div key={split.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-600" />
                                <span className="font-medium">{split.payer_name}</span>
                                <span className="text-sm text-gray-600">
                                  ({getPaymentMethodLabel(split.payment_method)})
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
          )}

          {/* Resumen de pago */}
          {paymentMode === 'split' && (
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total de la orden:</span>
                  <span className="font-medium">{formatCurrency(order.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total asignado:</span>
                  <span className="font-medium">{formatCurrency(getTotalAssigned())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">En selección actual:</span>
                  <span className="font-medium">{formatCurrency(currentSplit.amount)}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold">Pendiente:</span>
                    <span className={`font-semibold ${getPendingAmount() === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(getPendingAmount())}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          {paymentMode === 'full' ? (
            <Button 
              variant="success" 
              onClick={onFullPayment}
              disabled={processing}
              className="flex items-center gap-2 px-6 py-3 text-lg"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Procesar Pago Completo
                </>
              )}
            </Button>
          ) : (
            <Button 
              variant="success" 
              onClick={handleSplitPayment}
              disabled={processing || splits.length === 0 || getPendingAmount() !== 0}
              className="flex items-center gap-2 px-6 py-3 text-lg"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Procesar Pagos Divididos ({splits.length})
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SplitPaymentModal;