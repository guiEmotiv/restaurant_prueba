// Helper functions para gestión de pedidos

// Obtener color del estado del item
export const getItemStatusColor = (status) => {
  switch (status) {
    case 'CREATED': return 'bg-green-500'; // Verde para creados
    case 'PREPARING': return 'bg-yellow-500'; // Amarillo para preparando
    case 'SERVED': return 'bg-blue-500'; // Azul para servidos
    case 'PAID': return 'bg-gray-500'; // Gris para pagados
    case 'CANCELED': return 'bg-red-500'; // Rojo para cancelados
    default: return 'bg-gray-400'; // Gris claro por defecto
  }
};

// Verificar si un item se puede cancelar
export const canCancelItem = (item) => {
  // Se puede cancelar si está en estado CREATED o PREPARING
  return item.status === 'CREATED' || item.status === 'PREPARING';
};

// Verificar si un item se puede eliminar (mantener para compatibilidad - usa canCancelItem)
export const canDeleteItem = (item) => {
  // Solo se puede cancelar si está en estado CREATED
  return item.status === 'CREATED';
};

// Filtrar items cancelados para no mostrarlos
export const filterActiveItems = (items) => {
  if (!items) return [];
  return items.filter(item => item.status !== 'CANCELED');
};

// Verificar si un pedido se puede cancelar
export const canDeleteOrder = (order) => {
  // Se puede cancelar si:
  // 1. El pedido está vacío (sin items), O
  // 2. TODOS los items activos están en estado CREATED
  if (!order.items || order.items.length === 0) return true;
  
  const activeItems = filterActiveItems(order.items);
  if (activeItems.length === 0) return true; // Solo tiene items cancelados
  
  const createdItems = activeItems.filter(item => item.status === 'CREATED');
  
  // Solo se puede cancelar si TODOS los items activos están CREATED
  return createdItems.length === activeItems.length;
};

// Analizar estado de eliminación de pedido
export const analyzeOrderDeletionStatus = (order) => {
  if (!order.items || order.items.length === 0) {
    return { canDelete: true, reason: '' };
  }

  const activeItems = filterActiveItems(order.items);
  if (activeItems.length === 0) {
    return { canDelete: true, reason: '' }; // Solo tiene items cancelados
  }

  const statusGroups = {
    CREATED: activeItems.filter(item => item.status === 'CREATED'),
    PREPARING: activeItems.filter(item => item.status === 'PREPARING'),
    SERVED: activeItems.filter(item => item.status === 'SERVED'),
    PAID: activeItems.filter(item => item.status === 'PAID')
  };

  const totalActiveItems = activeItems.length;
  
  if (statusGroups.CREATED.length === totalActiveItems) {
    return { canDelete: true, reason: '' };
  }

  // Construir mensaje específico
  let reasons = [];
  if (statusGroups.PREPARING.length > 0) {
    reasons.push(`${statusGroups.PREPARING.length} en preparación`);
  }
  if (statusGroups.SERVED.length > 0) {
    reasons.push(`${statusGroups.SERVED.length} servido${statusGroups.SERVED.length > 1 ? 's' : ''}`);
  }
  if (statusGroups.PAID.length > 0) {
    reasons.push(`${statusGroups.PAID.length} pagado${statusGroups.PAID.length > 1 ? 's' : ''}`);
  }

  const reasonText = reasons.join(', ');
  return { 
    canDelete: false, 
    reason: `Tiene items ya procesados: ${reasonText}` 
  };
};

// Verificar si se puede procesar pago
export const canProcessPayment = (order) => {
  if (!order || order.status === 'PAID' || !order.items || order.items.length === 0) {
    return false;
  }
  
  // Buscar items activos que estén SERVED y no pagados
  const activeItems = filterActiveItems(order.items);
  const servedUnpaidItems = activeItems.filter(item => 
    item.status === 'SERVED' && !item.is_fully_paid
  );
  
  return servedUnpaidItems.length > 0;
};

// Verificar estado actual del item en tiempo real
export const checkItemCurrentStatus = async (itemId, apiService) => {
  try {
    const item = await apiService.orderItems.getById(itemId);
    return item.status;
  } catch (error) {
    return null;
  }
};

// Verificar si todos los items están pagados
export const areAllItemsPaid = (order) => {
  if (!order || !order.items) return false;
  const activeItems = filterActiveItems(order.items);
  if (activeItems.length === 0) return false; // Solo items cancelados
  return activeItems.every(item => item.status === 'PAID' || item.is_fully_paid);
};

// Verificar si todos los items activos están en estado PREPARING (para mostrar botón "Cerrar Pedido")
export const canCloseOrder = (order) => {
  if (!order || !order.items || order.items.length === 0) {
    return false;
  }
  
  const activeItems = filterActiveItems(order.items);
  if (activeItems.length === 0) return false; // Solo items cancelados
  
  // Verificar que TODOS los items activos estén en estado PREPARING
  const preparingItems = activeItems.filter(item => item.status === 'PREPARING');
  return preparingItems.length === activeItems.length && activeItems.length > 0;
};

// Filtrar pedidos para mostrar solo los que tienen items activos
export const filterActiveOrders = (orders) => {
  if (!orders) return [];
  return orders.filter(order => {
    if (order.status === 'CANCELED') return false; // Ocultar pedidos cancelados
    if (!order.items || order.items.length === 0) return true; // Mostrar pedidos vacíos
    const activeItems = filterActiveItems(order.items);
    return activeItems.length > 0; // Solo mostrar si tiene items activos
  });
};