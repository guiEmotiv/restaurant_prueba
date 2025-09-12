import { useEffect } from 'react';
import useShoppingCart from './hooks/useShoppingCart';
import CartHeader from './components/CartHeader';
import CustomerForm from './components/CustomerForm';
import CartItemsList from './components/CartItemsList';
import CartSummary from './components/CartSummary';
import OrderActions from './components/OrderActions';

const OrderShoppingCartContainer = ({ 
  isOpen, 
  onToggle, 
  cart, 
  currentOrder, 
  onRemoveFromCart, 
  onSaveOrder, 
  onCloseOrder,
  onCancelOrderItem,
  onUpdateCurrentOrder,
  onNavigateToZones,
  onOrderCanceled,
  onOrderItemStatusChange,
  saving
}) => {
  // Hook principal que orquesta toda la lógica
  const shoppingCart = useShoppingCart({
    cart,
    currentOrder,
    onRemoveFromCart,
    onSaveOrder,
    saving
  });

  // Log detallado en cada render
  useEffect(() => {
    shoppingCart.logRender();
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay para cerrar en móvil */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onToggle}
      />

      {/* Panel lateral */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col">
        
        {/* Header del carrito */}
        <CartHeader 
          currentOrder={currentOrder} 
          onClose={onToggle}
        />

        {/* Formulario del cliente - Solo si no hay pedido actual */}
        <CustomerForm 
          customerName={shoppingCart.customerForm.customerName}
          partySize={shoppingCart.customerForm.partySize}
          onCustomerNameChange={shoppingCart.customerForm.setCustomerName}
          onPartySizeChange={shoppingCart.customerForm.setPartySize}
          show={!currentOrder}
        />

        {/* Lista de items */}
        <CartItemsList 
          cart={cart}
          currentOrder={currentOrder}
          onRemoveFromCart={onRemoveFromCart}
          onCancelOrderItem={onCancelOrderItem}
          onOrderItemStatusChange={onOrderItemStatusChange}
          saving={saving}
        />

        {/* Resumen de totales */}
        <CartSummary 
          cartTotal={shoppingCart.totals.cartTotal}
          orderTotal={shoppingCart.totals.orderTotal}
          grandTotal={shoppingCart.totals.grandTotal}
        />

        {/* Acciones de la orden */}
        <OrderActions 
          cart={cart}
          currentOrder={currentOrder}
          customerName={shoppingCart.customerForm.customerName}
          partySize={shoppingCart.customerForm.partySize}
          onSaveOrder={shoppingCart.handleSaveOrder}
          onCloseOrder={onCloseOrder}
          onUpdateCurrentOrder={onUpdateCurrentOrder}
          onNavigateToZones={onNavigateToZones}
          onOrderCanceled={onOrderCanceled}
          saving={saving}
        />
      </div>
    </>
  );
};

export default OrderShoppingCartContainer;