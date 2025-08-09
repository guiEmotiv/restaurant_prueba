import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ShoppingCart, Clock, User, DollarSign, Utensils, Users, CheckCircle, AlertCircle } from 'lucide-react';
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
        <div className="px-3 py-3 pl-16">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/table-status')}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-gray-600" />
              </button>
              
              <div>
                <h1 className="text-base font-medium text-gray-900">Mesa {table?.table_number}</h1>
                <p className="text-xs text-gray-500">
                  {table?.zone_name} • {orders.length === 0 
                    ? 'Sin cuentas'
                    : orders.length === 1 
                      ? '1 cuenta activa' 
                      : `${orders.length} cuentas`
                  }
                </p>
              </div>
            </div>

            {/* Nueva Cuenta Button */}
            <button
              onClick={handleNewOrder}
              className="bg-blue-600 text-white px-3 py-2 rounded font-medium hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm"
            >
              <Plus className="h-3 w-3" />
              Nueva Cuenta
            </button>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="px-3 py-3" style={{paddingTop: '110px'}}>
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-8 w-8 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-2">Mesa Disponible</h3>
            <p className="text-sm text-gray-600 mb-4">
              Esta mesa no tiene cuentas activas.
            </p>
            <button
              onClick={handleNewOrder}
              className="bg-blue-600 text-white px-3 py-2 rounded font-medium hover:bg-blue-700 transition-colors flex items-center gap-1 mx-auto text-sm"
            >
              <Plus className="h-3 w-3" />
              Crear Primera Cuenta
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order, index) => {
              const summary = getOrderSummary(order);
              
              return (
                <div
                  key={order.id}
                  onClick={() => handleOrderClick(order)}
                  className="bg-white rounded border border-gray-200 p-3 cursor-pointer hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded flex items-center justify-center text-white text-sm font-medium ${
                        summary.canPay 
                          ? 'bg-green-500' 
                          : 'bg-red-500'
                      }`}>
                        #{order.id}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-gray-900">Cuenta #{order.id}</div>
                        <div className="text-xs text-gray-500">{formatDate(order.created_at)}</div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-base font-semibold text-gray-900">
                        {formatCurrency(order.total_amount)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {summary.pendingItems}/{summary.totalItems} items
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Spacing Bottom */}
      <div className="h-20"></div>
    </div>
  );
};

export default TableOrders;