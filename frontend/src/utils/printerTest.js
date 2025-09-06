/**
 * Script de prueba de conectividad de impresora
 * Ejecutar desde la consola del navegador en la vista de Cocina
 */

// Importar cliente API (esto debe hacerse desde el contexto del módulo)
// El cliente API se disponibiliza globalmente desde Kitchen.jsx

// Test de conectividad básica
window.testPrinterConnectivity = async () => {
  console.log('🔍 Probando conectividad con impresora Ethernet...');
  
  try {
    // Usar la instancia global de API si está disponible
    if (window.apiClient) {
      const response = await window.apiClient.get('/kitchen/printer_status/');
      console.log('📡 Respuesta del servidor:', response.data);
      console.log('✅ Conectividad verificada exitosamente');
      return response.data;
    } else {
      console.warn('⚠️ Cliente API no disponible, usando fetch directo');
      const response = await fetch('/api/v1/kitchen/printer_status/');
      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Conectividad verificada exitosamente');
        return result;
      } else {
        console.error('❌ Error de conectividad:', result);
        return result;
      }
    }
  } catch (error) {
    console.error('❌ Error de red:', error);
    return { error: error.message };
  }
};

// Test de impresión de prueba
window.testPrintLabel = async () => {
  console.log('🏷️ Probando impresión de etiqueta de prueba...');
  
  try {
    const testData = {
      printer_ip: '192.168.1.23',
      printer_port: 9100
    };
    
    const response = await fetch('/api/v1/kitchen/test_printer/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    console.log('🖨️ Resultado de impresión:', result);
    
    if (response.ok) {
      console.log('✅ Etiqueta de prueba enviada exitosamente');
      return result;
    } else {
      console.error('❌ Error al imprimir:', result);
      return result;
    }
  } catch (error) {
    console.error('❌ Error de impresión:', error);
    return { error: error.message };
  }
};

// Test completo
window.runPrinterTests = async () => {
  console.log('🧪 Iniciando tests completos de impresora...');
  console.log('==========================================');
  
  console.log('\n1️⃣ Test de conectividad...');
  const connectivityResult = await window.testPrinterConnectivity();
  
  console.log('\n2️⃣ Test de impresión...');
  const printResult = await window.testPrintLabel();
  
  console.log('\n📊 RESUMEN DE TESTS:');
  console.log('==========================================');
  console.log('Conectividad:', connectivityResult.success ? '✅' : '❌');
  console.log('Impresión:', printResult.success ? '✅' : '❌');
  
  return {
    connectivity: connectivityResult,
    printing: printResult
  };
};

// Configuración de IP de impresora
window.setPrinterIP = (ip, port = 9100) => {
  localStorage.setItem('printer_ip', ip);
  localStorage.setItem('printer_port', port.toString());
  console.log(`✅ IP de impresora configurada: ${ip}:${port}`);
  console.log('🔄 Recarga la página para aplicar los cambios');
};

window.getPrinterConfig = () => {
  const ip = localStorage.getItem('printer_ip') || '192.168.1.23';
  const port = localStorage.getItem('printer_port') || '9100';
  console.log(`📋 Configuración actual: ${ip}:${port}`);
  return { ip, port };
};

// Test con IP personalizada
window.testPrinterWithIP = async (ip, port = 9100) => {
  console.log(`🧪 Probando impresora en ${ip}:${port}...`);
  
  try {
    const response = await fetch('/api/v1/kitchen/test_printer/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
      },
      body: JSON.stringify({
        printer_ip: ip,
        printer_port: port
      })
    });
    
    const result = await response.json();
    console.log('📨 Resultado:', result);
    
    if (response.ok) {
      console.log(`✅ ¡Impresora encontrada en ${ip}:${port}!`);
      console.log('💡 Para usar esta IP permanentemente: setPrinterIP("' + ip + '", ' + port + ')');
      return result;
    } else {
      console.log(`❌ Sin respuesta en ${ip}:${port}:`, result.error);
      return result;
    }
  } catch (error) {
    console.log(`❌ Error conectando a ${ip}:${port}:`, error.message);
    return { error: error.message };
  }
};

console.log('🔧 Scripts de prueba de impresora cargados:');
console.log('• testPrinterConnectivity() - Verifica conectividad');
console.log('• testPrintLabel() - Prueba impresión');
console.log('• runPrinterTests() - Ejecuta todos los tests');
console.log('• setPrinterIP("192.168.1.XX") - Configura IP de impresora');
console.log('• getPrinterConfig() - Muestra configuración actual');
console.log('• testPrinterWithIP("192.168.1.XX") - Prueba IP específica');