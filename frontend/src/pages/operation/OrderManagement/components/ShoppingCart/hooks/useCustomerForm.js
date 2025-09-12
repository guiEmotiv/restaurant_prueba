import { useState, useCallback, useEffect } from 'react';

const useCustomerForm = (currentOrder) => {
  
  console.log('🔍 [USE-CUSTOMER-FORM] Hook llamado con currentOrder:', {
    currentOrder,
    customer_name: currentOrder?.customer_name,
    party_size: currentOrder?.party_size
  });
  
  // Inicializar con los datos del currentOrder si existe, o valores vacíos si no
  const [customerName, setCustomerName] = useState(currentOrder?.customer_name || '');
  const [partySize, setPartySize] = useState(currentOrder?.party_size ? String(currentOrder.party_size) : '');
  
  // Actualizar los valores cuando currentOrder cambie
  useEffect(() => {
    console.log('🔍 [USE-CUSTOMER-FORM] useEffect triggered, currentOrder cambió:', {
      currentOrder,
      customer_name: currentOrder?.customer_name,
      party_size: currentOrder?.party_size
    });
    
    if (currentOrder) {
      console.log('🔍 [USE-CUSTOMER-FORM] Actualizando customerName y partySize');
      setCustomerName(currentOrder.customer_name || '');
      setPartySize(currentOrder.party_size ? String(currentOrder.party_size) : '');
    } else {
      console.log('🔍 [USE-CUSTOMER-FORM] currentOrder es null/undefined, limpiando formulario');
      setCustomerName('');
      setPartySize('');
    }
  }, [currentOrder]);

  // Handler para resetear el formulario
  const resetForm = useCallback(() => {
    setCustomerName('');
    setPartySize('');
  }, []);

  // Handler para cuando se cierra el carrito
  const handleToggle = useCallback((isOpen) => {
    if (!isOpen) {
      resetForm();
    }
  }, [resetForm]);

  return {
    customerName,
    partySize,
    setCustomerName,
    setPartySize,
    resetForm,
    handleToggle
  };
};

export default useCustomerForm;