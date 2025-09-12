import CartItem from './CartItem';
import OrderItem from './OrderItem';

const CartItemsList = ({ 
  cart,
  currentOrder,
  onRemoveFromCart,
  onCancelOrderItem,
  onOrderItemStatusChange,
  saving = false 
}) => {
  
  // Filtrar items cancelados - no mostrarlos en el panel lateral
  const visibleOrderItems = currentOrder?.items?.filter(item => item.status !== 'CANCELED') || [];
  
  
  // Mostrar items del carrito + items de orden existente (excluyendo cancelados)
  const hasCartItems = cart.length > 0;
  const hasOrderItems = visibleOrderItems.length > 0;
  
  if (!hasCartItems && !hasOrderItems) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-lg">
        <p>No hay items en el pedido</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
        {/* Items de orden existente PRIMERO (ya creados, con estado de impresión) - SOLO VISIBLES (NO CANCELED) */}
        {visibleOrderItems.map((item, index) => (
          <OrderItem
            key={`order-${item.id}`}
            item={item}
            itemNumber={index + 1}
            onCancelItem={onCancelOrderItem}
            onStatusChange={onOrderItemStatusChange}
            saving={saving}
          />
        ))}
        
        {/* Items del carrito DESPUÉS (nuevos, continúan la numeración) */}
        {cart.map((item, index) => (
          <CartItem
            key={`cart-${item.cartIndex || index}`}
            item={item}
            itemNumber={visibleOrderItems.length + index + 1}
            cartIndex={index}
            onRemoveFromCart={onRemoveFromCart}
            saving={saving}
          />
        ))}
    </div>
  );
};

export default CartItemsList;