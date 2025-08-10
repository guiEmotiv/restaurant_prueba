import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { 
  ArrowLeft,
  ShoppingCart,
  Edit3,
  Trash2
} from 'lucide-react';
import { apiService } from '../../services/api';

const OrderEdit = () => {
  const { tableId, orderId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const [table, setTable] = useState(null);
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [tableId, orderId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tableData, orderData, orderItemsData] = await Promise.all([
        apiService.tables.getById(tableId),
        apiService.orders.getById(orderId),
        apiService.orderItems.getAll()
      ]);
      
      setTable(tableData);
      setOrder(orderData);
      
      // Filtrar items de esta orden
      const filteredItems = Array.isArray(orderItemsData) 
        ? orderItemsData.filter(item => item.order === parseInt(orderId))
        : [];
      
      setOrderItems(filteredItems);
    } catch (error) {
      showError('Error al cargar datos de la orden');
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

  const getStatusColor = (status) => {
    const colors = {
      'CREATED': 'bg-yellow-100 text-yellow-800',
      'SERVED': 'bg-blue-100 text-blue-800',
      'READY': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const statusTexts = {
      'CREATED': 'Pendiente',
      'SERVED': 'Entregado',
      'READY': 'Listo'
    };
    return statusTexts[status] || status;
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
    <div className="min-h-screen bg-gray-50">
      {/* Header fijo */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-40 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/operations/table/${tableId}/manage`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          
          <h1 className="text-lg font-bold text-gray-900">Editar Cuenta #{orderId}</h1>
          
          <div className="w-10"></div>
        </div>
      </div>

      <div className="pt-20 px-3">
        {/* Información de la orden */}
        {order && (
          <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Cuenta #{order.id}</h2>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(order.total_amount)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de items */}
        <div className="space-y-3 mb-4">
          <h3 className="text-lg font-bold text-gray-900">Items de la cuenta</h3>
          
          {orderItems.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.recipe_name || 'Sin nombre'}</h4>
                  {item.notes && (
                    <p className="text-sm text-blue-600 mt-1">📝 {item.notes}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-sm text-gray-600">
                      Cantidad: {item.quantity}
                    </span>
                    <span className="text-sm text-gray-600">
                      {formatCurrency(item.unit_price)} c/u
                    </span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600 mb-2">
                    {formatCurrency(item.total_price)}
                  </div>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                    {getStatusText(item.status)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {orderItems.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay items en esta cuenta</h3>
            <p className="text-gray-500 text-sm">Los items aparecerán aquí cuando se agreguen</p>
          </div>
        )}

        {/* Botones de acción */}
        <div className="sticky bottom-4 space-y-3">
          <button
            onClick={() => navigate(`/operations/table/${tableId}/add-items`)}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Edit3 className="h-5 w-5" />
            Agregar más items
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderEdit;