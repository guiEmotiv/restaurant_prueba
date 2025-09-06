/**
 * Test de conectividad de impresora desde Node.js
 * Simula las llamadas que haría el frontend
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:8000';

// Test de conectividad básica al backend
async function testBackendConnectivity() {
  try {
    console.log('🔍 Probando conectividad con backend...');
    const response = await fetch(`${API_BASE}/api/v1/kitchen/printer_status/`);
    const result = await response.json();
    
    console.log('📡 Status:', response.status);
    console.log('📄 Response:', result);
    
    return { status: response.status, result };
  } catch (error) {
    console.error('❌ Error conectando al backend:', error.message);
    return { error: error.message };
  }
}

// Test de impresora directa
async function testPrinterDirect() {
  try {
    console.log('🖨️ Probando conexión directa con impresora...');
    
    const testData = {
      printer_ip: '192.168.1.23',
      printer_port: 9100
    };
    
    const response = await fetch(`${API_BASE}/api/v1/kitchen/test_printer/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    
    console.log('📡 Status:', response.status);
    console.log('📄 Response:', result);
    
    return { status: response.status, result };
  } catch (error) {
    console.error('❌ Error en test de impresora:', error.message);
    return { error: error.message };
  }
}

// Ejecutar todos los tests
async function runAllTests() {
  console.log('🧪 INICIANDO TESTS DE CONECTIVIDAD');
  console.log('===============================================');
  
  console.log('\n1️⃣ Test de Backend...');
  const backendResult = await testBackendConnectivity();
  
  console.log('\n2️⃣ Test de Impresora...');
  const printerResult = await testPrinterDirect();
  
  console.log('\n📊 RESUMEN:');
  console.log('===============================================');
  console.log('Backend:', backendResult.status || 'ERROR');
  console.log('Impresora:', printerResult.status || 'ERROR');
  
  return { backend: backendResult, printer: printerResult };
}

// Ejecutar tests
runAllTests().then(results => {
  console.log('\n✅ Tests completados');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Error en tests:', error);
  process.exit(1);
});