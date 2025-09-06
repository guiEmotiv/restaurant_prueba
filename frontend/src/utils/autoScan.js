/**
 * Escaneo automático desde la consola del navegador
 * Se ejecuta automáticamente al cargar
 */

// Función para escaneo automático inmediato
async function runImmediatePrinterScan() {
  console.log('🔍 ESCANEO AUTOMÁTICO DE IMPRESORAS INICIADO');
  console.log('=============================================');
  
  // IPs más comunes para impresoras
  const commonIPs = [
    '192.168.1.23',  // La configurada originalmente
    '192.168.1.100', '192.168.1.101', '192.168.1.102',
    '192.168.1.200', '192.168.1.201', '192.168.1.202', 
    '192.168.1.10', '192.168.1.11', '192.168.1.12',
    '192.168.1.20', '192.168.1.21', '192.168.1.22', '192.168.1.24', '192.168.1.25',
    '192.168.0.100', '192.168.0.101', '192.168.0.200'
  ];
  
  console.log(`📡 Probando ${commonIPs.length} IPs comunes para impresoras...`);
  
  const foundPrinters = [];
  let testsCompleted = 0;
  
  // Procesar en lotes pequeños para evitar saturar
  const batchSize = 5;
  
  for (let i = 0; i < commonIPs.length; i += batchSize) {
    const batch = commonIPs.slice(i, i + batchSize);
    
    console.log(`🔄 Probando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(commonIPs.length/batchSize)}: ${batch.join(', ')}`);
    
    const batchPromises = batch.map(async (ip) => {
      try {
        if (window.apiClient) {
          const response = await window.apiClient.post('/kitchen/test_printer/', {
            printer_ip: ip,
            printer_port: 9100
          });
          
          if (response.data.success) {
            foundPrinters.push(ip);
            console.log(`🖨️ ¡IMPRESORA ENCONTRADA EN ${ip}!`);
            console.log(`   📄 Respuesta: ${response.data.message}`);
            return { ip, success: true, message: response.data.message };
          }
        }
      } catch (error) {
        if (error.response?.status !== 500) {
          console.log(`⚠️ ${ip}: Error ${error.response?.status || 'de red'}`);
        }
      }
      testsCompleted++;
      return { ip, success: false };
    });
    
    await Promise.allSettled(batchPromises);
    
    // Pausa entre lotes para no saturar
    if (i + batchSize < commonIPs.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n📊 RESULTADOS DEL ESCANEO AUTOMÁTICO:');
  console.log('=====================================');
  
  if (foundPrinters.length > 0) {
    console.log(`✅ ¡IMPRESORAS ENCONTRADAS: ${foundPrinters.length}!`);
    foundPrinters.forEach(ip => {
      console.log(`   🖨️ ${ip}:9100`);
    });
    
    console.log('\n🎯 PARA USAR LA IMPRESORA:');
    console.log(`setPrinterIP('${foundPrinters[0]}')`);
    console.log('Luego recarga la página y prueba imprimir');
    
    // Auto-configurar la primera impresora encontrada
    if (foundPrinters.length === 1) {
      localStorage.setItem('printer_ip', foundPrinters[0]);
      console.log(`🔧 Auto-configurada: ${foundPrinters[0]}`);
      console.log('🔄 Recarga la página para aplicar');
    }
    
  } else {
    console.log('❌ No se encontraron impresoras en IPs comunes');
    console.log('\n🔍 OPCIONES ADICIONALES:');
    console.log('• scanPrinterRange("192.168.1", 1, 254) - Escaneo completo');
    console.log('• testPrinterWithIP("X.X.X.X") - Probar IP específica'); 
    console.log('• Cambiar a Bluetooth temporalmente');
    
    console.log('\n💡 POSIBLES CAUSAS:');
    console.log('• Impresora apagada o desconectada');
    console.log('• IP fuera del rango común');
    console.log('• Red aislada o VLAN diferente');
  }
  
  console.log(`\n✅ Escaneo completado: ${testsCompleted}/${commonIPs.length} IPs probadas`);
  return foundPrinters;
}

// Función para auto-ejecutar después de un delay
setTimeout(() => {
  if (window.apiClient && document.readyState === 'complete') {
    console.log('🚀 Ejecutando escaneo automático en 3 segundos...');
    setTimeout(runImmediatePrinterScan, 3000);
  }
}, 2000);

// Exponer función globalmente
window.runAutoScan = runImmediatePrinterScan;