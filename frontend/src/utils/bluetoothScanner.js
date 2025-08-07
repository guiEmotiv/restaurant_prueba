/**
 * Escáner de dispositivos Bluetooth para encontrar UUIDs de impresora
 * Usar en consola del navegador para identificar la impresora
 */

export const scanBluetoothDevices = async () => {
  if (!('bluetooth' in navigator)) {
    console.error('❌ Web Bluetooth no soportado');
    return;
  }

  try {
    console.log('🔍 Buscando dispositivos Bluetooth...');
    
    // Solicitar acceso a todos los dispositivos
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        // UUIDs comunes para impresoras
        '000018f0-0000-1000-8000-00805f9b34fb', // Generic
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // RN4020
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
        '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10
        '12345678-1234-5678-9abc-123456789abc', // Custom UUID
      ]
    });

    console.log('📱 Dispositivo encontrado:', {
      name: device.name,
      id: device.id
    });

    // Conectar al servidor GATT
    console.log('🔗 Conectando...');
    const server = await device.gatt.connect();
    console.log('✅ Conectado al servidor GATT');

    // Obtener todos los servicios
    console.log('🔍 Obteniendo servicios...');
    const services = await server.getPrimaryServices();
    
    console.log(`📋 Encontrados ${services.length} servicios:`);
    
    for (const service of services) {
      console.log(`📦 Servicio UUID: ${service.uuid}`);
      
      try {
        // Obtener características del servicio
        const characteristics = await service.getCharacteristics();
        console.log(`  └── ${characteristics.length} características:`);
        
        for (const characteristic of characteristics) {
          console.log(`      • Característica UUID: ${characteristic.uuid}`);
          console.log(`      • Propiedades:`, {
            read: characteristic.properties.read,
            write: characteristic.properties.write,
            writeWithoutResponse: characteristic.properties.writeWithoutResponse,
            notify: characteristic.properties.notify
          });
        }
      } catch (error) {
        console.log(`  ⚠️ No se pudieron obtener características: ${error.message}`);
      }
    }

    // Desconectar
    device.gatt.disconnect();
    console.log('✅ Escaneo completado');
    
    return {
      device: {
        name: device.name,
        id: device.id
      },
      services: services.map(service => ({
        uuid: service.uuid
      }))
    };

  } catch (error) {
    console.error('❌ Error escaneando:', error);
    throw error;
  }
};

// Función para usar en consola del navegador
window.scanBluetoothPrinter = scanBluetoothDevices;