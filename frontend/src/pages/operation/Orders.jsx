import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, CreditCard, Trash2 } from 'lucide-react';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Orders = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  // Recargar órdenes cuando regresemos a esta vista
  useEffect(() => {
    const handleFocus = () => {
      loadOrders();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await apiService.orders.getAll();
      
      // Mostrar solo órdenes CREATED (no pagadas) - las PAID no se muestran
      const activeOrders = Array.isArray(data) ? 
        data.filter(order => order.status === 'CREATED') : [];
      
      // Cargar los items de cada orden para verificar si se puede eliminar y contar items
      const ordersWithItems = await Promise.all(
        activeOrders.map(async (order) => {
          try {
            const orderDetails = await apiService.orders.getById(order.id);
            const items = orderDetails.items || [];
            const allItemsDelivered = items.length > 0 && items.every(item => item.status === 'SERVED');
            return {
              ...order,
              items: items,
              items_count: items.length,
              all_items_delivered: allItemsDelivered
            };
          } catch (error) {
            console.error(`Error loading items for order ${order.id}:`, error);
            return {
              ...order,
              items: [],
              items_count: 0,
              all_items_delivered: false
            };
          }
        })
      );
      
      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Error loading orders:', error);
      showError('Error al cargar los pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    navigate('/orders/new');
  };

  const handleEdit = (order) => {
    navigate(`/orders/${order.id}/edit`);
  };

  const handlePayment = (order) => {
    navigate(`/orders/${order.id}/payment`);
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await apiService.orders.updateStatus(orderId, newStatus);
      await loadOrders();
      showSuccess(`Estado actualizado a ${getStatusText(newStatus)}`);
    } catch (error) {
      console.error('Error updating order status:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message;
      showError('Error al actualizar el estado del pedido: ' + errorMessage);
    }
  };

  // Verificar si una orden puede ser eliminada (todos los items deben estar CREATED)
  const canDeleteOrder = (order) => {
    // Si no tiene items cargados, asumir que se puede eliminar si está CREATED
    if (!order.items || order.items.length === 0) {
      return order.status === 'CREATED';
    }
    // Verificar que todos los items estén en estado CREATED
    return order.items.every(item => item.status === 'CREATED');
  };

  const handleDelete = async (order) => {
    // Verificar si se puede eliminar
    if (!canDeleteOrder(order)) {
      showError('No se puede eliminar este pedido porque tiene items que ya fueron entregados');
      return;
    }

    if (window.confirm('¿Estás seguro de que deseas eliminar este pedido?')) {
      try {
        await apiService.orders.delete(order.id);
        await loadOrders();
        showSuccess('Pedido eliminado exitosamente');
      } catch (error) {
        console.error('Error deleting order:', error);
        const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message;
        showError('Error al eliminar el pedido: ' + errorMessage);
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
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

  const getStatusColor = (status) => {
    const colors = {
      'CREATED': 'bg-yellow-100 text-yellow-800',
      'SERVED': 'bg-blue-100 text-blue-800',
      'PAID': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const statusTexts = {
      'CREATED': 'Creado',
      'SERVED': 'Entregado',
      'PAID': 'Pagado'
    };
    return statusTexts[status] || status;
  };

  // Solo mostramos órdenes CREATED
  const filteredOrders = orders;

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-sm md:text-base text-gray-600">Gestiona los pedidos del restaurante</p>
        </div>
        <Button onClick={handleAdd} className="flex items-center gap-2 w-full sm:w-auto justify-center">
          <Plus className="h-4 w-4" />
          Nuevo
        </Button>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow">

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pedido
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zona
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mesa
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mesero
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    No hay pedidos activos
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        #{order.id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {order.zone_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {order.table_number || order.table}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {order.waiter_name || order.waiter || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {order.items_count || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(order)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          title="Editar pedido"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        
                        {order.all_items_delivered && (
                          <button
                            onClick={() => handlePayment(order)}
                            className="text-green-600 hover:text-green-900 p-1 rounded"
                            title="Procesar pago"
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>
                        )}
                        
                        {canDeleteOrder(order) && (
                          <button
                            onClick={() => handleDelete(order)}
                            className="text-red-600 hover:text-red-900 p-1 rounded"
                            title="Eliminar pedido"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
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
              <div className="text-4xl mb-2">🍽️</div>
              <p className="text-lg font-medium">No hay pedidos activos</p>
              <p className="text-sm">Los nuevos pedidos aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="space-y-3">
                    {/* Order header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Pedido #{order.id}</h3>
                        <p className="text-sm text-gray-600">{order.zone_name} - Mesa {order.table_number || order.table}</p>
                        <p className="text-sm text-gray-500">Mesero: {order.waiter_name || order.waiter || 'N/A'}</p>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
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
                      <dd className="text-sm text-gray-900">{formatDate(order.created_at)}</dd>
                    </div>
                    
                    {/* Action buttons for mobile */}
                    <div className="flex gap-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => handleEdit(order)}
                        className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
                      >
                        <Edit className="h-4 w-4 inline mr-2" />
                        Editar
                      </button>
                      
                      {order.all_items_delivered && (
                        <button
                          onClick={() => handlePayment(order)}
                          className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors text-center"
                        >
                          <CreditCard className="h-4 w-4 inline mr-2" />
                          Cobrar
                        </button>
                      )}
                      
                      {canDeleteOrder(order) && (
                        <button
                          onClick={() => handleDelete(order)}
                          className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors text-center"
                        >
                          <Trash2 className="h-4 w-4 inline mr-2" />
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Orders;