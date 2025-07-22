import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Search, Calendar, Eye } from 'lucide-react';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const PaymentHistory = () => {
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

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
      
      // Ordenar por fecha de pago más reciente primero
      paidOrders.sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at));
      
      setOrders(paidOrders);
    } catch (error) {
      console.error('Error loading paid orders:', error);
      showError('Error al cargar el historial de pagos');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (orderId) => {
    navigate(`/orders/${orderId}/receipt`);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Historial de Pagos</h1>
          <p className="text-sm md:text-base text-gray-600">Órdenes pagadas y tickets</p>
        </div>
      </div>

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
                  Orden
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
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        Orden #{order.id}
                      </div>
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
                        <h3 className="text-lg font-bold text-gray-900">Orden #{order.id}</h3>
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

    </div>
  );
};

export default PaymentHistory;