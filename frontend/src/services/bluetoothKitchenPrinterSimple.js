/**
 * Servicio SIMPLIFICADO de impresión Bluetooth para etiquetas de cocina
 * Rediseñado desde cero para máxima compatibilidad
 */

class BluetoothKitchenPrinterSimple {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.isConnected = false;
    
    // Configuración MÍNIMA - solo lo esencial
    this.config = {
      // Intentar con TODOS los UUIDs posibles
      serviceUUIDs: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
      ],
      characteristicUUIDs: [
        '00002af1-0000-1000-8000-00805f9b34fb',
        '49535343-1e4d-4bd9-ba61-23c647249616',
        '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
        '0000ffe1-0000-1000-8000-00805f9b34fb',
        '0000ff01-0000-1000-8000-00805f9b34fb',
        '0000ff02-0000-1000-8000-00805f9b34fb',
        'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'
      ]
    };
  }

  /**
   * Conectar con configuración mínima
   */
  async connect() {
    try {
      console.log('🔌 Iniciando conexión Bluetooth simplificada...');
      
      // Solicitar dispositivo - acepta TODO
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.config.serviceUUIDs
      });

      console.log('✅ Dispositivo seleccionado:', this.device.name);

      // Conectar GATT
      this.server = await this.device.gatt.connect();
      console.log('✅ GATT conectado');

      // Buscar CUALQUIER servicio que funcione
      let serviceFound = false;
      for (const uuid of this.config.serviceUUIDs) {
        try {
          this.service = await this.server.getPrimaryService(uuid);
          console.log('✅ Servicio encontrado:', uuid);
          serviceFound = true;
          break;
        } catch (e) {
          console.log('❌ UUID no encontrado:', uuid);
        }
      }

      if (!serviceFound) {
        // Intentar obtener TODOS los servicios
        const services = await this.server.getPrimaryServices();
        if (services.length > 0) {
          this.service = services[0];
          console.log('✅ Usando primer servicio disponible:', this.service.uuid);
          serviceFound = true;
        }
      }

      if (!serviceFound) {
        throw new Error('No se encontró ningún servicio');
      }

      // Buscar CUALQUIER característica de escritura
      let charFound = false;
      for (const uuid of this.config.characteristicUUIDs) {
        try {
          this.characteristic = await this.service.getCharacteristic(uuid);
          console.log('✅ Característica encontrada:', uuid);
          charFound = true;
          break;
        } catch (e) {
          console.log('❌ Característica no encontrada:', uuid);
        }
      }

      if (!charFound) {
        // Intentar obtener TODAS las características
        const characteristics = await this.service.getCharacteristics();
        for (const char of characteristics) {
          const properties = char.properties;
          if (properties.write || properties.writeWithoutResponse) {
            this.characteristic = char;
            console.log('✅ Usando característica con escritura:', char.uuid);
            charFound = true;
            break;
          }
        }
      }

      if (!charFound) {
        throw new Error('No se encontró característica de escritura');
      }

      this.isConnected = true;
      console.log('✅ CONEXIÓN COMPLETA');
      return true;

    } catch (error) {
      console.error('❌ Error de conexión:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Enviar datos SIMPLE - sin chunks complicados
   */
  async sendData(data) {
    if (!this.isConnected || !this.characteristic) {
      throw new Error('No conectado');
    }

    try {
      const uint8Data = new Uint8Array(data);
      
      // Intentar envío directo primero
      try {
        await this.characteristic.writeValue(uint8Data);
        console.log('✅ Datos enviados directamente');
        return true;
      } catch (e) {
        console.log('⚠️ Envío directo falló, intentando por chunks...');
      }

      // Si falla, intentar por chunks pequeños
      const chunkSize = 20;
      for (let i = 0; i < uint8Data.length; i += chunkSize) {
        const chunk = uint8Data.slice(i, Math.min(i + chunkSize, uint8Data.length));
        await this.characteristic.writeValue(chunk);
        await new Promise(resolve => setTimeout(resolve, 50)); // Pausa corta
      }
      
      console.log('✅ Datos enviados por chunks');
      return true;

    } catch (error) {
      console.error('❌ Error enviando datos:', error);
      throw error;
    }
  }

  /**
   * Test 1: Solo texto ASCII puro
   */
  async testPureAscii() {
    console.log('🧪 Test 1: ASCII puro');
    const text = "TEST ASCII\n123456789\nHOLA MUNDO\n\n\n\n";
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    await this.sendData(data);
  }

  /**
   * IDENTIFICAR QUÉ COMANDO GENERA LA LÍNEA
   */
  async testWhatWorksStep() {
    console.log('🔍 Identificando comando que genera línea...');
    
    const tests = [
      {
        name: 'Solo Line Feed',
        data: [0x0A]
      },
      {
        name: 'Solo Carriage Return',
        data: [0x0D]
      },
      {
        name: 'LF + CR',
        data: [0x0A, 0x0D]
      },
      {
        name: 'Solo Reset',
        data: [0x1B, 0x40]
      },
      {
        name: 'Solo Cut',
        data: [0x1D, 0x56, 0x00]
      },
      {
        name: 'Solo Feed Lines',
        data: [0x1B, 0x64, 0x03]
      },
      {
        name: 'Solo guiones ASCII',
        data: [45, 45, 45, 45, 45, 45, 45, 45]
      },
      {
        name: 'Reset + guiones + LF',
        data: [0x1B, 0x40, 45, 45, 45, 45, 45, 45, 45, 45, 0x0A]
      }
    ];

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      console.log(`📝 Test ${i+1}: ${test.name}`);
      
      try {
        await this.sendData(test.data);
        console.log(`✅ ${test.name} - enviado`);
        
        // Pausa entre tests para ver cuál imprime
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ ${test.name} - error:`, error);
      }
    }
    
    console.log('🔍 Revisa qué tests imprimieron líneas');
  }

  /**
   * Test 2: Comandos ESC/POS mínimos
   */
  async testMinimalEscPos() {
    console.log('🧪 Test 2: ESC/POS mínimo');
    const commands = [
      0x1B, 0x40,  // ESC @ - Reset
      ...Array.from("TEST ESC POS\n"),
      0x0A, 0x0A, 0x0A, // Line feeds
      0x1D, 0x56, 0x00  // GS V 0 - Cut
    ];
    await this.sendData(commands.map(c => typeof c === 'string' ? c.charCodeAt(0) : c));
  }

  /**
   * Test 3: Configuración térmica básica
   */
  async testThermalBasic() {
    console.log('🧪 Test 3: Térmica básica');
    const commands = [
      0x1B, 0x40,  // Reset
      0x1B, 0x37, 0x07, 0xFF, 0x50,  // Heating dots: max, time: 80
      0x1B, 0x37, 0x08, 0x64, 0x02,  // Heating time: 100, interval: 2
      ...Array.from("TEST THERMAL\n"),
      ...Array.from("XXXXXXXXXX\n"),
      ...Array.from("1234567890\n"),
      0x0A, 0x0A, 0x0A,
      0x1D, 0x56, 0x00  // Cut
    ];
    await this.sendData(commands.map(c => typeof c === 'string' ? c.charCodeAt(0) : c));
  }

  /**
   * Test 4: Patrón de densidad
   */
  async testDensityPattern() {
    console.log('🧪 Test 4: Patrón de densidad');
    const commands = [
      0x1B, 0x40,  // Reset
      // Configurar densidad máxima
      0x1D, 0x7C, 0x08,  // Max density
      // Patrón denso
      ...Array.from("████████████████\n"),
      ...Array.from("▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n"),
      ...Array.from("░░░░░░░░░░░░░░░░\n"),
      ...Array.from("HHHHHHHHHHHHHHHH\n"),
      ...Array.from("MMMMMMMMMMMMMMMM\n"),
      0x0A, 0x0A, 0x0A,
      0x1D, 0x56, 0x00  // Cut
    ];
    await this.sendData(commands.map(c => typeof c === 'string' ? c.charCodeAt(0) : c));
  }

  /**
   * Test 5: Autotest del hardware
   */
  async testHardwareSelfTest() {
    console.log('🧪 Test 5: Hardware self-test');
    const commands = [
      0x1B, 0x40,  // Reset
      0x1D, 0x28, 0x41, 0x02, 0x00, 0x00, 0x02,  // Print test page
      0x12, 0x54  // Alternate test command
    ];
    await this.sendData(commands);
  }

  /**
   * DIAGNÓSTICO PROFUNDO DE HARDWARE
   */
  async deepHardwareDiagnostic() {
    console.log('🔍 INICIANDO DIAGNÓSTICO PROFUNDO DE HARDWARE');
    
    const diagnosticTests = [
      {
        name: 'Estado de impresora',
        commands: [0x10, 0x04, 0x01]  // DLE EOT 1 - Estado de impresora
      },
      {
        name: 'Estado de papel',
        commands: [0x10, 0x04, 0x04]  // DLE EOT 4 - Estado de papel
      },
      {
        name: 'Versión firmware',
        commands: [0x1D, 0x49, 0x01]  // GS I 1 - ID de impresora
      },
      {
        name: 'Información del modelo',
        commands: [0x1D, 0x49, 0x02]  // GS I 2 - Información de modelo
      },
      {
        name: 'Configuración actual',
        commands: [0x1D, 0x49, 0x03]  // GS I 3 - Configuración
      },
      {
        name: 'Test de memoria',
        commands: [0x1D, 0x49, 0x04]  // GS I 4 - ROM version
      },
      {
        name: 'Autotest completo',
        commands: [0x1D, 0x28, 0x41, 0x02, 0x00, 0x00, 0x02]  // Print test page
      }
    ];

    const results = [];
    
    for (const test of diagnosticTests) {
      try {
        console.log(`📋 Ejecutando: ${test.name}`);
        await this.sendData(test.commands);
        results.push({ test: test.name, status: 'enviado' });
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error en ${test.name}:`, error);
        results.push({ test: test.name, status: 'error', error: error.message });
      }
    }
    
    return results;
  }

  /**
   * RESET DE FÁBRICA Y RECONFIGURACIÓN
   */
  async factoryResetAndReconfigure() {
    console.log('⚠️ RESET DE FÁBRICA Y RECONFIGURACIÓN');
    
    try {
      // 1. Reset completo de fábrica
      console.log('1️⃣ Reset de fábrica...');
      await this.sendData([
        0x1B, 0x40,  // ESC @ - Reset
        0x1B, 0x3F, 0x0A, 0x00  // ESC ? - Reset a valores de fábrica
      ]);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 2. Configuración térmica para POS E802B
      console.log('2️⃣ Configurando parámetros térmicos...');
      await this.sendData([
        // Configuración de calor máximo
        0x1B, 0x37, 0x07, 0xFF, 0xFF,  // Heating dots: máximo
        0x1B, 0x37, 0x08, 0xFF, 0x02,  // Heating time: máximo
        0x1B, 0x37, 0x0A, 0xFF, 0xFF,  // Activar elementos térmicos
        
        // Densidad máxima
        0x1D, 0x7C, 0x08,  // Max density
        
        // Configuración de impresión
        0x1B, 0x32,  // Default line spacing
        0x1B, 0x4D, 0x00,  // Font A
        0x1B, 0x74, 0x00,  // Codepage 437
        
        // Habilitar todos los sensores
        0x1B, 0x63, 0x34, 0x00,  // Enable paper sensor
        0x1B, 0x63, 0x35, 0x00   // Enable panel buttons
      ]);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 3. Test de verificación
      console.log('3️⃣ Test de verificación...');
      await this.sendData([
        0x1B, 0x40,  // Reset
        ...Array.from('CONFIGURACION COMPLETADA\n'),
        ...Array.from('TEST 123456789\n'),
        ...Array.from('XXXXXXXXXXXXXXXX\n'),
        0x0A, 0x0A, 0x0A,
        0x1D, 0x56, 0x00  // Cut
      ]);
      
      console.log('✅ Reconfiguración completada');
      return true;
      
    } catch (error) {
      console.error('❌ Error en reconfiguración:', error);
      throw error;
    }
  }

  /**
   * VERIFICAR CONFIGURACIÓN TÉRMICA
   */
  async verifyThermalConfig() {
    console.log('🌡️ VERIFICANDO CONFIGURACIÓN TÉRMICA');
    
    // Comandos para leer configuración térmica actual
    const configCommands = [
      {
        name: 'Leer densidad',
        commands: [0x1D, 0x7C, 0x00]  // GS | - Leer densidad actual
      },
      {
        name: 'Leer configuración térmica',
        commands: [0x1B, 0x37, 0x00]  // ESC 7 - Leer config térmica
      },
      {
        name: 'Estado de calentador',
        commands: [0x10, 0x04, 0x05]  // DLE EOT 5 - Estado térmico
      }
    ];

    for (const config of configCommands) {
      try {
        console.log(`📊 Leyendo: ${config.name}`);
        await this.sendData(config.commands);
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`❌ Error leyendo ${config.name}:`, error);
      }
    }
  }

  /**
   * TEST DE PATRONES TÉRMICOS PROGRESIVOS
   */
  async progressiveThermalTest() {
    console.log('📈 TEST DE PATRONES TÉRMICOS PROGRESIVOS');
    
    const patterns = [
      { density: 0x01, pattern: '░░░░░░░░', name: 'Densidad 1' },
      { density: 0x02, pattern: '▒▒▒▒▒▒▒▒', name: 'Densidad 2' },
      { density: 0x04, pattern: '▓▓▓▓▓▓▓▓', name: 'Densidad 4' },
      { density: 0x08, pattern: '████████', name: 'Densidad 8' }
    ];

    for (const test of patterns) {
      try {
        console.log(`🎨 Probando: ${test.name}`);
        const commands = [
          0x1B, 0x40,  // Reset
          0x1D, 0x7C, test.density,  // Set density
          ...Array.from(`${test.name}:\n`),
          ...Array.from(`${test.pattern}\n`),
          ...Array.from('ABCDEFGHIJKLMNOP\n'),
          0x0A, 0x0A
        ];
        await this.sendData(commands);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Error en ${test.name}:`, error);
      }
    }
    
    // Corte final
    await this.sendData([0x1D, 0x56, 0x00]);
  }

  /**
   * Test secuencial completo
   */
  async runAllTests() {
    if (!this.isConnected) {
      await this.connect();
    }

    console.log('🚀 Iniciando batería de tests...');
    
    const tests = [
      { name: 'ASCII Puro', fn: () => this.testPureAscii() },
      { name: 'ESC/POS Mínimo', fn: () => this.testMinimalEscPos() },
      { name: 'Térmica Básica', fn: () => this.testThermalBasic() },
      { name: 'Patrón Densidad', fn: () => this.testDensityPattern() },
      { name: 'Hardware Test', fn: () => this.testHardwareSelfTest() }
    ];

    for (const test of tests) {
      try {
        console.log(`\n📝 Ejecutando: ${test.name}`);
        await test.fn();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Pausa entre tests
        console.log(`✅ ${test.name} completado`);
      } catch (error) {
        console.error(`❌ ${test.name} falló:`, error);
      }
    }

    console.log('\n✨ Batería de tests completada');
  }

  /**
   * Imprimir etiqueta de cocina SIMPLIFICADA
   */
  async printKitchenLabel(orderItem, order) {
    console.log('🏷️ Imprimiendo etiqueta simplificada');
    
    // Generar texto simple
    const text = [
      '',
      `ORDEN #${order.id}`,
      `MESA ${order.table_number || 'DELIVERY'}`,
      '------------------------',
      `${orderItem.quantity}x ${orderItem.recipe_name}`,
      '',
      new Date().toLocaleTimeString('es-ES'),
      '',
      '',
      ''
    ].join('\n');

    // Convertir a bytes
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text);

    // Agregar comandos mínimos
    const commands = [
      0x1B, 0x40,  // Reset
      ...Array.from(textBytes),
      0x1D, 0x56, 0x00  // Cut
    ];

    await this.sendData(commands);
  }

  /**
   * Desconectar
   */
  disconnect() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.isConnected = false;
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    console.log('🔌 Desconectado');
  }
}

// Exportar instancia singleton
const printerSimple = new BluetoothKitchenPrinterSimple();
export default printerSimple;