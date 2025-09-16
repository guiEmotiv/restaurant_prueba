import CartItem from './CartItem';
import OrderItem from './OrderItem';
import { processExistingItems } from '../utils/cartHelpers';

const CartItemsList = ({
  cart,
  currentOrder,
  onRemoveFromCart,
  onCancelOrderItem,
  onOrderItemStatusChange,
  onRetryPrint,
  saving = false,
  // Nuevas props necesarias para verificación de roles
  canCancelItem,
  userRole,
  filterActiveItems
}) => {

  // Procesar items existentes con verificación de roles correcta
  const activeItems = currentOrder?.items ? filterActiveItems(currentOrder.items) : [];
  const processedOrderItems = processExistingItems(activeItems, canCancelItem, userRole);
  
  
  // Mostrar items del carrito + items de orden existente (ya procesados con verificación de roles)
  const hasCartItems = cart.length > 0;
  const hasOrderItems = processedOrderItems.length > 0;
  
  if (!hasCartItems && !hasOrderItems) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-lg">
        <p>No hay items en el pedido</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
        {/* Items de orden existente PRIMERO (ya procesados con verificación de roles correcta) */}
        {processedOrderItems.map((item, index) => (
          <OrderItem
            key={`order-${item.originalItem?.id || item.id}`}
            item={item}
            itemNumber={index + 1}
            onCancelItem={onCancelOrderItem}
            onStatusChange={onOrderItemStatusChange}
            onRetryPrint={onRetryPrint}
            saving={saving}
          />
        ))}
        
        {/* Items del carrito DESPUÉS (nuevos, continúan la numeración) */}
        {cart.map((item, index) => (
          <CartItem
            key={`cart-${item.cartIndex || index}`}
            item={item}
            itemNumber={processedOrderItems.length + index + 1}
            cartIndex={index}
            onRemoveFromCart={onRemoveFromCart}
            saving={saving}
          />
        ))}
    </div>
  );
};

export default CartItemsList;