import { useState, useCallback } from 'react';
import { apiService } from '../../../../services/api';

export const usePayment = (showToast) => {
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [withPrinting, setWithPrinting] = useState(false);
  const [bluetoothConnected, setBluetoothConnected] = useState(false);
  const [connectingBluetooth, setConnectingBluetooth] = useState(false);

  // Procesar pago
  const processPayment = useCallback(async () => {
    if (!selectedOrderForPayment || selectedItems.length === 0) return;

    try {
      setPaymentProcessing(true);
      
      const paymentData = {
        order_id: selectedOrderForPayment.id,
        item_ids: selectedItems,
        payment_method: paymentMethod,
        description: paymentDescription,
        with_printing: withPrinting
      };

      await apiService.payments.create(paymentData);
      
      showToast('Pago procesado exitosamente', 'success');
      
      // Limpiar estado
      setSelectedItems([]);
      setPaymentDescription('');
      
      return true;
    } catch (error) {
      showToast(`Error al procesar pago: ${error.message}`, 'error');
      return false;
    } finally {
      setPaymentProcessing(false);
    }
  }, [selectedOrderForPayment, selectedItems, paymentMethod, paymentDescription, withPrinting, showToast]);

  // Seleccionar/deseleccionar item para pago
  const toggleItemSelection = useCallback((itemId) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  }, []);

  // Seleccionar todos los items servidos
  const selectAllServedItems = useCallback(() => {
    if (!selectedOrderForPayment) return;
    
    const servedItems = selectedOrderForPayment.items
      .filter(item => item.status === 'SERVED' && !item.is_fully_paid);
    
    const allSelected = servedItems.every(item => selectedItems.includes(item.id));
    
    if (allSelected) {
      // Deseleccionar todos
      setSelectedItems(prev => prev.filter(id => 
        !servedItems.some(item => item.id === id)
      ));
    } else {
      // Seleccionar todos
      setSelectedItems(prev => {
        const newIds = servedItems
          .filter(item => !prev.includes(item.id))
          .map(item => item.id);
        return [...prev, ...newIds];
      });
    }
  }, [selectedOrderForPayment, selectedItems]);

  // Verificar si todos los items están pagados
  const areAllItemsPaid = useCallback((order) => {
    if (!order || !order.items) return false;
    return order.items.every(item => item.status === 'PAID' || item.is_fully_paid);
  }, []);

  // Verificar si se puede procesar pago
  const canProcessPayment = useCallback((order) => {
    if (!order || order.status === 'PAID' || !order.items || order.items.length === 0) {
      return false;
    }
    
    // Buscar items que estén SERVED y no pagados
    const servedUnpaidItems = order.items.filter(item => 
      item.status === 'SERVED' && !item.is_fully_paid
    );
    
    return servedUnpaidItems.length > 0;
  }, []);

  // Limpiar estado de pago
  const clearPaymentState = useCallback(() => {
    setSelectedOrderForPayment(null);
    setSelectedItems([]);
    setPaymentMethod('CASH');
    setPaymentDescription('');
    setWithPrinting(false);
  }, []);

  return {
    // Estado
    selectedOrderForPayment,
    paymentProcessing,
    selectedItems,
    paymentMethod,
    paymentDescription,
    withPrinting,
    bluetoothConnected,
    connectingBluetooth,
    
    // Acciones
    setSelectedOrderForPayment,
    setSelectedItems,
    setPaymentMethod,
    setPaymentDescription,
    setWithPrinting,
    setBluetoothConnected,
    setConnectingBluetooth,
    processPayment,
    toggleItemSelection,
    selectAllServedItems,
    clearPaymentState,
    
    // Helpers
    areAllItemsPaid,
    canProcessPayment
  };
};