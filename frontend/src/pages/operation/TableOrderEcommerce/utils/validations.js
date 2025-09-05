// Funciones de validación para pedidos y contenedores

// Obtener contenedor seleccionado para una receta
export const getSelectedContainer = (recipe, containers) => {
  if (!containers.length || !recipe?.container_id) return null;
  
  // Buscar EXCLUSIVAMENTE el envase configurado en la receta
  const recipeContainer = containers.find(c => c.id === recipe.container_id);
  
  // Solo retornarlo si existe y tiene stock - SIN FALLBACK
  return (recipeContainer && recipeContainer.stock > 0) ? recipeContainer : null;
};

// Validar contenedor para pedidos para llevar
export const validateTakeawayContainer = (recipe, containers) => {
  if (!recipe?.container_id) {
    return {
      isValid: false,
      message: "Esta receta no tiene envase configurado para llevar"
    };
  }
  
  const recommendedContainer = containers.find(c => c.id === recipe.container_id);
  if (!recommendedContainer || recommendedContainer.stock <= 0) {
    return {
      isValid: false,
      message: `El envase "${containers.find(c => c.id === recipe.container_id)?.name || 'configurado'}" no tiene stock disponible`
    };
  }
  
  return { isValid: true, container: recommendedContainer };
};

// Validar si un pedido se puede crear/actualizar
export const validateOrder = (cart, selectedTable) => {
  if (!selectedTable) {
    return { isValid: false, message: 'Debe seleccionar una mesa' };
  }
  
  if (!cart || cart.length === 0) {
    return { isValid: false, message: 'El carrito está vacío' };
  }
  
  // Validar que todos los items tengan precios válidos
  const invalidItems = cart.filter(item => 
    !item.unit_price || item.unit_price <= 0 || !item.total_price || item.total_price <= 0
  );
  
  if (invalidItems.length > 0) {
    return { isValid: false, message: 'Algunos items tienen precios inválidos' };
  }
  
  return { isValid: true };
};

// Validar datos de pago
export const validatePayment = (selectedItems, paymentMethod) => {
  if (!selectedItems || selectedItems.length === 0) {
    return { isValid: false, message: 'Debe seleccionar al menos un item para pagar' };
  }
  
  if (!paymentMethod) {
    return { isValid: false, message: 'Debe seleccionar un método de pago' };
  }
  
  const validMethods = ['CASH', 'CARD', 'YAPE_PLIN', 'TRANSFER'];
  if (!validMethods.includes(paymentMethod)) {
    return { isValid: false, message: 'Método de pago no válido' };
  }
  
  return { isValid: true };
};