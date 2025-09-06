import { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/api';
import { Search, Clock, Users, MapPin, ChefHat, CreditCard, AlertCircle, CheckCircle2, Truck, RefreshCw } from 'lucide-react';

const OrderTracker = () => {
  const { showToast } = useToast();
  
  // Estados
  const [orderNumber, setOrderNumber] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Función para buscar pedido
  const handleSearchOrder = async (e) => {
    e.preventDefault();
    
    if (!orderNumber.trim()) {
      showToast('❌ Ingresa un número de pedido', 'error');
      return;
    }

    setLoading(true);
    setNotFound(false);
    setOrderData(null);

    try {
      // [OrderTracker] Buscando pedido #${orderNumber}
      const response = await apiService.orders.getById(orderNumber.trim());
      
      if (response) {
        setOrderData(response);
        // [OrderTracker] Pedido encontrado
        showToast(`✅ Pedido #${orderNumber} encontrado`, 'success');
      } else {
        setNotFound(true);
        showToast(`❌ Pedido #${orderNumber} no encontrado`, 'error');
      }
      
    } catch (error) {
      console.error('Error buscando pedido:', error);
      setNotFound(true);
      if (error.response?.status === 404) {
        showToast(`❌ Pedido #${orderNumber} no encontrado`, 'error');
      } else {
        showToast('❌ Error al buscar pedido', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Función para actualizar consulta (refresh)
  const handleRefreshOrder = async () => {
    if (!orderData || !orderData.id) {
      showToast('❌ No hay pedido para actualizar', 'error');
      return;
    }

    setRefreshing(true);

    try {
      // [OrderTracker] Actualizando pedido #${orderData.id}
      const response = await apiService.orders.getById(orderData.id);
      
      if (response) {
        setOrderData(response);
        // [OrderTracker] Pedido actualizado
        showToast(`✅ Pedido #${orderData.id} actualizado`, 'success');
      } else {
        showToast(`❌ Error al actualizar pedido #${orderData.id}`, 'error');
      }
      
    } catch (error) {
      console.error('Error actualizando pedido:', error);
      showToast('❌ Error al actualizar pedido', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // Función para obtener color del estado
  const getStatusColor = (status) => {
    switch (status) {
      case 'CREATED':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'PREPARING':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'SERVED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PAID':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'CANCELED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Función para obtener icono del estado
  const getStatusIcon = (status) => {
    switch (status) {
      case 'CREATED':
        return <AlertCircle className="w-4 h-4" />;
      case 'PREPARING':
        return <ChefHat className="w-4 h-4" />;
      case 'SERVED':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'PAID':
        return <CreditCard className="w-4 h-4" />;
      case 'CANCELED':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  // Función para formatear fecha
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Función para obtener el historial de estados de un item
  const getItemStatusHistory = (item) => {
    const history = [];
    
    // Para items cancelados, mostrar CREATED y CANCELED
    if (item.status === 'CANCELED') {
      // Agregar estado CREATED
      if (item.created_at) {
        history.push({
          status: 'CREATED',
          datetime: item.created_at,
          label: 'Creado'
        });
      }
      
      // Agregar estado CANCELED con la fecha real de cancelación
      if (item.canceled_at) {
        history.push({
          status: 'CANCELED',
          datetime: item.canceled_at,
          label: 'Cancelado'
        });
      }
      
      return history.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    }
    
    // Estado CREATED (siempre existe para items no cancelados)
    if (item.created_at) {
      history.push({
        status: 'CREATED',
        datetime: item.created_at,
        label: 'Creado'
      });
    }
    
    // Estado PREPARING (si existe)
    if (item.preparing_at) {
      history.push({
        status: 'PREPARING', 
        datetime: item.preparing_at,
        label: 'En preparación'
      });
    }
    
    // Estado SERVED (si existe)
    if (item.served_at) {
      history.push({
        status: 'SERVED',
        datetime: item.served_at, 
        label: 'Servido'
      });
      
      // Si el estado actual es PAID y se ha servido
      if (item.status === 'PAID') {
        history.push({
          status: 'PAID',
          datetime: item.served_at, // Aproximación, ya que no hay paid_at en items
          label: 'Pagado'
        });
      }
    }
    
    return history.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  };

  // Función para calcular tiempo transcurrido
  const getElapsedTime = (startDate, endDate = null) => {
    if (!startDate) return 'N/A';
    
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffMs = end - start;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Consulta de Pedidos</h1>
          <p className="text-gray-600">Ingresa el número de pedido para ver su estado detallado en tiempo real</p>
        </div>

        {/* Formulario de búsqueda */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <form onSubmit={handleSearchOrder} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Pedido
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="Ej: 123"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  min="1"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${
                loading 
                  ? 'bg-gray-400 cursor-not-allowed text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Buscar Pedido
                </>
              )}
            </button>
          </form>
        </div>

        {/* Estado: No encontrado */}
        {notFound && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-red-800 mb-2">Pedido No Encontrado</h3>
            <p className="text-red-600">El pedido #{orderNumber} no existe o fue eliminado.</p>
          </div>
        )}

        {/* Información del pedido */}
        {orderData && (
          <div className="space-y-6">
            
            {/* Header del pedido */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Pedido #{orderData.id}</h2>
                  <p className="text-gray-600">Creado el {formatDateTime(orderData.created_at)}</p>
                </div>
                
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleRefreshOrder}
                    disabled={refreshing}
                    className={`px-4 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                      refreshing 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' 
                        : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Actualizando...' : 'Actualizar'}
                  </button>
                  
                  <div className={`px-4 py-2 rounded-full border text-sm font-medium flex items-center gap-2 ${getStatusColor(orderData.status)}`}>
                    {getStatusIcon(orderData.status)}
                    {orderData.status}
                  </div>
                </div>
              </div>

              {/* Información general */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <MapPin className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Mesa</p>
                    <p className="font-semibold">{orderData.table?.table_number || orderData.table_number || 'N/A'}</p>
                    <p className="text-xs text-gray-400">{orderData.table?.zone_name || orderData.zone_name || ''}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Cliente</p>
                    <p className="font-semibold">{orderData.customer_name || 'N/A'}</p>
                    <p className="text-xs text-gray-400">{orderData.party_size} personas</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <CreditCard className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="font-semibold">S/ {parseFloat(orderData.grand_total || orderData.total_amount || 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">
                      {orderData.is_fully_paid ? 'Pagado' : `Pendiente: S/ ${parseFloat(orderData.pending_amount || 0).toFixed(2)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tiempo Total</p>
                    <p className="font-semibold">{getElapsedTime(orderData.created_at)}</p>
                    <p className="text-xs text-gray-400">Desde creación</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline del pedido */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Historial de Estados</h3>
              
              <div className="relative">
                {/* Línea de conexión */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                
                <div className="space-y-6">
                  {/* Creado */}
                  <div className="flex items-start gap-4 relative">
                    <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center border-2 border-yellow-200 relative z-10">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">Pedido Creado</h4>
                        <div className="text-right">
                          <span className="text-sm text-gray-900">{formatDateTime(orderData.created_at)}</span>
                          <p className="text-xs text-gray-500">Estado: CREATED</p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>• Mesero: {orderData.waiter_name || orderData.waiter || 'N/A'}</p>
                        <p>• Items: {orderData.items?.length || 0} productos</p>
                        <p>• Total: S/ {parseFloat(orderData.grand_total || orderData.total_amount || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Preparando */}
                  {(orderData.status === 'PREPARING' || orderData.status === 'SERVED' || orderData.status === 'PAID') && (
                    <div className="flex items-start gap-4 relative">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center border-2 border-blue-200 relative z-10">
                        <ChefHat className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">En Preparación</h4>
                          <div className="text-right">
                            <span className="text-sm text-gray-900">
                              {(() => {
                                // Buscar la primera fecha de preparing_at en los items
                                const preparingItems = orderData.items?.filter(item => item.preparing_at) || [];
                                if (preparingItems.length > 0) {
                                  // Obtener la fecha más temprana de preparing
                                  const earliestPreparing = preparingItems.reduce((earliest, item) => 
                                    !earliest || new Date(item.preparing_at) < new Date(earliest) ? item.preparing_at : earliest
                                  , null);
                                  return formatDateTime(earliestPreparing);
                                }
                                return orderData.preparing_at ? formatDateTime(orderData.preparing_at) : 'En proceso...';
                              })()}
                            </span>
                            <p className="text-xs text-gray-500">Estado: PREPARING</p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>• Items enviados a cocina</p>
                          <p>• Tiempo desde creación: {getElapsedTime(orderData.created_at, orderData.preparing_at)}</p>
                          {orderData.items && (
                            <p>• Items en cocina: {orderData.items.filter(item => item.status === 'PREPARING').length}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Servido */}
                  {(orderData.status === 'SERVED' || orderData.status === 'PAID') && (
                    <div className="flex items-start gap-4 relative">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center border-2 border-green-200 relative z-10">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">Pedido Servido</h4>
                          <div className="text-right">
                            <span className="text-sm text-gray-900">
                              {orderData.served_at ? formatDateTime(orderData.served_at) : 'Completado'}
                            </span>
                            <p className="text-xs text-gray-500">Estado: SERVED</p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>• Todos los items completados</p>
                          <p>• Listo para procesar pago</p>
                          {orderData.served_at && (
                            <p>• Tiempo de preparación: {getElapsedTime(orderData.preparing_at || orderData.created_at, orderData.served_at)}</p>
                          )}
                          {orderData.items && (
                            <p>• Items servidos: {orderData.items.filter(item => item.status === 'SERVED').length}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pagado */}
                  {orderData.status === 'PAID' && (
                    <div className="flex items-start gap-4 relative">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center border-2 border-purple-200 relative z-10">
                        <CreditCard className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">Pago Completado</h4>
                          <div className="text-right">
                            <span className="text-sm text-gray-900">
                              {orderData.paid_at ? formatDateTime(orderData.paid_at) : 'Completado'}
                            </span>
                            <p className="text-xs text-gray-500">Estado: PAID</p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>• Pedido completamente finalizado</p>
                          <p>• Total pagado: S/ {parseFloat(orderData.total_paid || orderData.grand_total || 0).toFixed(2)}</p>
                          {orderData.paid_at && (
                            <p>• Tiempo total del pedido: {getElapsedTime(orderData.created_at, orderData.paid_at)}</p>
                          )}
                          {orderData.payments && (
                            <p>• Pagos realizados: {orderData.payments.length}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Estado actual si no está completado */}
                  {orderData.status !== 'PAID' && (
                    <div className="flex items-start gap-4 relative">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center border-2 border-gray-300 relative z-10">
                        <Clock className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-600">Próximo paso</h4>
                          <span className="text-xs text-gray-500">Pendiente</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {orderData.status === 'CREATED' && '• Esperando envío a cocina'}
                          {orderData.status === 'PREPARING' && '• Esperando finalización de cocina'}
                          {orderData.status === 'SERVED' && '• Esperando procesamiento de pago'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items del pedido */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Items del Pedido ({orderData.items?.length || 0})</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 font-medium text-gray-900">Producto</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-900">Cantidad</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-900">Estado</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-900">Fecha/Hora</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-900">Precio Unit.</th>
                      <th className="text-center py-3 px-2 font-medium text-gray-900">Total</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-900">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderData.items?.sort((a, b) => {
                      // Ordenar por created_at del item (más reciente primero)
                      return new Date(b.created_at) - new Date(a.created_at);
                    }).map((item, itemIndex) => {
                      const statusHistory = getItemStatusHistory(item);
                      return statusHistory.map((historyEntry, historyIndex) => (
                        <tr key={`${itemIndex}-${historyIndex}`} 
                            className={`border-b border-gray-100 hover:bg-gray-50 ${
                              historyIndex === 0 ? 'border-t-2 border-t-blue-200' : ''
                            } ${
                              historyIndex === statusHistory.length - 1 ? 'border-b-2 border-b-blue-200' : ''
                            }`}>
                          {/* Producto - Solo mostrar en la primera fila del item */}
                          <td className="py-2 px-2">
                            {historyIndex === 0 ? (
                              <div>
                                <p className="font-medium text-gray-900">{item.recipe_name}</p>
                                {item.is_takeaway && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full mt-1">
                                    <Truck className="w-3 h-3" />
                                    Para llevar
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-gray-400 text-xs pl-4">↳ {item.recipe_name}</div>
                            )}
                          </td>
                          
                          {/* Cantidad - Solo mostrar en la primera fila */}
                          <td className="py-2 px-2 text-center">
                            {historyIndex === 0 && (
                              <span className="font-medium">{item.quantity}</span>
                            )}
                          </td>
                          
                          {/* Estado */}
                          <td className="py-2 px-2 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
                              getStatusColor(historyEntry.status)
                            }`}>
                              {getStatusIcon(historyEntry.status)}
                              {historyEntry.label}
                            </span>
                          </td>
                          
                          {/* Fecha/Hora */}
                          <td className="py-2 px-2 text-center text-xs">
                            <div className="font-medium text-gray-900">
                              {formatDateTime(historyEntry.datetime)}
                            </div>
                          </td>
                          
                          {/* Precio - Solo mostrar en la primera fila */}
                          <td className="py-2 px-2 text-center">
                            {historyIndex === 0 && (
                              <span>S/ {parseFloat(item.unit_price || 0).toFixed(2)}</span>
                            )}
                          </td>
                          
                          {/* Total - Solo mostrar en la primera fila */}
                          <td className="py-2 px-2 text-center">
                            {historyIndex === 0 && (
                              <span className="font-semibold">
                                S/ {parseFloat(item.total_with_container || item.total_price || 0).toFixed(2)}
                              </span>
                            )}
                          </td>
                          
                          {/* Notas - Solo mostrar en la primera fila */}
                          <td className="py-2 px-2 text-gray-600 max-w-xs">
                            {historyIndex === 0 && (
                              item.notes ? (
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">{item.notes}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )
                            )}
                          </td>
                        </tr>
                      ));
                    }).flat()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagos realizados */}
            {orderData.payments && orderData.payments.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Pagos Realizados ({orderData.payments.length})</h3>
                
                <div className="space-y-3">
                  {orderData.payments.map((payment, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <CreditCard className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {payment.payment_method === 'CASH' ? 'Efectivo' :
                             payment.payment_method === 'CARD' ? 'Tarjeta' :
                             payment.payment_method === 'YAPE_PLIN' ? 'Yape/Plin' :
                             payment.payment_method === 'TRANSFER' ? 'Transferencia' : payment.payment_method}
                          </p>
                          <p className="text-sm text-gray-500">{formatDateTime(payment.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">S/ {parseFloat(payment.amount || 0).toFixed(2)}</p>
                        {payment.payer_name && (
                          <p className="text-sm text-gray-500">{payment.payer_name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};

export default OrderTracker;