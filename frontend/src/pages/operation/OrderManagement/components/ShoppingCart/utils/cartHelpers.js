// Helper para determinar el color del estado
export const getStatusColor = (status) => {
  switch (status) {
    case 'CREATED':
      return 'bg-green-100 text-green-600';
    case 'PREPARING':
      return 'bg-yellow-100 text-yellow-600';
    case 'SERVED':
      return 'bg-blue-100 text-blue-600';
    case 'NEW':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

// Helper para procesar items existentes de la orden
export const processExistingItems = (orderItems, canCancelItem, userRole) => {
  return orderItems.map((item, index) => ({
    id: `existing-${item.id || index}`,
    type: 'existing',
    name: item.recipe_name || item.recipe?.name,
    quantity: item.quantity,
    is_takeaway: item.is_takeaway,
    notes: item.notes,
    totalPrice: parseFloat(item.total_with_container || item.total_price || 0),
    basePrice: parseFloat(item.total_price || 0),
    containerPrice: item.container_info?.total_price || 0,
    containerName: item.container_info?.container_name,
    originalItem: item,
    canCancel: canCancelItem(item) && userRole === 'administradores',
    status: item.status || 'CREATED'
  }));
};

// Helper para procesar items del carrito
export const processCartItems = (cartItems) => {
  return cartItems.map((item, index) => ({
    id: `cart-${index}`,
    type: 'cart',
    name: item.recipe.name,
    quantity: item.quantity,
    is_takeaway: item.is_takeaway,
    notes: item.notes,
    totalPrice: item.unit_price * item.quantity,
    basePrice: parseFloat(item.recipe.price || item.recipe.base_price || 0) * item.quantity,
    containerPrice: (item.container_price || 0) * item.quantity,
    containerName: null,
    originalItem: item,
    cartIndex: index,
    status: 'NEW'
  }));
};

// Helper principal para procesar todos los items
export const processAllItems = (currentOrder, cart, filterActiveItems, canCancelItem, userRole) => {
  const activeItems = currentOrder?.items ? filterActiveItems(currentOrder.items) : [];
  
  const existingItems = processExistingItems(activeItems, canCancelItem, userRole);
  const cartItems = processCartItems(cart);
  
  return [...existingItems, ...cartItems];
};