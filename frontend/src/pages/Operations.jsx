import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { 
  Table, 
  Plus, 
  Users, 
  Clock,
  DollarSign,
  CheckCircle,
  CreditCard
} from 'lucide-react';
import { apiService } from '../services/api';

const Operations = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tablesData, ordersData] = await Promise.all([
        apiService.tables.getAll(),
        apiService.orders.getAll()
      ]);
      setTables(Array.isArray(tablesData) ? tablesData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const getTableOrders = (tableId) => {
    return orders.filter(order => 
      order.table === tableId && order.status !== 'PAID' && order.status !== 'CANCELLED'
    );
  };

  const getTableStatus = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    return tableOrders.length > 0 ? 'occupied' : 'available';
  };

  const getTotalAmount = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    return tableOrders.reduce((total, order) => total + parseFloat(order.total_amount || 0), 0);
  };

  const getOrdersCount = (tableId) => {
    return getTableOrders(tableId).length;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const handleTableClick = (table) => {
    const status = getTableStatus(table.id);
    if (status === 'available') {
      navigate(`/table/${table.id}/order-ecommerce`);
    } else {
      navigate(`/table/${table.id}/orders`);
    }
  };

  const handleNewOrder = (table) => {
    navigate(`/table/${table.id}/order-ecommerce`);
  };

  if (loading) {
    return (
      <div className="p-3">
        <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-40 px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">Operaciones</h1>
        </div>
        <div className="pt-16 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const availableTables = tables.filter(table => getTableStatus(table.id) === 'available');
  const occupiedTables = tables.filter(table => getTableStatus(table.id) === 'occupied');

  return (
    <div className="pb-4">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-40 px-4 py-3 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Operaciones</h1>
        <p className="text-xs text-gray-500">Gestión de mesas y cuentas</p>
      </div>

      <div className="pt-20 px-3 space-y-4">
        {/* Mesas Ocupadas */}
        {occupiedTables.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <h2 className="text-sm font-semibold text-gray-900">Mesas Ocupadas ({occupiedTables.length})</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {occupiedTables.map((table) => {
                const ordersCount = getOrdersCount(table.id);
                const totalAmount = getTotalAmount(table.id);
                
                return (
                  <div key={table.id} className="bg-white rounded-lg shadow-sm border border-red-100">
                    <div 
                      onClick={() => handleTableClick(table)}
                      className="p-3 cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Table className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-semibold text-gray-900">
                            Mesa {table.number}
                          </span>
                        </div>
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-600">
                            {ordersCount} cuenta{ordersCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-green-600" />
                          <span className="text-xs font-medium text-green-700">
                            {formatCurrency(totalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="px-3 pb-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNewOrder(table);
                        }}
                        className="w-full py-2 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Nueva Cuenta
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mesas Disponibles */}
        {availableTables.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <h2 className="text-sm font-semibold text-gray-900">Mesas Disponibles ({availableTables.length})</h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {availableTables.map((table) => (
                <div 
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  className="bg-white rounded-lg shadow-sm border border-green-100 p-3 cursor-pointer hover:bg-green-50 transition-colors"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Table className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-gray-900">
                        {table.number}
                      </span>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">Disponible</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {tables.length === 0 && (
          <div className="text-center py-12">
            <Table className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No hay mesas configuradas</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Operations;