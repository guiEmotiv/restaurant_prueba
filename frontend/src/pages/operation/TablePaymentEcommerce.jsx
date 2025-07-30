import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  CreditCard, 
  Banknote,
  Smartphone,
  Building2,
  DollarSign,
  Receipt,
  Check,
  AlertCircle,
  Users,
  Package,
  Split,
  CheckCircle,
  Minus,
  Plus
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const TablePaymentEcommerce = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();
  
  // Estados principales
  const [table, setTable] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Estados de pago
  const [paymentMode, setPaymentMode] = useState(null); // 'full' o 'split'
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');
  
  // Estados para pago dividido
  const [splitPayments, setSplitPayments] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [currentSplitMethod, setCurrentSplitMethod] = useState('CASH');
  const [currentSplitNotes, setCurrentSplitNotes] = useState('');

  const { orderId } = location.state || {};

  useEffect(() => {
    if (!orderId) {
      showError('ID de pedido no encontrado');
      navigate('/table-status');
      return;
    }
    loadData();
  }, [tableId, orderId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tableData, orderData] = await Promise.all([
        apiService.tables.getById(tableId),
        apiService.orders.getById(orderId)
      ]);
      
      setTable(tableData);
      setOrder(orderData);
      
      // Verificar que todos los items estén entregados
      const allItemsDelivered = orderData.items && orderData.items.length > 0 && 
        orderData.items.every(item => item.status === 'SERVED');
        
      if (!allItemsDelivered) {
        showError('No se puede procesar el pago. Algunos items aún no han sido entregados.');
        navigate(`/table/${tableId}/order-edit`, {
          state: { orderId: orderId }
        });
        return;
      }

      // Inicializar selectedItems
      const itemsMap = {};
      orderData.items.forEach(item => {
        itemsMap[item.id] = null; // null = no asignado
      });
      setSelectedItems(itemsMap);
      
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar los datos');
      navigate('/table-status');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'CASH': return <Banknote className="h-5 w-5" />;
      case 'CARD': return <CreditCard className="h-5 w-5" />;
      case 'TRANSFER': return <Building2 className="h-5 w-5" />;
      case 'YAPE_PLIN': return <Smartphone className="h-5 w-5" />;
      default: return <DollarSign className="h-5 w-5" />;
    }
  };

  const getPaymentMethodName = (method) => {
    const names = {
      'CASH': 'Efectivo',
      'CARD': 'Tarjeta',
      'TRANSFER': 'Transferencia',
      'YAPE_PLIN': 'Yape/Plin',
      'OTHER': 'Otro'
    };
    return names[method] || method;
  };

  const getPaymentMethodColor = (method) => {
    const colors = {
      'CASH': 'border-green-300 bg-green-50 hover:bg-green-100 text-green-700',
      'CARD': 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700',
      'TRANSFER': 'border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700',
      'YAPE_PLIN': 'border-pink-300 bg-pink-50 hover:bg-pink-100 text-pink-700',
      'OTHER': 'border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700'
    };
    return colors[method] || colors['OTHER'];
  };

  const handleFullPayment = async () => {
    try {
      setProcessing(true);
      
      const paymentData = {
        order: orderId,
        payment_method: paymentMethod,
        amount: parseFloat(order.total_amount).toFixed(2),
        tax_amount: '0.00',
        notes: paymentNotes || ''
      };

      await apiService.payments.create(paymentData);
      showSuccess('Pago procesado exitosamente');
      navigate('/table-status');
      
    } catch (error) {
      console.error('Error processing payment:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message;
      showError('Error al procesar el pago: ' + errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const toggleItemSelection = (itemId) => {
    const currentSplitIndex = splitPayments.length;
    const newSelectedItems = { ...selectedItems };
    
    // Si el item ya está asignado a un split finalizado (no al actual), no permitir cambios
    if (selectedItems[itemId] !== null && selectedItems[itemId] < currentSplitIndex) {
      return;
    }
    
    if (newSelectedItems[itemId] === currentSplitIndex) {
      // Deseleccionar - volver a null
      newSelectedItems[itemId] = null;
    } else {
      // Seleccionar para el split actual
      newSelectedItems[itemId] = currentSplitIndex;
    }
    
    setSelectedItems(newSelectedItems);
  };

  const getCurrentSplitItems = () => {
    const currentSplitIndex = splitPayments.length;
    return order.items.filter(item => selectedItems[item.id] === currentSplitIndex);
  };

  const getCurrentSplitTotal = () => {
    return getCurrentSplitItems().reduce((total, item) => total + parseFloat(item.total_price), 0);
  };

  const addSplitPayment = () => {
    const selectedSplitItems = getCurrentSplitItems();
    
    if (selectedSplitItems.length === 0) {
      showError('Debe seleccionar al menos un item para este pago');
      return;
    }

    const splitPayment = {
      id: Date.now(),
      items: selectedSplitItems,
      payment_method: currentSplitMethod,
      amount: getCurrentSplitTotal(),
      notes: currentSplitNotes
    };

    setSplitPayments([...splitPayments, splitPayment]);
    setCurrentSplitMethod('CASH');
    setCurrentSplitNotes('');
  };

  const removeSplitPayment = (splitIndex) => {
    const newSelectedItems = { ...selectedItems };
    
    // Liberar items del split eliminado
    Object.keys(selectedItems).forEach(itemId => {
      if (selectedItems[itemId] === splitIndex) {
        newSelectedItems[itemId] = null;
      } else if (selectedItems[itemId] > splitIndex) {
        // Reajustar índices de splits posteriores
        newSelectedItems[itemId] = selectedItems[itemId] - 1;
      }
    });
    
    setSelectedItems(newSelectedItems);
    setSplitPayments(splitPayments.filter((_, idx) => idx !== splitIndex));
  };

  const handleSplitPayments = async () => {
    if (splitPayments.length === 0) {
      showError('Debe agregar al menos un pago dividido');
      return;
    }

    try {
      setProcessing(true);
      
      const formattedSplits = splitPayments.map(split => ({
        items: split.items.map(item => item.id),
        payment_method: split.payment_method,
        amount: parseFloat(split.amount).toFixed(2),
        notes: split.notes || ''
      }));

      await apiService.orders.splitPayment(orderId, { splits: formattedSplits });
      showSuccess(`Pago parcial procesado exitosamente`);
      
      // Recargar datos del pedido para ver el estado actualizado
      const [tableData, orderData] = await Promise.all([
        apiService.tables.getById(tableId),
        apiService.orders.getById(orderId)
      ]);
      
      setTable(tableData);
      setOrder(orderData);
      
      // Reinicializar estados para siguiente pago
      setSplitPayments([]);
      const itemsMap = {};
      orderData.items.forEach(item => {
        itemsMap[item.id] = null;
      });
      setSelectedItems(itemsMap);
      
      // Verificar si todos los items están pagados
      const remainingAmount = getRemainingAmount();
      if (remainingAmount <= 0) {
        showSuccess('¡Pedido completamente pagado!');
        setTimeout(() => {
          navigate('/table-status');
        }, 2000);
      }
      
    } catch (error) {
      console.error('Error processing split payments:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message;
      showError('Error al procesar el pago: ' + errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const getRemainingAmount = () => {
    const totalPaid = splitPayments.reduce((sum, split) => sum + split.amount, 0);
    return parseFloat(order.total_amount) - totalPaid;
  };

  const getUnassignedItems = () => {
    return order.items.filter(item => selectedItems[item.id] === null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando datos de pago...</p>
        </div>
      </div>
    );
  }

  if (!table || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Pedido no encontrado</h2>
          <button 
            onClick={() => navigate('/table-status')}
            className="text-blue-600 hover:text-blue-800"
          >
            Volver al estado de mesas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header fijo */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/table/${tableId}/order-edit`, { state: { orderId: orderId }})}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Procesar Pago - Mesa {table.table_number}
                </h1>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <span>Pedido #{order.id}</span>
                  <span>•</span>
                  <span>{table.zone_name}</span>
                  {table.capacity && (
                    <>
                      <span>•</span>
                      <Users className="h-3 w-3" />
                      <span>{table.capacity} personas</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(order.total_amount)}
              </div>
              <div className="text-sm text-gray-500">
                Total a pagar
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selección de tipo de pago */}
      {!paymentMode && (
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                ¿Cómo desea procesar el pago?
              </h2>
              <p className="text-gray-600">
                Seleccione el tipo de pago que mejor se adapte a sus necesidades
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pago Completo */}
              <button
                onClick={() => setPaymentMode('full')}
                className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CreditCard className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Pago Completo</h3>
                </div>
                <p className="text-gray-600 text-sm">
                  Un solo pago por el total de la cuenta
                </p>
                <div className="mt-3 text-xl font-bold text-blue-600">
                  {formatCurrency(order.total_amount)}
                </div>
              </button>

              {/* Pago Dividido */}
              <button
                onClick={() => setPaymentMode('split')}
                className="p-6 border-2 border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-all duration-200 text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Split className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Dividir Cuenta</h3>
                </div>
                <p className="text-gray-600 text-sm">
                  Procesar pagos parciales por items específicos
                </p>
                <div className="mt-3 text-sm text-green-600 font-medium">
                  {order.items.length} items disponibles
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pago Completo */}
      {paymentMode === 'full' && (
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Pago Completo</h2>
                <button
                  onClick={() => navigate(`/table/${tableId}/order-edit`, { state: { orderId: orderId }})}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Resumen del pedido */}
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen del Pedido</h3>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900">{item.recipe_name}</span>
                      {item.is_takeaway && (
                        <Package className="h-3 w-3 text-orange-500" />
                      )}
                    </div>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(item.total_price)}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-3">
                  <div className="flex items-center justify-between text-lg font-semibold">
                    <span>Total:</span>
                    <span className="text-blue-600">{formatCurrency(order.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Método de pago */}
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Método de Pago</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['CASH', 'CARD', 'TRANSFER', 'YAPE_PLIN', 'OTHER'].map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`p-4 border-2 rounded-lg transition-all duration-200 ${
                      paymentMethod === method
                        ? getPaymentMethodColor(method) + ' border-current'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {getPaymentMethodIcon(method)}
                      <span className="text-sm font-medium">
                        {getPaymentMethodName(method)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Notas */}
            <div className="p-6 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas del Pago (Opcional)
              </label>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Ej: Cliente pagó con billete de 100, cambio: 20"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            {/* Botón de pago */}
            <div className="p-6">
              <button
                onClick={handleFullPayment}
                disabled={processing}
                className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold text-lg flex items-center justify-center gap-3"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Procesando pago...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Procesar Pago - {formatCurrency(order.total_amount)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pago Dividido */}
      {paymentMode === 'split' && (
        <div className="max-w-6xl mx-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Panel izquierdo - Items */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Items del Pedido</h2>
                  <button
                    onClick={() => navigate(`/table/${tableId}/order-edit`, { state: { orderId: orderId }})}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Selecciona los items para cada pago
                </p>
              </div>

              <div className="p-4 max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {order.items.map((item) => {
                    const isAssigned = selectedItems[item.id] !== null;
                    const isSelectedForCurrent = selectedItems[item.id] === splitPayments.length;
                    const assignedToSplit = selectedItems[item.id];

                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleItemSelection(item.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                          isAssigned && !isSelectedForCurrent
                            ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                            : isSelectedForCurrent
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-blue-25'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              isSelectedForCurrent 
                                ? 'bg-blue-600 border-blue-600' 
                                : 'border-gray-300'
                            }`}>
                              {isSelectedForCurrent && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 flex items-center gap-2">
                                {item.recipe_name}
                                {item.is_takeaway && (
                                  <Package className="h-3 w-3 text-orange-500" />
                                )}
                              </div>
                              {item.notes && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {item.notes}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-gray-900">
                              {formatCurrency(item.total_price)}
                            </div>
                            {isAssigned && !isSelectedForCurrent && (
                              <div className="text-xs text-gray-500">
                                Pago {assignedToSplit + 1}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Panel derecho - Pagos */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Configurar Pagos</h2>
                <div className="text-sm text-gray-600 mt-1">
                  <span>Restante: </span>
                  <span className="font-medium text-blue-600">
                    {formatCurrency(getRemainingAmount())}
                  </span>
                </div>
              </div>

              <div className="p-4">
                {/* Pago actual */}
                <div className="mb-6">
                  <h3 className="text-md font-medium text-gray-900 mb-3">
                    Pago {splitPayments.length + 1}
                  </h3>

                  {/* Método de pago para split actual */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Método de Pago
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['CASH', 'CARD', 'YAPE_PLIN', 'TRANSFER'].map((method) => (
                        <button
                          key={method}
                          onClick={() => setCurrentSplitMethod(method)}
                          className={`p-2 border rounded-lg text-sm transition-all duration-200 ${
                            currentSplitMethod === method
                              ? getPaymentMethodColor(method) + ' border-current'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(method)}
                            <span>{getPaymentMethodName(method)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Items seleccionados para el split actual */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Items Seleccionados
                    </label>
                    <div className="bg-gray-50 rounded-lg p-3 min-h-20">
                      {getCurrentSplitItems().length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-2">
                          Selecciona items de la lista
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {getCurrentSplitItems().map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-gray-900">{item.recipe_name}</span>
                              <span className="font-medium">{formatCurrency(item.total_price)}</span>
                            </div>
                          ))}
                          <div className="border-t pt-1 mt-2">
                            <div className="flex justify-between font-semibold text-sm">
                              <span>Subtotal:</span>
                              <span className="text-blue-600">{formatCurrency(getCurrentSplitTotal())}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notas del split */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notas (Opcional)
                    </label>
                    <input
                      type="text"
                      value={currentSplitNotes}
                      onChange={(e) => setCurrentSplitNotes(e.target.value)}
                      placeholder="Notas para este pago"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {/* Botón procesar pago parcial */}
                  <button
                    onClick={() => {
                      if (getCurrentSplitItems().length > 0) {
                        addSplitPayment();
                        // Procesar inmediatamente
                        setTimeout(() => {
                          handleSplitPayments();
                        }, 100);
                      }
                    }}
                    disabled={getCurrentSplitItems().length === 0}
                    className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Procesar Pago Parcial
                  </button>
                </div>

                {/* Pagos agregados */}
                {splitPayments.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="text-md font-medium text-gray-900 mb-3">
                      Pagos Configurados ({splitPayments.length})
                    </h3>
                    
                    <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                      {splitPayments.map((split, index) => (
                        <div key={split.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">Pago {index + 1}</span>
                                <span className="text-xs px-2 py-1 bg-white rounded border">
                                  {getPaymentMethodName(split.payment_method)}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600">
                                {split.items.length} item(s) • {formatCurrency(split.amount)}
                              </div>
                            </div>
                            <button
                              onClick={() => removeSplitPayment(index)}
                              className="text-red-600 hover:text-red-800 p-1"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Botón procesar pagos divididos */}
                    {getUnassignedItems().length === 0 && (
                      <button
                        onClick={handleSplitPayments}
                        disabled={processing}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
                      >
                        {processing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Procesando...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Procesar {splitPayments.length} Pagos
                          </>
                        )}
                      </button>
                    )}

                    {getUnassignedItems().length > 0 && (
                      <div className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          Faltan {getUnassignedItems().length} items por asignar
                        </p>
                      </div>
                    )}
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

export default TablePaymentEcommerce;