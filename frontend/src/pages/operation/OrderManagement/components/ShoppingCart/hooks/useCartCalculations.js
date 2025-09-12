import { useMemo } from 'react';

const useCartCalculations = (cart, currentOrder) => {
  // Calcular total del carrito
  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
  }, [cart]);

  // Calcular total de la orden existente (excluyendo items cancelados)
  const orderTotal = useMemo(() => {
    if (!currentOrder?.items) return 0;
    
    return currentOrder.items
      .filter(item => item.status !== 'CANCELED')
      .reduce((total, item) => {
        const itemTotal = item.total_with_container || item.total_price || 0;
        return total + parseFloat(itemTotal);
      }, 0);
  }, [currentOrder?.items]);

  const grandTotal = cartTotal + orderTotal;

  return {
    cartTotal,
    orderTotal,
    grandTotal
  };
};

export default useCartCalculations;