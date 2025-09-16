import { useEffect } from 'react';
import useShoppingCart from './hooks/useShoppingCart';
import CartHeader from './components/CartHeader';
import CustomerForm from './components/CustomerForm';
import CartItemsList from './components/CartItemsList';
import CartSummary from './components/CartSummary';
import OrderActions from './components/OrderActions';
import { apiService } from '../../../../../services/api';

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
  saving,
  // Permission props
  userRole,
  canCancelItem,
  filterActiveItems
}) => {
  // Hook principal que orquesta toda la lógica
  const shoppingCart = useShoppingCart({
    cart,
    currentOrder,
    onRemoveFromCart,
    onSaveOrder,
    saving
  });

  // Función para reintentar impresión
  const handleRetryPrint = async (itemId) => {
    try {
      console.log('🔄 Reintentando impresión para item:', itemId);
      const result = await apiService.orderItems.retryPrint(itemId);

      if (result.success) {
        console.log('✅ Impresión exitosa:', result.message);

        // 🎯 ACTUALIZACIÓN LOCAL INMEDIATA - Actualizar el currentOrder directamente
        if (currentOrder && onUpdateCurrentOrder) {
          const updatedOrder = {
            ...currentOrder,
            items: currentOrder.items.map(item =>
              item.id === itemId
                ? {
                    ...item,
                    status: result.item.status,
                    print_confirmed: result.item.print_confirmed,
                    // Incluir cualquier otro campo que venga del servidor
                    ...result.item
                  }
                : item
            )
          };

          console.log('🔄 Actualizando estado local inmediatamente:', {
            itemId,
            newStatus: result.item.status,
            printConfirmed: result.item.print_confirmed
          });

          // Llamar correctamente con el objeto actualizado
          onUpdateCurrentOrder(updatedOrder);
        }
      } else {
        console.error('❌ Falló reintento de impresión:', result.message);
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ Error al reintentar impresión:', error);
      alert('Error al reintentar impresión');
    }
  };

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
          onRetryPrint={handleRetryPrint}
          saving={saving}
          // Permission props for role-based cancel button visibility
          canCancelItem={canCancelItem}
          userRole={userRole}
          filterActiveItems={filterActiveItems}
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
          // Permission props for role-based cancel order button
          userRole={userRole}
        />
      </div>
    </>
  );
};

export default OrderShoppingCartContainer;