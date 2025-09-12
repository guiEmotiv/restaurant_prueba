import { useCallback } from 'react';
import { useToast } from '../../../../../../contexts/ToastContext';
import useCartCalculations from './useCartCalculations';
import useCustomerForm from './useCustomerForm';

const useShoppingCart = ({
  cart,
  currentOrder,
  onRemoveFromCart,
  onSaveOrder,
  saving
}) => {
  const { showSuccess, showError } = useToast();

  // Hooks para cálculos y formulario
  const totals = useCartCalculations(cart, currentOrder);
  const customerForm = useCustomerForm(currentOrder);

  // Logs detallados para análisis
  const logRender = useCallback(() => {
    console.log('🟢 SHOPPING CART HOOK - RENDER:', {
      cartLength: cart?.length || 0,
      currentOrderId: currentOrder?.id,
      saving,
      timestamp: new Date().toISOString()
    });
  }, [cart?.length, currentOrder?.id, saving]);

  // Handler para guardar orden con datos del formulario
  const handleSaveOrder = useCallback(() => {
    try {
      console.log('🟦 HOOK - handleSaveOrder INICIADO con:', {
        customerName: customerForm.customerName,
        partySize: customerForm.partySize,
        cart: cart.length
      });
      
      onSaveOrder({
        customerName: customerForm.customerName.trim(),
        partySize: customerForm.partySize.trim()
      });
    } catch (error) {
      console.error('🔴 Error en handleSaveOrder:', error);
      showError('Error al guardar el pedido');
    }
  }, [onSaveOrder, customerForm.customerName, customerForm.partySize, cart.length, showError]);

  // Handler mejorado para toggle con reset de formulario
  const handleToggle = useCallback(() => {
    customerForm.handleToggle(false); // Resetear formulario al cerrar
  }, [customerForm]);

  return {
    // Estado
    totals,
    customerForm,
    
    // Handlers
    handleSaveOrder,
    handleToggle,
    logRender,
    
    // Props pass-through (sin modificar)
    cart,
    currentOrder,
    onRemoveFromCart,
    saving
  };
};

export default useShoppingCart;