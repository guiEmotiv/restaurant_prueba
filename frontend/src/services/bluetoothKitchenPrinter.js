/**
 * Servicio de impresión Bluetooth para etiquetas de cocina
 * Independiente del servicio de pago - configurado específicamente para cocina
 * Usa Web Bluetooth API para conexión directa desde navegador
 */

class BluetoothKitchenPrinter {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.isConnected = false;
    
    // Configuración específica para impresora de cocina (diferente de la de pagos)
    this.config = {
      deviceName: 'Kitchen Label Printer',
      macAddress: 'XX:XX:XX:XX:XX:XX', // Configurar con MAC específica de cocina
      pin: '0000', // PIN por defecto para etiquetadoras
      model: 'DMN-C-E-R03523 Label Printer',
      paperWidth: 80, // mm - papel de etiquetas
      printableWidth: 576, // px para 80mm
      speed: 120, // mm/s
      features: {
        autoCut: true,
        beeper: false // Silencioso en cocina
      },
      // UUIDs para impresoras de etiquetas ESC/POS
      serviceUUIDs: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Generic Attribute
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // RN4020/Microchip
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service
        '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10/CC2541
        '12345678-1234-5678-9abc-123456789abc'  // Custom UUID
      ],
      characteristicUUIDs: [
        '00002af1-0000-1000-8000-00805f9b34fb', // Generic
        '49535343-1e4d-4bd9-ba61-23c647249616', // RN4020 TX
        '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART TX
        '0000ffe1-0000-1000-8000-00805f9b34fb', // HM-10 TX
        '12345678-1234-5678-9abc-123456789abd'  // Custom TX
      ]
    };
    
    // Comandos ESC/POS para DMN-C-U R03523 (EPSON ESC/POS estándar)
    this.commands = {
      // Comandos básicos EPSON
      INIT: [0x1B, 0x40],                    // ESC @ - Reset completo
      LF: [0x0A],                            // Line Feed
      CR: [0x0D],                            // Carriage Return
      
      // Configurar Font-A (como en selftest)
      FONT_A: [0x1B, 0x4D, 0x00],           // ESC M 0 - Font A
      
      // Densidad y configuración térmica ESPECÍFICA POS E802B
      DENSITY_LEVEL2: [0x1D, 0x7C, 0x02],   // GS | 2 - Densidad nivel 2
      HEATING_DOTS: [0x1B, 0x37, 0x07, 0x64, 0x64], // ESC 7 - Configuración calor
      THERMAL_PRINT_SETTINGS: [0x1B, 0x37, 0x08, 0x32, 0x32], // Configuración térmica agresiva
      
      // Comandos específicos POS E802B para activar calor
      THERMAL_ACTIVATE: [0x1B, 0x37, 0x0A, 0xFF, 0xFF], // Activar elementos térmicos al máximo
      HEAT_TIME_LONG: [0x1B, 0x37, 0x0C, 0xFF, 0xFF],   // Tiempo de calentamiento largo
      PRINT_DENSITY_MAX: [0x1D, 0x28, 0x4C, 0x08, 0x00, 0x30, 0x67, 0x64, 0x04, 0xFF, 0xFF], // Densidad máxima
      
      // Alineación EPSON estándar
      ALIGN_LEFT: [0x1B, 0x61, 0x00],       // ESC a 0
      ALIGN_CENTER: [0x1B, 0x61, 0x01],     // ESC a 1  
      ALIGN_RIGHT: [0x1B, 0x61, 0x02],      // ESC a 2
      
      // Texto - negrita EPSON
      BOLD_ON: [0x1B, 0x45, 0x01],          // ESC E 1
      BOLD_OFF: [0x1B, 0x45, 0x00],         // ESC E 0
      
      // Tamaños de texto EPSON
      FONT_NORMAL: [0x1D, 0x21, 0x00],      // GS ! 0 - Normal
      FONT_DOUBLE_HEIGHT: [0x1D, 0x21, 0x10], // GS ! 16 - Doble altura
      FONT_DOUBLE_WIDTH: [0x1D, 0x21, 0x20],  // GS ! 32 - Doble ancho
      
      // Corte automático (Cutter Enable: YES)
      CUT_PAPER: [0x1D, 0x56, 0x00],        // GS V 0 - Corte completo
      PARTIAL_CUT: [0x1D, 0x56, 0x01],      // GS V 1 - Corte parcial
      
      // Beeper (Beeper Enable: YES)
      BEEP: [0x1B, 0x42, 0x05, 0x05],       // ESC B - Pitido
      
      // Código de página OEM437 (primera en la lista del selftest)
      CODEPAGE_437: [0x1B, 0x74, 0x00],     // ESC t 0 - OEM437
      
      // Avance de papel
      PAPER_FEED_LINES: [0x1B, 0x64, 0x03], // ESC d 3 - Avance 3 líneas
      
      // Comando de autotest hardware (específico para algunos modelos POS)
      HARDWARE_TEST: [0x1D, 0x28, 0x41, 0x02, 0x00, 0x00, 0x02] // Test hardware interno
    };
  }

  /**
   * Verifica si el navegador soporta Web Bluetooth
   */
  isBluetoothSupported() {
    return 'bluetooth' in navigator;
  }

  /**
   * Mensaje de error para navegadores no compatibles
   */
  getBluetoothErrorMessage() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isIOS || isSafari) {
      return 'Web Bluetooth no está soportado en iPhone/iPad Safari. Use Chrome en Android o Windows para imprimir etiquetas vía Bluetooth.';
    }
    return 'Web Bluetooth no está soportado en este navegador. Use Chrome, Edge o Firefox para acceder a la impresión de etiquetas Bluetooth.';
  }

  /**
   * Reconexión simple si hay dispositivo conectado
   */
  async reconnectIfNeeded() {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      try {
        await this.setupConnection();
        return true;
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  /**
   * Configura la conexión (servicios y características)
   */
  async setupConnection() {
    // Intentar conectar con diferentes UUIDs de servicio
    let serviceFound = false;
    for (const serviceUUID of this.config.serviceUUIDs) {
      try {
        this.service = await this.device.gatt.getPrimaryService(serviceUUID);
        serviceFound = true;
        break;
      } catch (error) {
        continue;
      }
    }

    if (!serviceFound) {
      throw new Error('No se pudo encontrar un servicio compatible en la etiquetadora');
    }

    // Intentar obtener característica con diferentes UUIDs
    let characteristicFound = false;
    for (const charUUID of this.config.characteristicUUIDs) {
      try {
        this.characteristic = await this.service.getCharacteristic(charUUID);
        characteristicFound = true;
        break;
      } catch (error) {
        continue;
      }
    }

    if (!characteristicFound) {
      throw new Error('No se pudo encontrar una característica compatible en la etiquetadora');
    }

    this.isConnected = true;
    
    // Verificar calidad de conexión
    await this.checkConnectionQuality();
  }
  
  /**
   * Verifica la calidad de la conexión Bluetooth
   */
  async checkConnectionQuality() {
    try {
      if (this.device && this.device.gatt) {
        
        // Si hay una función para obtener RSSI (fuerza de señal), usarla
        if (this.server && this.server.getPrimaryService) {
          try {
            // Intento de leer información del dispositivo para evaluar conexión
            const deviceInfo = await this.server.getPrimaryService('0000180a-0000-1000-8000-00805f9b34fb');
          } catch (error) {
          }
        }
        
        
      }
    } catch (error) {
    }
  }

  /**
   * Conecta con la impresora de etiquetas Bluetooth - siempre muestra modal
   */
  async connect() {
    if (!this.isBluetoothSupported()) {
      throw new Error(this.getBluetoothErrorMessage());
    }

    try {
      
      // Siempre solicitar dispositivo Bluetooth para mostrar modal
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.config.serviceUUIDs
      });

      
      // Conectar al servidor GATT
      this.server = await this.device.gatt.connect();

      // Configurar servicios y características
      await this.setupConnection();
      
      return true;

    } catch (error) {
      this.isConnected = false;
      throw new Error(`Error de conexión: ${error.message}`);
    }
  }

  /**
   * Desconecta de la impresora
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
  }

  /**
   * Envía comandos a la etiquetadora con manejo robusto para conexiones débiles
   */
  async sendCommand(command) {
    // Verificar si necesita reconectar
    if (!this.isConnected || !this.characteristic) {
      await this.connect();
    }

    try {
      const data = new Uint8Array(command);
      // ENVÍO ROBUSTO POR CHUNKS para conexiones débiles
      const chunkSize = 20; // Bluetooth LE limitation
      let bytesEnviados = 0;
      
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        
        try {
          await this.characteristic.writeValue(chunk);
          bytesEnviados += chunk.length;
          
          // Pausa más larga entre chunks para conexiones débiles
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (chunkError) {
          throw new Error(`Error transmitiendo datos en byte ${i}: ${chunkError.message}`);
        }
      }
      
      
      // Verificación adicional - esperar un momento para que lleguen todos los datos
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      // Si falla por desconexión, intentar reconectar una vez
      if (error.message.includes('GATT Server is disconnected') || error.message.includes('disconnected')) {
        try {
          await this.connect();
          // Reintento con el mismo proceso robusto
          return await this.sendCommand(command);
        } catch (retryError) {
          throw new Error(`Error enviando comando después de reconexión: ${retryError.message}`);
        }
      } else {
        throw new Error(`Error enviando comando: ${error.message}`);
      }
    }
  }

  /**
   * Imprime texto
   */
  async printText(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    await this.sendCommand(Array.from(data));
  }

  /**
   * Genera etiqueta para un item de la orden usando configuración exacta DMN-C-U R03523
   */
  generateKitchenLabel(orderItem, order) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit'
    });

    let label = [];
    
    // 1. INICIALIZACIÓN COMPLETA SEGÚN SELFTEST
    label.push(...this.commands.INIT);        // ESC @ - Reset completo
    label.push(...this.commands.CODEPAGE_437); // ESC t 0 - OEM437 (primera en lista selftest)
    label.push(...this.commands.FONT_A);      // ESC M 0 - Font-A (según selftest)
    label.push(...this.commands.DENSITY_LEVEL2); // GS | 2 - Densidad nivel 2 (según selftest)
    
    // 2. Saltos de línea iniciales
    label.push(...this.commands.LF);
    label.push(...this.commands.LF);
    
    // 3. ORDEN - centrado y en negrita
    label.push(...this.commands.ALIGN_CENTER);
    label.push(...this.commands.BOLD_ON);
    label.push(...this.commands.FONT_DOUBLE_HEIGHT);
    
    // Texto: "ORDEN 123"
    const orderText = `ORDEN ${order.id}`;
    const orderBytes = this.textToBytes(orderText);
    label.push(...orderBytes);
    
    label.push(...this.commands.BOLD_OFF);
    label.push(...this.commands.FONT_NORMAL);
    label.push(...this.commands.LF);
    label.push(...this.commands.LF);
    
    // 4. MESA/DELIVERY - centrado
    label.push(...this.commands.ALIGN_CENTER);
    label.push(...this.commands.BOLD_ON);
    
    if (order.table_number) {
      const tableText = `MESA ${order.table_number}`;
      const tableBytes = this.textToBytes(tableText);
      label.push(...tableBytes);
    } else {
      const deliveryBytes = this.textToBytes('DELIVERY');
      label.push(...deliveryBytes);
    }
    
    label.push(...this.commands.BOLD_OFF);
    label.push(...this.commands.LF);
    label.push(...this.commands.LF);
    
    // 5. SEPARADOR
    label.push(...this.commands.ALIGN_CENTER);
    const separatorBytes = this.textToBytes("------------------------");
    label.push(...separatorBytes);
    label.push(...this.commands.LF);
    label.push(...this.commands.LF);
    
    // 6. CANTIDAD - alineación izquierda
    label.push(...this.commands.ALIGN_LEFT);
    const cantText = `CANT: ${orderItem.quantity}`;
    const cantBytes = this.textToBytes(cantText);
    label.push(...cantBytes);
    label.push(...this.commands.LF);
    
    // 7. PRODUCTO - negrita y truncado
    label.push(...this.commands.BOLD_ON);
    const prod = orderItem.recipe_name || 'PRODUCTO';
    const prodText = `PROD: ${prod.substring(0, 20)}`;
    const prodBytes = this.textToBytes(prodText);
    label.push(...prodBytes);
    label.push(...this.commands.BOLD_OFF);
    label.push(...this.commands.LF);
    label.push(...this.commands.LF);
    
    // 8. HORA - centrada
    label.push(...this.commands.ALIGN_CENTER);
    const timeBytes = this.textToBytes(timeStr);
    label.push(...timeBytes);
    label.push(...this.commands.LF);
    
    // 9. AVANCE Y CORTE FINAL
    label.push(...this.commands.PAPER_FEED_LINES);
    label.push(...this.commands.LF);
    label.push(...this.commands.LF);
    label.push(...this.commands.CUT_PAPER);
    
    return new Uint8Array(label);
  }

  /**
   * Convierte texto a bytes compatible con impresoras ESC/POS
   */
  textToBytes(text) {
    // Convertir a ASCII básico - más compatible con impresoras
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      let charCode = text.charCodeAt(i);
      
      // Mapear caracteres especiales del español
      switch (text.charAt(i)) {
        case 'ñ': charCode = 164; break;
        case 'Ñ': charCode = 165; break;
        case 'á': charCode = 160; break;
        case 'é': charCode = 130; break;
        case 'í': charCode = 161; break;
        case 'ó': charCode = 162; break;
        case 'ú': charCode = 163; break;
        default:
          // Solo usar caracteres ASCII estándar (0-127)
          if (charCode > 127) {
            charCode = 63; // '?' para caracteres no soportados
          }
      }
      
      bytes.push(charCode);
    }
    return bytes;
  }

  /**
   * Imprime etiqueta para un item de cocina
   */
  async printKitchenLabel(orderItem, order) {
    try {
      // Si no está conectado, mostrar modal para conectar
      if (!this.isConnected) {
        await this.connect(); // Siempre muestra modal
      }

      // Verificar si sigue conectado después de la conexión
      if (!this.isConnected) {
        throw new Error('No se pudo establecer conexión con la etiquetadora.');
      }

      
      const labelData = this.generateKitchenLabel(orderItem, order);
      
      await this.sendCommand(Array.from(labelData));
      
      return { success: true, item_id: orderItem.id };
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Imprime múltiples etiquetas de cocina
   */
  async printMultipleLabels(orderItems, order) {
    const results = [];
    
    for (const item of orderItems) {
      try {
        const result = await this.printKitchenLabel(item, order);
        results.push({ item_id: item.id, success: true, result });
        
        // Pausa entre impresiones para evitar saturar la impresora
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        results.push({ 
          item_id: item.id, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return results;
  }

  /**
   * Inicialización simple - no conecta automáticamente
   */
  async initialize() {
    if (!this.isBluetoothSupported()) {
      return false;
    }

    return true;
  }

  /**
   * Test ULTRA BÁSICO - solo ASCII sin comandos ESC/POS
   */
  async testPrinterSimple() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // TEST ULTRA BÁSICO - SOLO caracteres ASCII básicos
      // NO usar textToBytes para evitar mapeo de caracteres
      let testLabel = [];
      
      // Solo caracteres ASCII directos - sin comandos
      // H O L A
      testLabel.push(72, 79, 76, 65);
      testLabel.push(10); // \n
      
      // T E S T
      testLabel.push(84, 69, 83, 84);
      testLabel.push(10); // \n
      
      // 1 2 3
      testLabel.push(49, 50, 51);
      testLabel.push(10); // \n
      
      // - - - -
      testLabel.push(45, 45, 45, 45);
      testLabel.push(10); // \n
      
      // Varios saltos de línea para avance
      testLabel.push(10, 10, 10, 10, 10, 10);
      
      console.log('📤 Enviando datos ultra básicos:', testLabel);
      await this.sendCommand(testLabel);
      
      return true;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Test de conectividad e impresión con configuración completa DMN-C-U R03523
   */
  async testPrinter() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // Etiqueta de prueba con configuración exacta
      let testLabel = [];
      
      // 1. Inicialización completa según selftest
      testLabel.push(...this.commands.INIT);        // ESC @ - Reset completo
      testLabel.push(...this.commands.CODEPAGE_437); // ESC t 0 - OEM437
      testLabel.push(...this.commands.FONT_A);      // ESC M 0 - Font A
      testLabel.push(...this.commands.DENSITY_LEVEL2); // GS | 2 - Densidad nivel 2
      
      // 2. Título centrado en negrita y tamaño doble
      testLabel.push(...this.commands.ALIGN_CENTER);
      testLabel.push(...this.commands.BOLD_ON);
      testLabel.push(...this.commands.FONT_DOUBLE_HEIGHT);
      testLabel.push(...this.textToBytes('TEST ETIQUETADORA'));
      testLabel.push(...this.commands.BOLD_OFF);
      testLabel.push(...this.commands.FONT_NORMAL);
      testLabel.push(...this.commands.LF);
      
      // 3. Subtítulo
      testLabel.push(...this.commands.BOLD_ON);
      testLabel.push(...this.textToBytes('COCINA'));
      testLabel.push(...this.commands.BOLD_OFF);
      testLabel.push(...this.commands.LF);
      testLabel.push(...this.commands.LF);
      
      // 4. Separador
      testLabel.push(...this.textToBytes('------------------------'));
      testLabel.push(...this.commands.LF);
      
      // 5. Información alineada a la izquierda
      testLabel.push(...this.commands.ALIGN_LEFT);
      testLabel.push(...this.textToBytes('Fecha y hora:'));
      testLabel.push(...this.commands.LF);
      testLabel.push(...this.textToBytes(new Date().toLocaleString('es-ES')));
      testLabel.push(...this.commands.LF);
      testLabel.push(...this.commands.LF);
      
      // 6. Mensaje de éxito centrado
      testLabel.push(...this.commands.ALIGN_CENTER);
      testLabel.push(...this.commands.BOLD_ON);
      testLabel.push(...this.textToBytes('Conexion exitosa!'));
      testLabel.push(...this.commands.BOLD_OFF);
      testLabel.push(...this.commands.LF);
      
      // 7. Especificaciones técnicas
      testLabel.push(...this.commands.ALIGN_LEFT);
      testLabel.push(...this.commands.LF);
      testLabel.push(...this.textToBytes('Modelo: DMN-C-U R03523'));
      testLabel.push(...this.commands.LF);
      testLabel.push(...this.textToBytes('Font-A, Densidad-2'));
      testLabel.push(...this.commands.LF);
      testLabel.push(...this.textToBytes('OEM437 codepage'));
      testLabel.push(...this.commands.LF);
      
      // 8. Avance y corte
      testLabel.push(...this.commands.PAPER_FEED_LINES);
      testLabel.push(...this.commands.LF);
      testLabel.push(...this.commands.CUT_PAPER);
      
      await this.sendCommand(testLabel);
      
      return true;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Test específico con configuración térmica máxima
   */
  async testThermalConfig() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      console.log('🔥 Configurando impresora para máximo calor');
      
      let testLabel = [];
      
      // 1. Reset completo y test de hardware
      testLabel.push(...this.commands.INIT);
      testLabel.push(...this.commands.HARDWARE_TEST);  // Test hardware interno
      
      // 2. Configuración térmica MÁXIMA para POS E802B
      testLabel.push(...this.commands.THERMAL_ACTIVATE);    // Activar elementos térmicos al máximo
      testLabel.push(...this.commands.HEAT_TIME_LONG);      // Tiempo de calentamiento largo
      testLabel.push(...this.commands.PRINT_DENSITY_MAX);   // Densidad máxima
      testLabel.push(...this.commands.HEATING_DOTS);        // Configuración calor
      testLabel.push(...this.commands.THERMAL_PRINT_SETTINGS); // Térmica agresiva
      testLabel.push(...this.commands.DENSITY_LEVEL2);      // Densidad nivel 2
      
      // 3. Configurar fuente y codepage
      testLabel.push(...this.commands.FONT_A);
      testLabel.push(...this.commands.CODEPAGE_437);
      
      // 4. Test con caracteres densos (muchas 'X' para forzar más tinta)
      const denseText = 'XXXXXXXXXXXXXXXXXXXXXXXX';
      for (let char of denseText) {
        testLabel.push(char.charCodeAt(0));
      }
      testLabel.push(10); // \n
      
      // 5. Más líneas densas
      for (let i = 0; i < 5; i++) {
        for (let char of 'HHHHHHHHHHHHHHHHHHHHHHHH') {
          testLabel.push(char.charCodeAt(0));
        }
        testLabel.push(10); // \n
      }
      
      // 6. Texto normal
      const normalText = 'TEST THERMAL CONFIG';
      for (let char of normalText) {
        testLabel.push(char.charCodeAt(0));
      }
      testLabel.push(10, 10, 10);
      
      // 7. Corte
      testLabel.push(...this.commands.CUT_PAPER);
      
      console.log('📤 Enviando test térmico:', testLabel);
      await this.sendCommand(testLabel);
      
      return true;
      
    } catch (error) {
      throw error;
    }
  }
}

// Instancia singleton para cocina
const bluetoothKitchenPrinter = new BluetoothKitchenPrinter();

// Función para inicializar automáticamente al cargar la página
export const initializeKitchenPrinter = async () => {
  try {
    return await bluetoothKitchenPrinter.initialize();
  } catch (error) {
    return false;
  }
};

// Función helper para imprimir etiquetas de cocina
export const printBluetoothKitchenLabels = async (orderItems, order) => {
  try {
    
    const results = await bluetoothKitchenPrinter.printMultipleLabels(orderItems, order);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    
    return {
      success: failed === 0,
      total: orderItems.length,
      successful,
      failed,
      results
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      total: orderItems.length,
      successful: 0,
      failed: orderItems.length
    };
  }
};

export default bluetoothKitchenPrinter;