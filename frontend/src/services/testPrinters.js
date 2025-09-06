/**
 * Script de prueba para ambas impresoras
 */

import ethernetKitchenPrinter from './ethernetKitchenPrinter.js';
// import bluetoothKitchenPrinter from './bluetoothKitchenPrinter.js';

// Test de conectividad Ethernet
export const testEthernetPrinter = async () => {
  try {
    console.log('🧪 Iniciando test de impresora Ethernet...');
    await ethernetKitchenPrinter.testPrinter();
    console.log('✅ Test Ethernet exitoso');
    return { success: true, method: 'ethernet' };
  } catch (error) {
    console.error('❌ Test Ethernet falló:', error);
    return { success: false, method: 'ethernet', error: error.message };
  }
};

// Test de status Ethernet
export const checkEthernetStatus = async () => {
  try {
    console.log('🔍 Verificando status de impresora Ethernet...');
    const status = await ethernetKitchenPrinter.getStatus();
    console.log('📊 Status Ethernet:', status);
    return status;
  } catch (error) {
    console.error('❌ Error verificando status Ethernet:', error);
    return { success: false, method: 'ethernet', error: error.message };
  }
};

// Ejemplo de etiqueta de prueba
export const testPrintLabel = async (printerType = 'ethernet') => {
  const mockOrderItem = {
    id: 999,
    quantity: 2,
    recipe_name: 'Lomo Saltado de Prueba',
    notes: 'Sin cebolla, extra papas'
  };
  
  const mockOrder = {
    id: 999,
    table_number: 15,
    zone_name: 'SALON',
    waiter: 'MESERO PRUEBA',
    customer_name: 'Cliente Test',
    items: [mockOrderItem]
  };
  
  try {
    if (printerType === 'ethernet') {
      console.log('🏷️ Imprimiendo etiqueta de prueba via Ethernet...');
      const result = await ethernetKitchenPrinter.printKitchenLabel(mockOrderItem, mockOrder);
      console.log('✅ Etiqueta de prueba Ethernet impresa:', result);
      return result;
    } else {
      console.log('🏷️ Imprimiendo etiqueta de prueba via Bluetooth...');
      // const result = await bluetoothKitchenPrinter.printKitchenLabel(mockOrderItem, mockOrder);
      // console.log('✅ Etiqueta de prueba Bluetooth impresa:', result);
      // return result;
      throw new Error('Bluetooth test no implementado en este script');
    }
  } catch (error) {
    console.error(`❌ Error imprimiendo etiqueta de prueba ${printerType}:`, error);
    return { success: false, method: printerType, error: error.message };
  }
};

// Ejecutar todos los tests
export const runAllTests = async () => {
  console.log('🧪 Iniciando tests de impresoras...');
  
  const results = {
    ethernet: {
      status: null,
      test: null,
      label: null
    }
  };
  
  // Test Ethernet
  results.ethernet.status = await checkEthernetStatus();
  results.ethernet.test = await testEthernetPrinter();
  results.ethernet.label = await testPrintLabel('ethernet');
  
  console.log('📊 Resultados completos:', results);
  return results;
};

export default {
  testEthernetPrinter,
  checkEthernetStatus,
  testPrintLabel,
  runAllTests
};