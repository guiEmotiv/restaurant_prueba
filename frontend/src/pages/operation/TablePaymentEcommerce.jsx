import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  CreditCard, 
  Banknote,
  Smartphone,
  Building2,
  DollarSign,
  Check,
  Info,
  Users,
  Package,
  CheckCircle,
  X,
  AlertCircle,
  ShoppingBag,
  Receipt,
  ChevronRight
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const TablePaymentEcommerce = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();
  const { hasPermission } = useAuth();
  
  // Estados principales
  const [table, setTable] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Estados de pago
  const [paymentMode, setPaymentMode] = useState(null); // 'full' o 'split'
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  
  // Estados para pago dividido
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

  const hasPartialPayments = () => {
    if (!order || !order.items) return false;
    return order.items.some(item => item.paid_amount > 0 && !item.is_fully_paid);
  };

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
        itemsMap[item.id] = item.is_fully_paid ? 'paid' : false;
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
      case 'CASH': return <Banknote className="h-3 w-3" />;
      case 'CARD': return <CreditCard className="h-3 w-3" />;
      case 'TRANSFER': return <Building2 className="h-3 w-3" />;
      case 'YAPE_PLIN': return <Smartphone className="h-3 w-3" />;
      default: return <DollarSign className="h-3 w-3" />;
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
    const item = order.items.find(i => i.id === itemId);
    if (item && item.is_fully_paid) {
      return;
    }
    
    setSelectedItems({
      ...selectedItems,
      [itemId]: !selectedItems[itemId]
    });
  };

  const getSelectedItems = () => {
    return order.items.filter(item => selectedItems[item.id] === true);
  };

  const getSelectedTotal = () => {
    return getSelectedItems().reduce((total, item) => total + parseFloat(item.total_price), 0);
  };

  const handlePartialPayment = async () => {
    const selectedSplitItems = getSelectedItems();
    
    if (selectedSplitItems.length === 0) {
      showError('Debe seleccionar al menos un item para pagar');
      return;
    }

    try {
      setProcessing(true);
      
      const partialPayment = {
        items: selectedSplitItems.map(item => item.id),
        payment_method: currentSplitMethod,
        amount: parseFloat(getSelectedTotal()).toFixed(2),
        notes: currentSplitNotes || ''
      };

      await apiService.orders.splitPayment(orderId, { splits: [partialPayment] });
      showSuccess(`Pago parcial procesado exitosamente - ${formatCurrency(getSelectedTotal())}`);
      
      // Recargar datos
      await loadData();
      
      // Verificar si todos los items están pagados
      const orderData = await apiService.orders.getById(orderId);
      const orderFullyPaid = orderData.items && orderData.items.length > 0 && 
        orderData.items.every(item => item.is_fully_paid);
        
      if (orderFullyPaid) {
        showSuccess('¡Pedido completamente pagado!');
        setTimeout(() => {
          navigate('/table-status');
        }, 2000);
      }
      
    } catch (error) {
      console.error('Error processing partial payment:', error);
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

  const getUnpaidItems = () => {
    return order.items.filter(item => !item.is_fully_paid);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!table || !order) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Pedido no encontrado</h2>
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
      {/* Header Fixed */}
      <div className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
        <div className="px-3 py-3 pl-16">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/table/${tableId}/order-edit`, { state: { orderId: orderId }})}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-gray-600" />
              </button>
              <div>
                <h1 className="text-base font-medium text-gray-900">Procesar Pago</h1>
                <p className="text-xs text-gray-500">Mesa {table.table_number} • Pedido #{order.id}</p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-base font-semibold text-gray-900">
                {formatCurrency(order.total_amount)}
              </div>
              <div className="text-xs text-gray-500">Total a pagar</div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Mode Selection */}
      {!paymentMode && (
        <div className="p-3 max-w-md mx-auto" style={{paddingTop: '100px'}}>
          <div className="bg-white rounded border border-gray-200 p-4">
            <h2 className="text-base font-medium text-gray-900 mb-4 text-center">
              ¿Cómo desea procesar el pago?
            </h2>

            <div className="space-y-3">
              {/* Full Payment Option */}
              <button
                onClick={() => setPaymentMode('full')}
                className="w-full p-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-medium text-sm">Pago Completo</h3>
                      <p className="text-xs text-blue-100">Un solo pago por todo</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{formatCurrency(order.total_amount)}</div>
                    <div className="text-xs text-blue-100">{order.items.length} items</div>
                  </div>
                </div>
              </button>

              {/* Split Payment Option */}
              <button
                onClick={() => setPaymentMode('split')}
                className="w-full p-4 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-medium text-sm">Dividir Cuenta</h3>
                      <p className="text-xs text-purple-100">Pagar por items</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{getUnpaidItems().length}</div>
                    <div className="text-xs text-purple-100">items disponibles</div>
                  </div>
                </div>
              </button>
            </div>

            {hasPartialPayments() && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-medium text-amber-900">Pagos parciales detectados</p>
                    <p className="text-amber-700">Este pedido tiene pagos parciales pendientes</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Payment Mode */}
      {paymentMode === 'full' && (
        <div className="p-3 max-w-md mx-auto" style={{paddingTop: '100px'}}>
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            {/* Order Summary */}
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-medium text-sm text-gray-900 mb-3">Resumen del pedido</h2>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-900">{item.recipe_name}</span>
                      {item.is_takeaway && (
                        <Package className="h-3 w-3 text-orange-500" />
                      )}
                    </div>
                    <span className="font-medium text-xs text-gray-900">
                      {formatCurrency(item.total_price)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">Total</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-medium text-sm text-gray-900 mb-3">Método de pago</h3>
              <div className="grid grid-cols-2 gap-2">
                {['CASH', 'CARD', 'YAPE_PLIN', 'TRANSFER'].map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`relative p-3 rounded border-2 transition-all ${
                      paymentMethod === method
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="w-6 h-6 mx-auto mb-1 rounded bg-gray-600 text-white flex items-center justify-center">
                      {getPaymentMethodIcon(method)}
                    </div>
                    <span className={`text-xs font-medium ${
                      paymentMethod === method ? 'text-blue-900' : 'text-gray-700'
                    }`}>
                      {getPaymentMethodName(method)}
                    </span>
                    {paymentMethod === method && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="p-4 border-b border-gray-100">
              <button
                onClick={() => setShowNotesModal(true)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-gray-600" />
                  <div className="text-left">
                    <p className="font-medium text-xs text-gray-900">Agregar notas</p>
                    <p className="text-xs text-gray-600">
                      {paymentNotes || 'Opcional'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-3 w-3 text-gray-400" />
              </button>
            </div>

            {/* Process Payment Button */}
            <div className="p-4">
              <button
                onClick={handleFullPayment}
                disabled={processing}
                className="w-full bg-green-600 text-white py-3 rounded font-medium text-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Procesar Pago
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Payment Mode */}
      {paymentMode === 'split' && (
        <div className="p-3 pb-24" style={{paddingTop: '100px'}}>
          {/* Items Selection */}
          <div className="bg-white rounded border border-gray-200 mb-3">
            <div className="p-3 border-b border-gray-100">
              <h2 className="font-medium text-sm text-gray-900">Selecciona los items a pagar</h2>
              <p className="text-xs text-gray-600 mt-1">
                {getSelectedItems().length} de {getUnpaidItems().length} items seleccionados
              </p>
            </div>
            
            <div className="p-3">
              <div className="space-y-2">
                {order.items.map((item) => {
                  const isPaid = item.is_fully_paid;
                  const isSelected = selectedItems[item.id] === true;

                  return (
                    <button
                      key={item.id}
                      onClick={() => !isPaid && toggleItemSelection(item.id)}
                      disabled={isPaid}
                      className={`w-full p-3 rounded border-2 transition-all ${
                        isPaid
                          ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isPaid
                              ? 'bg-gray-300 border-gray-300'
                              : isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300'
                          }`}>
                            {(isSelected || isPaid) && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="text-left">
                            <h4 className="font-medium text-xs text-gray-900">{item.recipe_name}</h4>
                            <div className="flex items-center gap-1 text-xs">
                              {item.is_takeaway && (
                                <span className="flex items-center gap-1 text-orange-600">
                                  <Package className="h-3 w-3" />
                                  Para llevar
                                </span>
                              )}
                              {isPaid && (
                                <span className="text-green-600 font-medium">
                                  Pagado
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-xs text-gray-900">
                            {formatCurrency(item.total_price)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          {getSelectedItems().length > 0 && (
            <div className="bg-white rounded border border-gray-200">
              <div className="p-3 border-b border-gray-100">
                <h3 className="font-medium text-sm text-gray-900">Resumen del pago</h3>
              </div>
              
              <div className="p-3">
                <div className="space-y-1 mb-3">
                  {getSelectedItems().map(item => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="text-gray-700">{item.recipe_name}</span>
                      <span className="font-medium">{formatCurrency(item.total_price)}</span>
                    </div>
                  ))}
                </div>
                
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium text-xs text-gray-900">Total a pagar</span>
                    <span className="text-sm font-semibold text-blue-600">{formatCurrency(getSelectedTotal())}</span>
                  </div>
                  
                  {/* Payment Method for Split */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {['CASH', 'CARD', 'YAPE_PLIN', 'TRANSFER'].map((method) => (
                      <button
                        key={method}
                        onClick={() => setCurrentSplitMethod(method)}
                        className={`p-2 rounded border transition-all ${
                          currentSplitMethod === method
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <div className="w-5 h-5 rounded bg-gray-600 text-white flex items-center justify-center">
                            {getPaymentMethodIcon(method)}
                          </div>
                          <span className={`text-xs font-medium ${
                            currentSplitMethod === method ? 'text-blue-900' : 'text-gray-700'
                          }`}>
                            {getPaymentMethodName(method)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fixed Bottom Action for Split Payment */}
      {paymentMode === 'split' && getSelectedItems().length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-40">
          <button
            onClick={handlePartialPayment}
            disabled={processing}
            className="w-full bg-green-600 text-white py-3 rounded font-medium text-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Procesando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Procesar Pago • {formatCurrency(getSelectedTotal())}
              </>
            )}
          </button>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t w-full p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Notas del pago</h3>
              <button
                onClick={() => setShowNotesModal(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Ej: Cliente pagó con billete de 100, cambio: 20"
              className="w-full px-3 py-2 bg-gray-100 rounded text-xs text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              autoFocus
            />
            
            <button
              onClick={() => setShowNotesModal(false)}
              className="w-full mt-3 bg-blue-600 text-white py-2 rounded font-medium text-sm hover:bg-blue-700 transition-colors"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default TablePaymentEcommerce;