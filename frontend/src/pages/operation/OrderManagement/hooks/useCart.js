import { useState, useCallback, useMemo } from 'react';

export const useCart = () => {
  const [cart, setCart] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);

  // Agregar item al carrito - AGRUPAR items iguales (misma receta, notas, delivery)
  const addToCart = useCallback((recipe, notes = '', isTakeaway = false, containerPrice = 0, containerId = null) => {
    console.log('[ORDER-LOG] 🛒 useCart.addToCart llamado:', {
      recipeId: recipe.id,
      recipeName: recipe.name,
      notes,
      isTakeaway,
      containerPrice,
      containerId,
      currentCartSize: cart.length,
      timestamp: new Date().toISOString()
    });
    
    const existingIndex = cart.findIndex(item => 
      item.recipe.id === recipe.id && 
      item.notes === notes && 
      item.is_takeaway === isTakeaway
    );
    
    if (existingIndex >= 0) {
      // Item idéntico encontrado - incrementar cantidad
      console.log('[ORDER-LOG] 📈 Incrementando cantidad de item existente:', {
        existingIndex,
        oldQuantity: cart[existingIndex].quantity,
        newQuantity: cart[existingIndex].quantity + 1
      });
      
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].total_price = newCart[existingIndex].unit_price * newCart[existingIndex].quantity;
      setCart(newCart);
    } else {
      // Item diferente - agregar nuevo
      const basePrice = parseFloat(recipe.price || recipe.base_price || 0);
      const totalUnitPrice = basePrice + containerPrice;
      
      console.log('[ORDER-LOG] ➕ Agregando nuevo item al carrito:', {
        recipeName: recipe.name,
        basePrice,
        containerPrice,
        totalUnitPrice,
        isTakeaway,
        newCartSize: cart.length + 1
      });
      
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
    const itemToRemove = cart[index];
    console.log('[ORDER-LOG] 🗑️ Removiendo item del carrito:', {
      index,
      recipeName: itemToRemove?.recipe?.name,
      quantity: itemToRemove?.quantity,
      remainingItems: cart.length - 1,
      timestamp: new Date().toISOString()
    });
    
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
    console.log('[ORDER-LOG] 🧹 Limpiando carrito:', {
      itemsRemoved: cart.length,
      cartItems: cart.map(item => ({
        recipe: item.recipe.name,
        quantity: item.quantity
      })),
      timestamp: new Date().toISOString()
    });
    
    setCart([]);
  }, [cart]);

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
    
    setCurrentOrder(prevOrder => {
      // Verificación de seguridad: si prevOrder es null, no hacer nada
      if (!prevOrder || !prevOrder.items) return prevOrder;
      
      return {
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
      };
    });
  }, [currentOrder]);

  // Optimized wrapper para setCurrentOrder - evita llamadas redundantes
  const setCurrentOrderWithLogging = useCallback((order) => {
    console.log('🟦 USE CART - setCurrentOrderWithLogging LLAMADO:', {
      orderReceived: order,
      orderIdReceived: order?.id,
      customer_name: order?.customer_name,
      party_size: order?.party_size,
      orderItemsCount: order?.items?.length || 0,
      orderStatus: order?.status,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack?.split('\n').slice(1, 4).join(' <- ')
    });
    
    // Solo actualizar si realmente hay cambio
    setCurrentOrder(prevOrder => {
      const prevId = prevOrder?.id;
      const newId = order?.id;
      
      console.log('🟦 USE CART - Comparación de órdenes:', {
        prevOrder: prevId ? `#${prevId}` : 'null',
        newOrder: newId ? `#${newId}` : 'null',
        sameReference: prevOrder === order,
        sameId: prevId && newId && prevId === newId
      });
      
      // Solo bloquear si son exactamente la misma referencia de objeto
      if (prevOrder === order) {
        console.log('🔵 USE CART - Misma referencia, manteniendo orden actual');
        return prevOrder;
      }
      
      // Si mismo ID, comparar contenido de items Y estado del Order para detectar cambios
      if (prevId && newId && prevId === newId) {
        const prevItemsStatus = prevOrder?.items?.map(item => `${item.id}:${item.status}`).sort().join(',') || '';
        const newItemsStatus = order?.items?.map(item => `${item.id}:${item.status}`).sort().join(',') || '';
        const prevOrderStatus = prevOrder?.status || '';
        const newOrderStatus = order?.status || '';
        
        if (prevItemsStatus === newItemsStatus && prevOrderStatus === newOrderStatus) {
          console.log('🔵 USE CART - Mismo ID, mismo estado de items Y mismo estado del Order, manteniendo orden actual');
          return prevOrder;
        } else {
          console.log('🔵 USE CART - Mismo ID pero cambios detectados, actualizando orden:', {
            prevItemsStatus,
            newItemsStatus,
            prevOrderStatus,
            newOrderStatus,
            itemsChanged: prevItemsStatus !== newItemsStatus,
            orderStatusChanged: prevOrderStatus !== newOrderStatus
          });
        }
      }
      
      // 🔍 DEBUGGING: Log detallado del cambio de currentOrder
      console.log('🔵 USE CART - setCurrentOrder ACTUALIZADO de:', prevId || 'null', 'a:', newId || 'null');
      console.log('🔵 USE CART - Nueva orden completa:', order);

      // Log específico de pricing data
      if (order && order.items) {
        console.log('🔍 USE CART - Items en nueva currentOrder:', {
          itemsCount: order.items.length,
          orderTotalAmount: order.total_amount,
          orderStatus: order.status
        });

        order.items.forEach((item, index) => {
          console.log(`🔍 USE CART - Item ${index + 1} en currentOrder:`, {
            id: item.id,
            recipe_name: item.recipe_name,
            unit_price: item.unit_price,
            total_price: item.total_price,
            total_with_container: item.total_with_container,
            status: item.status
          });
        });
      }
      return order;
    });
  }, []);

  return useMemo(() => ({
    // Estado
    cart,
    currentOrder,
    
    // Acciones
    setCart,
    setCurrentOrder: setCurrentOrderWithLogging,
    addToCart,
    removeFromCart,
    updateCartItem,
    clearCart,
    updateCurrentOrderItemStatus,
    
    // Helpers
    getCartTotal,
    getCartItemCount
  }), [
    cart,
    currentOrder,
    setCart,
    setCurrentOrderWithLogging,
    addToCart,
    removeFromCart,
    updateCartItem,
    clearCart,
    updateCurrentOrderItemStatus,
    getCartTotal,
    getCartItemCount
  ]);
};