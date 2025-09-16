import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiService } from '../../../../services/api';

export const useTableOrders = (showToast) => {
  // Estados principales
  const [tables, setTables] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  // Simple loading state
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);

  // DEBUG: Log cuando cambia el estado de tables
  useEffect(() => {
    console.log('🟦 [TABLES-STATE] Tables state changed:', {
      tablesCount: tables.length,
      loading: loading,
      tables: tables.map(t => ({ id: t.id, table_number: t.table_number, zone: t.zone_name }))
    });
  }, [tables, loading]);

  // Load tables and active orders for proper status
  const loadInitialData = useCallback(async () => {
    try {
      console.log('🟦 [LOAD-INITIAL] Starting loadInitialData...');
      setLoading(true);

      // Load tables and active orders in parallel
      console.log('🟦 [LOAD-INITIAL] Making API calls...');
      const [tablesData, ordersData] = await Promise.all([
        apiService.tables.getAll(),
        apiService.orders.getAll()
      ]);

      console.log('🟦 [LOAD-INITIAL] API responses received:', {
        tablesCount: tablesData?.length || 0,
        ordersCount: ordersData?.length || 0,
        tablesData: tablesData?.map(t => ({ id: t.id, table_number: t.table_number }))
      });

      setTables(tablesData || []);
      // Filter only active orders that occupy tables (CREATED, PREPARING)
      // SERVED orders don't occupy tables anymore
      const activeOrders = ordersData?.filter(o =>
        ['CREATED', 'PREPARING'].includes(o.status)
      ) || [];

      console.log('🟦 [LOAD-INITIAL] Order status breakdown:', {
        totalOrders: ordersData?.length || 0,
        filteredActiveOrders: activeOrders.length,
        ordersByStatus: ordersData?.reduce((acc, o) => {
          acc[o.status] = (acc[o.status] || 0) + 1;
          return acc;
        }, {}) || {}
      });

      console.log('🟦 [LOAD-INITIAL] Setting state:', {
        tablesCount: (tablesData || []).length,
        activeOrdersCount: activeOrders.length
      });

      setAllOrders(activeOrders);
    } catch (error) {
      console.error('🟦 [LOAD-INITIAL] Error:', error);
      showToast?.(`Error al cargar datos: ${error.message}`, 'error');
    } finally {
      console.log('🟦 [LOAD-INITIAL] Setting loading to false');
      setLoading(false);
    }
  }, [showToast]);

  // Versión silenciosa para polling - no afecta el estado loading
  const loadDataSilently = useCallback(async () => {
    try {
      // Cargar tables y órdenes sin afectar loading state
      const [tablesData, ordersData] = await Promise.all([
        apiService.tables.getAll(),
        apiService.orders.getAll()
      ]);
      
      // Actualizar tables sin re-renders masivos
      setTables(prevTables => {
        // Solo actualizar si hay cambios
        if (JSON.stringify(prevTables) === JSON.stringify(tablesData || [])) {
          return prevTables;
        }
        return tablesData || [];
      });
      
      // Actualizar órdenes activas que ocupan mesas (CREATED, PREPARING)
      // SERVED orders don't occupy tables anymore
      const activeOrders = ordersData?.filter(o =>
        ['CREATED', 'PREPARING'].includes(o.status)
      ) || [];
      
      setAllOrders(prevOrders => {
        // Solo actualizar si hay cambios
        if (JSON.stringify(prevOrders) === JSON.stringify(activeOrders)) {
          return prevOrders;
        }
        return activeOrders;
      });
      
    } catch (error) {
      showToast?.(`Error al actualizar datos: ${error.message}`, 'error');
    }
  }, [showToast]);

  // Load active orders when needed
  const loadActiveOrders = useCallback(async () => {
    try {
      const ordersData = await apiService.orders.getAll();
      setAllOrders(ordersData?.filter(o => ['CREATED', 'PREPARING'].includes(o.status)) || []);
    } catch (error) {
      showToast?.(`Error al cargar órdenes: ${error.message}`, 'error');
    }
  }, [showToast]);

  // Cargar órdenes de una mesa específica
  const loadTableOrders = useCallback(async (tableId) => {
    try {
      const orders = await apiService.tables.getActiveOrders(tableId);
      
      console.log('🔍 [TABLE-ORDERS] Datos recibidos de API para mesa', tableId, ':', orders);
      orders?.forEach((order, index) => {
        console.log(`🔍 [TABLE-ORDERS] Order ${index + 1}:`, {
          id: order.id,
          customer_name: order.customer_name,
          party_size: order.party_size,
          status: order.status,
          hasItems: order.items?.length || 0,
          fullOrder: order
        });
      });
      
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
      
      console.log('🔍 [TABLE-ORDERS] Órdenes detalladas recibidas:', detailedOrders);
      detailedOrders?.forEach((order, index) => {
        console.log(`🔍 [TABLE-ORDERS] Detailed Order ${index + 1}:`, {
          id: order.id,
          customer_name: order.customer_name,
          party_size: order.party_size,
          status: order.status,
          itemsCount: order.items?.length || 0
        });
      });
      
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

  return useMemo(() => ({
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
    loadDataSilently,
    loadActiveOrders,
    loadTableOrders,
    updateOrderItemStatus,
    
    // Helpers
    getTableOrders,
    getTableStatus,
    getTableSummary
  }), [
    tables,
    allOrders,
    loading,
    selectedTable,
    currentTableOrders,
    setSelectedTable,
    setAllOrders,
    loadInitialData,
    loadDataSilently,
    loadActiveOrders,
    loadTableOrders,
    updateOrderItemStatus,
    getTableOrders,
    getTableStatus,
    getTableSummary
  ]);
};