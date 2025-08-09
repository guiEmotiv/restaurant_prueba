import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { 
  ArrowLeft,
  Plus,
  DollarSign,
  Clock,
  Users,
  CreditCard,
  Eye,
  ShoppingCart
} from 'lucide-react';
import { apiService } from '../../services/api';

const OrderManage = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const [table, setTable] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [tableId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tableData, ordersData] = await Promise.all([
        apiService.tables.getById(tableId),
        apiService.orders.getAll()
      ]);
      
      setTable(tableData);
      
      const tableOrders = Array.isArray(ordersData) 
        ? ordersData.filter(order => 
            order.table === parseInt(tableId) && 
            order.status !== 'PAID' && 
            order.status !== 'CANCELLED'
          )
        : [];
      
      setOrders(tableOrders);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar datos');
    } finally {
      setLoading(false);
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
    return new Date(dateString).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'CREATED': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'SERVED': 'bg-blue-100 text-blue-800 border-blue-200',
      'READY': 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusText = (status) => {
    const statusTexts = {
      'CREATED': 'Pendiente',
      'SERVED': 'Entregado',
      'READY': 'Listo'
    };
    return statusTexts[status] || status;
  };

  const getTotalAmount = () => {
    return orders.reduce((total, order) => total + parseFloat(order.total_amount || 0), 0);
  };

  const handleNewOrder = () => {
    navigate(`/operations/table/${tableId}/new`);
  };

  const handlePayment = () => {
    navigate(`/operations/table/${tableId}/payment`);
  };

  const handleViewOrder = (orderId) => {
    // Por ahora solo mostramos un mensaje, después se puede implementar vista detalle
    showSuccess(`Viendo detalles de orden #${orderId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-40 px-4 py-3 border-b">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="pt-20 px-3 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header fijo */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-40 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/operations')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          
          <h1 className="text-lg font-bold text-gray-900">{table?.name}</h1>
          
          <button
            onClick={handleNewOrder}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="pt-20 px-3">
        {/* Resumen de la mesa */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Users className="h-5 w-5 text-red-600" />
              </div>
              <p className="text-xs text-gray-500">Cuentas</p>
              <p className="text-lg font-bold text-gray-900">{orders.length}</p>
            </div>
            
            <div className="text-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(getTotalAmount())}</p>
            </div>
            
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-xs text-gray-500">Estado</p>
              <p className="text-sm font-medium text-blue-600">Ocupada</p>
            </div>
          </div>
        </div>

        {/* Lista de cuentas/órdenes */}
        <div className="space-y-3 mb-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Cuenta #{order.id}</h3>
                      <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                      {getStatusText(order.status)}
                    </span>
                    <button
                      onClick={() => handleViewOrder(order.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Eye className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(order.total_amount)}
                  </span>
                  
                  {order.status === 'SERVED' && (
                    <button
                      onClick={() => navigate(`/operations/order/${order.id}/payment`)}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
                    >
                      <CreditCard className="h-3 w-3" />
                      Pagar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Botón de pago general */}
        {orders.length > 0 && orders.some(order => order.status === 'SERVED') && (
          <div className="sticky bottom-4">
            <button
              onClick={handlePayment}
              className="w-full py-4 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <CreditCard className="h-5 w-5" />
              Procesar Pago Total
              <span className="ml-2 bg-green-500 px-2 py-1 rounded text-sm">
                {formatCurrency(getTotalAmount())}
              </span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {orders.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay cuentas activas</h3>
            <p className="text-gray-500 text-sm mb-4">Crea la primera cuenta para esta mesa</p>
            <button
              onClick={handleNewOrder}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              Crear Primera Cuenta
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderManage;