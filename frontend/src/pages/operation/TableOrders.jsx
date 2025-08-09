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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-200 border-t-blue-600"></div>
          </div>
          <p className="text-gray-600 font-medium">Cargando cuentas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header Moderno */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white sticky top-0 z-40 shadow-lg">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => navigate('/table-status')}
                className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-200" />
                  <h1 className="font-bold">Mesa {table?.table_number}</h1>
                </div>
                <p className="text-blue-100 text-sm">
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
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nueva Cuenta
            </button>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="px-4 py-6">
        {orders.length === 0 ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center bg-white rounded-3xl p-8 shadow-xl border border-gray-100 max-w-md">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="h-10 w-10 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Mesa Disponible</h3>
              <p className="text-gray-500 mb-6">
                Esta mesa no tiene cuentas activas. Crea una nueva cuenta para comenzar.
              </p>
              <button
                onClick={handleNewOrder}
                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus className="h-5 w-5" />
                Crear Primera Cuenta
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => {
              const summary = getOrderSummary(order);
              
              return (
                <div
                  key={order.id}
                  onClick={() => handleOrderClick(order)}
                  className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden group hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] cursor-pointer"
                >
                  {/* Header de la Cuenta */}
                  <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          summary.canPay 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-amber-500 text-white'
                        }`}>
                          {summary.canPay ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <AlertCircle className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">Cuenta #{order.id}</span>
                            {index === 0 && (
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs font-medium">
                                Más reciente
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(order.created_at)}</span>
                            </div>
                            {order.waiter && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{order.waiter}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">
                          {formatCurrency(order.total_amount)}
                        </div>
                        {summary.canPay && (
                          <span className="text-sm text-emerald-600 font-medium">Listo para pagar</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contenido de la Cuenta */}
                  <div className="p-6">
                    {/* Resumen de Items */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center p-4 bg-slate-50 rounded-xl">
                        <div className="text-2xl font-bold text-slate-700">{summary.totalItems}</div>
                        <div className="text-xs text-slate-500 font-medium mt-1">Items Total</div>
                      </div>
                      <div className="text-center p-4 bg-amber-50 rounded-xl">
                        <div className="text-2xl font-bold text-amber-600">{summary.pendingItems}</div>
                        <div className="text-xs text-amber-600 font-medium mt-1">Pendientes</div>
                      </div>
                      <div className="text-center p-4 bg-emerald-50 rounded-xl">
                        <div className="text-2xl font-bold text-emerald-600">{summary.servedItems}</div>
                        <div className="text-xs text-emerald-600 font-medium mt-1">Entregados</div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <span className="text-sm text-gray-600 font-medium">
                        {summary.canPay ? 'Cuenta lista para cobrar' : 'Gestionar cuenta'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOrderClick(order);
                        }}
                        className={`px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2 ${
                          summary.canPay 
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {summary.canPay ? (
                          <>
                            <DollarSign className="h-4 w-4" />
                            Cobrar
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="h-4 w-4" />
                            Gestionar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
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