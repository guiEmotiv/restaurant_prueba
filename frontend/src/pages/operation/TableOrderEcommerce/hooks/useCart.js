import { useState, useCallback } from 'react';

export const useCart = () => {
  const [cart, setCart] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);

  // Agregar item al carrito
  const addToCart = useCallback((recipe, notes = '', isTakeaway = false, containerPrice = 0, containerId = null) => {
    const existingIndex = cart.findIndex(item => 
      item.recipe.id === recipe.id && 
      item.notes === notes && 
      item.is_takeaway === isTakeaway
    );
    
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].total_price = newCart[existingIndex].unit_price * newCart[existingIndex].quantity;
      setCart(newCart);
    } else {
      const basePrice = parseFloat(recipe.price || recipe.base_price || 0);
      const totalUnitPrice = basePrice + containerPrice;
      
      setCart([...cart, {
        recipe,
        quantity: 1,
        notes,
        is_takeaway: isTakeaway,
        unit_price: totalUnitPrice,
        total_price: totalUnitPrice,
        container_price: containerPrice,
        selected_container: containerId
      }]);
    }
  }, [cart]);

  // Remover item del carrito
  const removeFromCart = useCallback((index) => {
    const newCart = cart.filter((_, i) => i !== index);
    setCart(newCart);
  }, [cart]);

  // Actualizar item del carrito
  const updateCartItem = useCallback((index, field, value) => {
    setCart(prevCart => {
      const newCart = [...prevCart];
      newCart[index][field] = value;
      
      if (field === 'quantity') {
        newCart[index].total_price = newCart[index].unit_price * value;
      }
      
      return newCart;
    });
  }, []);

  // Limpiar carrito
  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  // Calcular total del carrito
  const getCartTotal = useCallback(() => {
    return cart.reduce((sum, item) => sum + item.total_price, 0);
  }, [cart]);

  // Calcular cantidad total de items
  const getCartItemCount = useCallback(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  // Actualizar el estado de un item en la orden actual
  const updateCurrentOrderItemStatus = useCallback((itemId, newStatus, cancellationReason = null) => {
    if (!currentOrder || !currentOrder.items) return;
    
    setCurrentOrder(prevOrder => ({
      ...prevOrder,
      items: prevOrder.items.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              status: newStatus,
              cancellation_reason: cancellationReason || item.cancellation_reason,
              canceled_at: newStatus === 'CANCELED' ? new Date().toISOString() : item.canceled_at
            }
          : item
      )
    }));
  }, [currentOrder]);

  return {
    // Estado
    cart,
    currentOrder,
    
    // Acciones
    setCart,
    setCurrentOrder,
    addToCart,
    removeFromCart,
    updateCartItem,
    clearCart,
    updateCurrentOrderItemStatus,
    
    // Helpers
    getCartTotal,
    getCartItemCount
  };
};