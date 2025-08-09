import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { 
  ArrowLeft, 
  Clock, 
  DollarSign, 
  Table, 
  CheckCircle, 
  XCircle, 
  CreditCard
} from 'lucide-react';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const orderData = await apiService.orders.getById(id);
      setOrder(orderData);
      
      const itemsResponse = await apiService.orderItems.getAll();
      const orderItemsData = Array.isArray(itemsResponse) ? 
        itemsResponse.filter(item => item.order === parseInt(id)) : [];
      setOrderItems(orderItemsData);
    } catch (error) {
      console.error('Error loading order:', error);
      showError('Error al cargar la orden');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      await apiService.orders.updateStatus(order.id, newStatus);
      await loadOrder();
      showSuccess(`Estado actualizado a ${getStatusText(newStatus)}`);
    } catch (error) {
      console.error('Error updating order status:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message;
      showError('Error al actualizar el estado de la orden: ' + errorMessage);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
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

  const getStatusIcon = (status) => {
    const icons = {
      'CREATED': <Clock className="h-5 w-5" />,
      'SERVED': <CheckCircle className="h-5 w-5" />,
      'PAID': <CreditCard className="h-5 w-5" />
    };
    return icons[status] || <Clock className="h-5 w-5" />;
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
      <div className="text-center py-12">
        <p className="text-gray-500">Orden no encontrada</p>
        <Button onClick={() => navigate('/')} className="mt-4">
          Volver a órdenes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          onClick={() => navigate('/')}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orden #{order.id}</h1>
          <p className="text-gray-600">Mesa {order.table_number || order.table}</p>
        </div>
      </div>

      {/* Order Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center p-4 bg-blue-50 rounded-lg">
            <Table className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-blue-600">Mesa</p>
              <p className="text-lg font-semibold text-blue-900">
                {order.table_number || order.table}
              </p>
            </div>
          </div>

          <div className="flex items-center p-4 bg-green-50 rounded-lg">
            <DollarSign className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-green-600">Total</p>
              <p className="text-lg font-semibold text-green-900">
                {formatCurrency(order.total_amount)}
              </p>
            </div>
          </div>

          <div className="flex items-center p-4 bg-purple-50 rounded-lg">
            {getStatusIcon(order.status)}
            <div className="ml-3">
              <p className="text-sm text-purple-600">Estado</p>
              <p className="text-lg font-semibold text-purple-900">
                {getStatusText(order.status)}
              </p>
            </div>
          </div>

          <div className="flex items-center p-4 bg-orange-50 rounded-lg">
            <Clock className="h-8 w-8 text-orange-600 mr-3" />
            <div>
              <p className="text-sm text-orange-600">Creada</p>
              <p className="text-lg font-semibold text-orange-900">
                {formatDate(order.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Status Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          {order.status === 'READY' && (
            <Button
              onClick={() => handleStatusUpdate('SERVED')}
              variant="success"
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Marcar como Servido
            </Button>
          )}
          
          {order.status === 'SERVED' && (
            <Button
              onClick={() => handleStatusUpdate('PAID')}
              variant="success"
              className="flex items-center gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Procesar Pago
            </Button>
          )}
          
          {(order.status === 'CREATED' || order.status === 'READY' || order.status === 'SERVED') && (
            <Button
              onClick={() => handleStatusUpdate('CANCELLED')}
              variant="danger"
              className="flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Cancelar Orden
            </Button>
          )}
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Items de la Orden</h2>
        </div>
        
        <div className="p-6">
          {orderItems.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No hay items en esta orden
            </p>
          ) : (
            <div className="space-y-4">
              {orderItems.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {item.recipe_name || item.recipe}
                      </h3>
                      {item.notes && (
                        <p className="text-sm text-gray-600 mt-1">
                          Notas: {item.notes}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatCurrency(item.total_price)}
                        </p>
                        <p className="text-sm text-gray-600">
                          Precio unitario: {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {getStatusText(item.status)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order Timeline */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Historial de la Orden</h2>
        <div className="space-y-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-900">Orden creada</p>
              <p className="text-sm text-gray-500">{formatDate(order.created_at)}</p>
            </div>
          </div>
          
          {order.served_at && (
            <div className="flex items-center">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Orden servida</p>
                <p className="text-sm text-gray-500">{formatDate(order.served_at)}</p>
              </div>
            </div>
          )}
          
          {order.paid_at && (
            <div className="flex items-center">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Pago procesado</p>
                <p className="text-sm text-gray-500">{formatDate(order.paid_at)}</p>
              </div>
            </div>
          )}
          
          {order.cancelled_at && (
            <div className="flex items-center">
              <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Orden cancelada</p>
                <p className="text-sm text-gray-500">{formatDate(order.cancelled_at)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;