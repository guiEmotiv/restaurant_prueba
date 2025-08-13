import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Search, Calendar, Eye, X, Printer } from 'lucide-react';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import bluetoothPrinter from '../../services/bluetoothPrinter';

const PaymentHistory = () => {
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    loadPaidOrders();
  }, [selectedDate]);

  const loadPaidOrders = async () => {
    try {
      setLoading(true);
      const data = await apiService.orders.getAll();
      
      // Filtrar solo órdenes pagadas
      let paidOrders = Array.isArray(data) ? 
        data.filter(order => order.status === 'PAID') : [];
      
      // Filtrar por fecha si está seleccionada
      if (selectedDate) {
        paidOrders = paidOrders.filter(order => {
          const orderDate = new Date(order.paid_at || order.created_at).toLocaleDateString('en-CA');
          return orderDate === selectedDate;
        });
      }
      
      // Ordenar por ID descendente (más reciente primero)
      paidOrders.sort((a, b) => b.id - a.id);
      
      setOrders(paidOrders);
    } catch (error) {
      console.error('Error loading paid orders:', error);
      showError('Error al cargar el historial de pagos');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (orderId) => {
    try {
      setDetailLoading(true);
      const orderDetail = await apiService.orders.getById(orderId);
      setSelectedOrderDetail(orderDetail);
    } catch (error) {
      console.error('Error loading order details:', error);
      showError('Error al cargar el detalle del pedido');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedOrderDetail(null);
  };

  const handlePrintReceipt = async () => {
    if (!selectedOrderDetail) return;
    
    try {
      setPrinting(true);
      
      if (!bluetoothPrinter.isBluetoothSupported()) {
        showError(bluetoothPrinter.getBluetoothErrorMessage());
        return;
      }

      // Conectar si no está conectado
      if (!bluetoothPrinter.isConnected) {
        await bluetoothPrinter.connect();
      }

      const receiptData = {
        order: {
          id: selectedOrderDetail.id,
          table_number: selectedOrderDetail.table_number,
          waiter: selectedOrderDetail.waiter || 'Usuario',
          created_at: selectedOrderDetail.created_at,
          total_amount: selectedOrderDetail.total_amount,
          items: selectedOrderDetail.items?.map(item => ({
            recipe_name: item.recipe_name,
            quantity: item.quantity,
            total_price: item.total_with_container || item.total_price,
            is_takeaway: item.is_takeaway
          })) || []
        },
        payment: {
          created_at: selectedOrderDetail.paid_at || selectedOrderDetail.created_at
        },
        amount: selectedOrderDetail.items?.reduce((sum, item) => 
          sum + parseFloat(item.total_with_container || item.total_price || 0), 0
        ) || parseFloat(selectedOrderDetail.total_amount)
      };

      await bluetoothPrinter.printPaymentReceipt(receiptData);
      showSuccess('Comprobante impreso exitosamente');
    } catch (error) {
      console.error('Error printing receipt:', error);
      showError(`Error al imprimir: ${error.message}`);
    } finally {
      setPrinting(false);
    }
  };


  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredOrders = orders.filter(order => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      order.id.toString().includes(searchLower) ||
      order.table_number.toLowerCase().includes(searchLower) ||
      order.zone_name.toLowerCase().includes(searchLower)
    );
  });


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

  return (
    <div className="space-y-6">

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por número de orden o mesa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mesa
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha/Hora
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No se encontraron órdenes pagadas
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {order.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">
                        Mesa {order.table_number}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.zone_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">
                        {order.items_count || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {formatDate(order.paid_at || order.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleViewDetails(order.id)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden">
          {filteredOrders.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-lg font-medium">No se encontraron órdenes pagadas</p>
              <p className="text-sm">{selectedDate ? 'Intenta seleccionar otra fecha' : 'Las órdenes pagadas aparecerán aquí'}</p>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="space-y-3">
                    {/* Order header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">ID: {order.id}</h3>
                        <p className="text-sm text-gray-600">Mesa {order.table_number}</p>
                        <p className="text-xs text-gray-500">{order.zone_name}</p>
                      </div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Pagado
                      </span>
                    </div>
                    
                    {/* Order details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="font-medium text-gray-500">Items</dt>
                        <dd className="text-base font-semibold text-gray-900">{order.items_count || 0}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-500">Total</dt>
                        <dd className="text-base font-bold text-gray-900">{formatCurrency(order.total_amount)}</dd>
                      </div>
                    </div>
                    
                    {/* Date */}
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Fecha</dt>
                      <dd className="text-sm text-gray-900">{formatDate(order.paid_at || order.created_at)}</dd>
                    </div>
                    
                    {/* Action buttons for mobile */}
                    <div className="flex gap-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => handleViewDetails(order.id)}
                        className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
                      >
                        <Eye className="h-4 w-4 inline mr-2" />
                        Ver Detalles
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalle del Pedido */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header del Modal */}
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">
                  Detalle Pedido #{selectedOrderDetail.id}
                </h3>
                <p className="text-sm text-gray-600">
                  Mesa {selectedOrderDetail.table_number} • {formatDate(selectedOrderDetail.paid_at || selectedOrderDetail.created_at)}
                </p>
              </div>
              <button
                onClick={handleCloseDetail}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {detailLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Items del Pedido */}
                  <div>
                    <h4 className="font-medium text-gray-800 mb-3">Items del Pedido</h4>
                    <div className="space-y-2">
                      {selectedOrderDetail.items?.map((item, index) => (
                        <div key={item.id || index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0" 
                              title="Pagado"
                            />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {item.quantity}x {item.recipe_name}
                              </div>
                              {item.notes && (
                                <div className="text-xs text-gray-500 italic">{item.notes}</div>
                              )}
                              {item.is_takeaway && (
                                <div className="text-xs text-blue-600">Para llevar</div>
                              )}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            S/ {item.total_price}
                          </div>
                        </div>
                      )) || []}
                    </div>
                  </div>

                  {/* Resumen del Total */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span>{formatCurrency(selectedOrderDetail.total_amount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="p-6 border-t bg-gray-50">
              <div className="flex gap-3">
                <button
                  onClick={handleCloseDetail}
                  className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={handlePrintReceipt}
                  disabled={printing}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {printing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Imprimiendo...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4" />
                      Imprimir Comprobante
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PaymentHistory;