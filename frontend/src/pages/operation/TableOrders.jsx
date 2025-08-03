import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ShoppingCart, Clock, User, DollarSign } from 'lucide-react';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const TableOrders = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { showError } = useToast();
  const [table, setTable] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTableData();
  }, [tableId]);

  const loadTableData = async () => {
    try {
      setLoading(true);
      const [tableData, ordersData] = await Promise.all([
        apiService.tables.getById(tableId),
        apiService.tables.getActiveOrders(tableId)
      ]);
      
      setTable(tableData);
      setOrders(ordersData);
    } catch (error) {
      console.error('Error loading table data:', error);
      showError('Error al cargar los datos de la mesa');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getOrderSummary = (order) => {
    const totalItems = order.items?.length || 0;
    const pendingItems = order.items?.filter(item => item.status === 'CREATED').length || 0;
    const servedItems = order.items?.filter(item => item.status === 'SERVED').length || 0;
    
    return {
      totalItems,
      pendingItems,
      servedItems,
      canPay: totalItems > 0 && pendingItems === 0
    };
  };

  const handleOrderClick = (order) => {
    navigate(`/table/${tableId}/order-edit`, {
      state: { orderId: order.id }
    });
  };

  const handleNewOrder = () => {
    navigate(`/table/${tableId}/order-ecommerce`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/table-status')}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Mesa {table?.table_number} - {table?.zone_name}
            </h1>
            <p className="text-gray-600">
              {orders.length === 0 
                ? 'Sin pedidos activos'
                : orders.length === 1 
                  ? '1 cuenta activa' 
                  : `${orders.length} cuentas separadas`
              }
            </p>
          </div>
        </div>
        
        <Button
          onClick={handleNewOrder}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nueva Cuenta
        </Button>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Mesa disponible
          </h3>
          <p className="text-gray-600 mb-4">
            Esta mesa no tiene cuentas activas. Puedes crear una nueva cuenta para comenzar a tomar pedidos.
          </p>
          <Button
            onClick={handleNewOrder}
            className="flex items-center gap-2 mx-auto"
          >
            <Plus className="h-4 w-4" />
            Crear Primera Cuenta
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order, index) => {
            const summary = getOrderSummary(order);
            
            return (
              <div
                key={order.id}
                onClick={() => handleOrderClick(order)}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                        Cuenta #{order.id}
                      </span>
                      {index === 0 && <span className="text-sm text-green-600">(Más reciente)</span>}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{formatDate(order.created_at)}</span>
                      </div>
                      {order.waiter && (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{order.waiter}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(order.total_amount)}
                    </div>
                    {summary.canPay && (
                      <span className="text-sm text-green-600">Listo para pagar</span>
                    )}
                  </div>
                </div>

                {/* Order Summary */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-gray-900">{summary.totalItems}</div>
                    <div className="text-xs text-gray-600">Items Total</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded">
                    <div className="text-2xl font-bold text-orange-600">{summary.pendingItems}</div>
                    <div className="text-xs text-gray-600">Pendientes</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded">
                    <div className="text-2xl font-bold text-green-600">{summary.servedItems}</div>
                    <div className="text-xs text-gray-600">Entregados</div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-sm text-gray-600">
                    {summary.canPay ? 'Cuenta lista para cobrar' : 'Gestionar cuenta'}
                  </span>
                  <Button
                    size="sm"
                    variant={summary.canPay ? 'primary' : 'secondary'}
                    className="flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOrderClick(order);
                    }}
                  >
                    {summary.canPay ? (
                      <>
                        <DollarSign className="h-4 w-4" />
                        Cobrar Cuenta
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4" />
                        Gestionar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TableOrders;