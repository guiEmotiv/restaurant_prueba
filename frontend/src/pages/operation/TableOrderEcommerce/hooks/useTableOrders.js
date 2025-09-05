import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiService } from '../../../../services/api';

export const useTableOrders = (showToast) => {
  // Estados principales
  const [tables, setTables] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);

  // Cargar datos iniciales
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [tablesData, ordersData] = await Promise.all([
        apiService.tables.getAll(),
        apiService.orders.getAll()
      ]);
      
      setTables(tablesData || []);
      // Filtrar por pedidos activos (CREATED o PREPARING) - SERVED ya están cerrados
      setAllOrders(ordersData?.filter(o => ['CREATED', 'PREPARING'].includes(o.status)) || []);
    } catch (error) {
      showToast(`Error al cargar datos: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Cargar órdenes de una mesa específica
  const loadTableOrders = useCallback(async (tableId) => {
    try {
      const orders = await apiService.tables.getActiveOrders(tableId);
      
      // Optimización: obtener IDs de órdenes sin items para hacer una sola llamada
      const orderIdsNeedingItems = (orders || [])
        .filter(order => !order.items || order.items.length === 0)
        .map(order => order.id);
      
      if (orderIdsNeedingItems.length === 0) {
        // Si todas las órdenes ya tienen items, usar las existentes
        setAllOrders(prevOrders => {
          const otherOrders = prevOrders.filter(order => {
            const orderTableId = order.table?.id || order.table || order.table_id;
            return orderTableId !== tableId;
          });
          return [...otherOrders, ...orders];
        });
        return;
      }

      // Cargar órdenes detalladas en lote
      const detailedOrdersPromises = orderIdsNeedingItems.map(orderId => 
        apiService.orders.getById(orderId).catch(error => {
          return orders.find(o => o.id === orderId); // Fallback a la orden original
        })
      );
      
      const detailedOrders = await Promise.all(detailedOrdersPromises);
      
      // Combinar órdenes: las que ya tenían items + las detalladas
      const ordersWithItems = orders.map(order => {
        if (!order.items || order.items.length === 0) {
          return detailedOrders.find(detailed => detailed.id === order.id) || order;
        }
        return order;
      });
      
      // Actualizar allOrders con las órdenes detalladas de esta mesa
      setAllOrders(prevOrders => {
        const otherOrders = prevOrders.filter(order => {
          const orderTableId = order.table?.id || order.table || order.table_id;
          return orderTableId !== tableId;
        });
        return [...otherOrders, ...ordersWithItems];
      });
      
    } catch (error) {
      showToast(`Error al cargar pedidos de mesa: ${error.message}`, 'error');
    }
  }, [showToast]);


  // Memoización optimizada: crear un Map de orders por table una sola vez
  const ordersByTable = useMemo(() => {
    const map = new Map();
    allOrders.forEach(order => {
      const orderTableId = order.table?.id || order.table || order.table_id;
      if (!map.has(orderTableId)) {
        map.set(orderTableId, []);
      }
      map.get(orderTableId).push(order);
    });
    return map;
  }, [allOrders]);

  // Obtener órdenes de una mesa (ahora O(1) en lugar de O(n))
  const getTableOrders = useCallback((tableId) => {
    return ordersByTable.get(tableId) || [];
  }, [ordersByTable]);

  // Estado de mesa optimizado - ahora solo hay un pedido activo por mesa
  const getTableStatus = useCallback((tableId) => {
    const orders = ordersByTable.get(tableId) || [];
    return orders.length > 0 ? 'occupied' : 'available';
  }, [ordersByTable]);

  // Resumen de mesa optimizado - solo un pedido activo por mesa
  const getTableSummary = useCallback((tableId) => {
    const orders = getTableOrders(tableId);
    if (orders.length === 0) return null;
    
    // Como solo hay un pedido activo por mesa, tomar el primero
    const activeOrder = orders[0];
    
    const summary = {
      orderCount: 1, // Siempre 1 para el nuevo modelo
      totalAmount: parseFloat(activeOrder.grand_total || activeOrder.total_amount || 0),
      totalItems: activeOrder.items?.length || 0,
      waiterName: activeOrder.waiter_name || activeOrder.waiter || 'Sin asignar',
      customerName: activeOrder.customer_name || 'Cliente',
      createdAt: activeOrder.created_at
    };
    
    // Calcular tiempo transcurrido
    const createdTime = new Date(activeOrder.created_at);
    const now = new Date();
    const diffMs = now - createdTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    
    if (diffHours > 0) {
      summary.elapsedTime = `${diffHours}h ${remainingMins}m`;
    } else {
      summary.elapsedTime = `${diffMins}m`;
    }
    
    return summary;
  }, [getTableOrders]);

  // Computed property para órdenes de la mesa actual
  const currentTableOrders = useMemo(() => {
    if (!selectedTable) return [];
    return allOrders.filter(order => {
      const orderTableId = order.table?.id || order.table || order.table_id;
      return orderTableId === selectedTable.id;
    });
  }, [allOrders, selectedTable]);

  // Función para actualizar el estado de un item específico de forma optimista
  const updateOrderItemStatus = useCallback((itemId, newStatus, cancellationReason = null) => {
    setAllOrders(prevOrders => {
      return prevOrders.map(order => ({
        ...order,
        items: order.items?.map(item => 
          item.id === itemId 
            ? { 
                ...item, 
                status: newStatus,
                cancellation_reason: cancellationReason || item.cancellation_reason,
                canceled_at: newStatus === 'CANCELED' ? new Date().toISOString() : item.canceled_at
              }
            : item
        ) || []
      }));
    });
  }, []);

  return {
    // Estados
    tables,
    allOrders,
    loading,
    selectedTable,
    currentTableOrders,
    
    // Acciones
    setSelectedTable,
    setAllOrders,
    loadInitialData,
    loadTableOrders,
    updateOrderItemStatus,
    
    // Helpers
    getTableOrders,
    getTableStatus,
    getTableSummary
  };
};