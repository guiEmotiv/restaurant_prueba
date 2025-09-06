/**
 * Herramienta de escaneo de impresoras desde el navegador
 * Permite probar diferentes IPs de forma sistemática
 */

// Scanner automático de IPs
window.scanPrinterRange = async (baseIP = '192.168.1', startRange = 1, endRange = 254) => {
  console.log(`🔍 Escaneando rango ${baseIP}.${startRange}-${endRange} buscando impresoras...`);
  
  const foundPrinters = [];
  const batchSize = 10; // Procesar de 10 en 10 para no saturar
  
  for (let i = startRange; i <= endRange; i += batchSize) {
    const batch = [];
    
    // Crear batch de IPs para probar
    for (let j = i; j < Math.min(i + batchSize, endRange + 1); j++) {
      const ip = `${baseIP}.${j}`;
      batch.push(testPrinterAtIP(ip));
    }
    
    // Probar batch actual
    console.log(`📡 Probando IPs ${baseIP}.${i}-${Math.min(i + batchSize - 1, endRange)}...`);
    const results = await Promise.allSettled(batch);
    
    // Procesar resultados
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        const ip = `${baseIP}.${i + index}`;
        foundPrinters.push(ip);
        console.log(`🖨️ ¡IMPRESORA ENCONTRADA EN ${ip}!`);
      }
    });
    
    // Si encontramos alguna, no seguir escaneando
    if (foundPrinters.length > 0) {
      break;
    }
    
    // Pausa pequeña entre batches
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (foundPrinters.length === 0) {
    console.log(`❌ No se encontraron impresoras en el rango ${baseIP}.${startRange}-${endRange}`);
  } else {
    console.log(`✅ Escaneado completado. Impresoras encontradas: ${foundPrinters}`);
    console.log(`💡 Para usar: setPrinterIP('${foundPrinters[0]}')`);
  }
  
  return foundPrinters;
};

// Test individual de IP con timeout corto
async function testPrinterAtIP(ip, timeout = 3000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch('/api/v1/kitchen/test_printer/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
      },
      body: JSON.stringify({
        printer_ip: ip,
        printer_port: 9100
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const result = await response.json();
    
    return {
      ip: ip,
      success: response.ok,
      result: result
    };
  } catch (error) {
    return {
      ip: ip,
      success: false,
      error: error.name === 'AbortError' ? 'timeout' : error.message
    };
  }
}

// Escaneo de rangos múltiples
window.scanMultipleRanges = async () => {
  console.log('🌐 Escaneando múltiples rangos de red buscando impresoras...');
  
  const ranges = [
    ['192.168.1', 1, 254],
    ['192.168.0', 1, 254], 
    ['10.0.0', 1, 254],
    ['172.16.0', 1, 254]
  ];
  
  for (const [baseIP, start, end] of ranges) {
    console.log(`\n📡 Probando red ${baseIP}.x...`);
    const found = await scanPrinterRange(baseIP, start, end);
    if (found.length > 0) {
      return found;
    }
  }
  
  console.log('\n❌ No se encontraron impresoras en ningún rango común');
  return [];
};

// Test de IPs específicas comunes para impresoras
window.quickPrinterScan = async () => {
  console.log('⚡ Escaneo rápido de IPs comunes de impresoras...');
  
  const commonIPs = [
    '192.168.1.23',  // La configurada
    '192.168.1.100', '192.168.1.101', '192.168.1.102',
    '192.168.1.200', '192.168.1.201', '192.168.1.202',
    '192.168.1.10', '192.168.1.11', '192.168.1.12',
    '192.168.0.100', '192.168.0.101', '192.168.0.102',
    '10.0.0.100', '10.0.0.101', '10.0.0.102'
  ];
  
  const tests = commonIPs.map(ip => testPrinterAtIP(ip));
  const results = await Promise.allSettled(tests);
  
  const found = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      const ip = commonIPs[index];
      found.push(ip);
      console.log(`🖨️ ¡Impresora encontrada en ${ip}!`);
    }
  });
  
  if (found.length === 0) {
    console.log('❌ No se encontraron impresoras en IPs comunes');
  } else {
    console.log(`✅ Escaneado rápido completado. Encontradas: ${found}`);
  }
  
  return found;
};

console.log('🔍 Scanner de impresoras cargado:');
console.log('• quickPrinterScan() - Escaneo rápido de IPs comunes');
console.log('• scanPrinterRange("192.168.1", 1, 254) - Escanear rango específico');
console.log('• scanMultipleRanges() - Escanear múltiples redes comunes');
console.log('• testPrinterWithIP("IP") - Probar IP específica');