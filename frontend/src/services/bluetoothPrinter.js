/**
 * Servicio de impresión Bluetooth para comprobantes de pago
 * Configurado para HOIN POS-58 con PIN: 1234, MAC: 66:32:35:92:92:26
 * Usa Web Bluetooth API para conexión directa desde navegador
 */

class BluetoothPrinterService {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.isConnected = false;
    
    // Configuración de la impresora HOIN POS-58
    this.config = {
      deviceName: 'Bluetooth Printer',
      macAddress: '66:32:35:92:92:26',
      pin: '1234',
      model: 'HOIN POS-58 (H58/H200)',
      paperWidth: 58, // mm
      printableWidth: 384, // px para 58mm
      printableWidth80: 576, // px para 80mm (futuro)
      speed: 90, // mm/s max
      features: {
        autoCut: true,
        beeper: true
      },
      // UUIDs alternativos para diferentes tipos de impresoras
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
    
    // Comandos ESC/POS para etiquetera
    this.commands = {
      INIT: [0x1B, 0x40],           // Inicializar impresora
      LF: [0x0A],                   // Salto de línea
      CR: [0x0D],                   // Retorno de carro
      CUT_PAPER: [0x1D, 0x56, 0x00], // Cortar papel
      ALIGN_LEFT: [0x1B, 0x61, 0x00],   // Alinear izquierda
      ALIGN_CENTER: [0x1B, 0x61, 0x01], // Alinear centro
      ALIGN_RIGHT: [0x1B, 0x61, 0x02],  // Alinear derecha
      BOLD_ON: [0x1B, 0x45, 0x01],      // Activar negrita
      BOLD_OFF: [0x1B, 0x45, 0x00],     // Desactivar negrita
      UNDERLINE_ON: [0x1B, 0x2D, 0x01], // Activar subrayado
      UNDERLINE_OFF: [0x1B, 0x2D, 0x00], // Desactivar subrayado
      FONT_A: [0x1B, 0x4D, 0x00],       // Fuente A (normal)
      FONT_B: [0x1B, 0x4D, 0x01],       // Fuente B (pequeña)
    };
  }

  /**
   * Verifica si el navegador soporta Web Bluetooth
   */
  isBluetoothSupported() {
    return 'bluetooth' in navigator;
  }

  getBluetoothErrorMessage() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isIOS || isSafari) {
      return 'Web Bluetooth no está soportado en iPhone/iPad Safari. Use Chrome en Android o Windows para imprimir vía Bluetooth.';
    }
    return 'Web Bluetooth no está soportado en este navegador. Use Chrome, Edge o Firefox para acceder a la función de impresión Bluetooth.';
  }

  /**
   * Conecta con la impresora Bluetooth
   */
  async connect() {
    if (!this.isBluetoothSupported()) {
      throw new Error(this.getBluetoothErrorMessage());
    }

    try {
      
      // Solicitar dispositivo Bluetooth con todos los UUIDs posibles
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.config.serviceUUIDs
      });


      // Conectar al servidor GATT
      this.server = await this.device.gatt.connect();

      // Intentar conectar con diferentes UUIDs de servicio
      let serviceFound = false;
      for (const serviceUUID of this.config.serviceUUIDs) {
        try {
          this.service = await this.server.getPrimaryService(serviceUUID);
          serviceFound = true;
          break;
        } catch (error) {
          continue;
        }
      }

      if (!serviceFound) {
        throw new Error('No se pudo encontrar un servicio compatible en la impresora');
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
        throw new Error('No se pudo encontrar una característica compatible en la impresora');
      }

      this.isConnected = true;

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
   * Envía comandos a la impresora
   */
  async sendCommand(command) {
    if (!this.isConnected || !this.characteristic) {
      throw new Error('Impresora no conectada');
    }

    try {
      const data = new Uint8Array(command);
      await this.characteristic.writeValue(data);
    } catch (error) {
      throw new Error(`Error de impresión: ${error.message}`);
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
   * Genera e imprime el comprobante de pago
   */
  async printPaymentReceipt(paymentData) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // Inicializar impresora
      await this.sendCommand(this.commands.INIT);
      await this.sendCommand(this.commands.FONT_A);

      // Header centrado (solo ASCII)
      await this.sendCommand(this.commands.ALIGN_CENTER);
      await this.sendCommand(this.commands.BOLD_ON);
      await this.printText('EL FOGON DE DON SOTO\n');
      await this.sendCommand(this.commands.BOLD_OFF);
      await this.printText('COMPROBANTE\n\n');

      // Información básica alineada (igual que web)
      await this.sendCommand(this.commands.ALIGN_LEFT);
      await this.printText(`Orden:               #${paymentData.order.id}\n`);
      await this.printText(`Mesa:                ${paymentData.order.table_number}\n`);
      
      if (paymentData.order.waiter) {
        await this.printText(`Mesero:              ${paymentData.order.waiter}\n`);
      }
      
      // Usar fecha y hora del pago, no de impresión
      const paymentDate = paymentData.payment.created_at || paymentData.order.created_at || new Date().toISOString();
      const { fecha, hora } = this.formatDateTime(new Date(paymentDate));
      await this.printText(`Fecha:               ${fecha}\n`);
      await this.printText(`Hora:                ${hora}\n`);

      // Separador (48 caracteres para usar todo el ancho)
      await this.printText('------------------------------------------------\n');

      // Items con formato de columnas perfectamente alineado
      let itemsTotal = 0;
      if (paymentData.order.items && paymentData.order.items.length > 0) {
        for (const item of paymentData.order.items) {
          const itemName = item.recipe_name || 'Item';
          const quantity = item.quantity || 1;
          const itemPrice = parseFloat(item.total_price || 0);
          itemsTotal += itemPrice;
          const price = this.formatPrice(itemPrice); // Sin símbolo S/
          
          // Usar todo el ancho disponible de impresora 58mm (48 caracteres)
          const totalWidth = 48;
          const priceWidth = 10; // Ancho fijo para precios
          const itemWidth = totalWidth - priceWidth;
          
          // Crear la línea del item y normalizar caracteres especiales
          const itemLine = `${quantity}x ${itemName}`
            .replace(/ñ/g, 'n')
            .replace(/á/g, 'a')
            .replace(/é/g, 'e')
            .replace(/í/g, 'i')
            .replace(/ó/g, 'o')
            .replace(/ú/g, 'u')
            .replace(/Ñ/g, 'N')
            .replace(/Á/g, 'A')
            .replace(/É/g, 'E')
            .replace(/Í/g, 'I')
            .replace(/Ó/g, 'O')
            .replace(/Ú/g, 'U');
          
          // Truncar si excede el ancho
          let finalItemLine = itemLine.length > itemWidth 
            ? itemLine.substring(0, itemWidth - 3) + '...' 
            : itemLine;
          
          // Calcular espacios necesarios para alineación exacta
          const spacesNeeded = itemWidth - finalItemLine.length;
          const spaces = ' '.repeat(Math.max(0, spacesNeeded));
          
          // Formatear precio con ancho fijo
          const formattedPrice = price.padStart(priceWidth, ' ');
          
          // Construir línea completa con alineación precisa
          const fullLine = finalItemLine + spaces + formattedPrice;
          
          await this.printText(`${fullLine}\n`);
          
          if (item.is_takeaway) {
            await this.printText(`  Para llevar\n`);
          }
        }
      }

      // Separador antes del total
      await this.printText('------------------------------------------------\n');

      // Total alineado perfectamente con las columnas
      const displayTotal = this.formatCurrency(itemsTotal || paymentData.amount || paymentData.order.total_amount || 0);
      const totalLine = 'TOTAL:';
      const totalWidth = 48;
      const priceWidth = 10; // Mismo ancho que para items
      const labelWidth = totalWidth - priceWidth;
      
      // Calcular espacios exactos para el total
      const spacesNeededTotal = labelWidth - totalLine.length;
      const spacesTotal = ' '.repeat(Math.max(0, spacesNeededTotal));
      const formattedTotal = displayTotal.padStart(priceWidth, ' ');
      
      const fullTotalLine = totalLine + spacesTotal + formattedTotal;
      
      await this.sendCommand(this.commands.BOLD_ON);
      await this.printText(`${fullTotalLine}\n`);
      await this.sendCommand(this.commands.BOLD_OFF);

      // Separador final
      await this.printText('------------------------------------------------\n');

      // Footer centrado (solo ASCII)
      await this.sendCommand(this.commands.ALIGN_CENTER);
      await this.printText('Gracias por su visita!\n');

      // Espaciado suficiente antes del corte para evitar corte del texto
      await this.printText('\n\n\n\n');
      await this.sendCommand(this.commands.CUT_PAPER);

      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Formatea cantidad como moneda peruana
   */
  formatCurrency(amount) {
    const value = parseFloat(amount) || 0;
    return `S/ ${value.toFixed(2)}`;
  }

  /**
   * Formatea cantidad sin símbolo de moneda (solo para items)
   */
  formatPrice(amount) {
    const value = parseFloat(amount) || 0;
    return value.toFixed(2);
  }

  /**
   * Formatea fecha y hora
   */
  formatDateTime(date) {
    const d = new Date(date);
    
    // Formatear fecha como DD/MM/YYYY
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const fecha = `${day}/${month}/${year}`;
    
    // Formatear hora como HH:MM:SS
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    const hora = `${hours}:${minutes}:${seconds}`;
    
    return { fecha, hora };
  }

  /**
   * Prueba la conexión e imprime un recibo de prueba
   */
  async printTest() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      await this.sendCommand(this.commands.INIT);
      await this.sendCommand(this.commands.ALIGN_CENTER);
      await this.sendCommand(this.commands.BOLD_ON);
      await this.printText('PRUEBA DE IMPRESION\n');
      await this.sendCommand(this.commands.BOLD_OFF);
      await this.printText('================================\n');
      await this.printText('EL FOGON DE DON SOTO\n');
      
      const now = new Date();
      const fecha = now.toLocaleDateString('es-PE');
      const hora = now.toLocaleTimeString('es-PE');
      await this.printText(`${fecha} ${hora}\n`);
      
      await this.printText('================================\n');
      await this.printText('Impresora conectada\n');
      await this.printText('correctamente\n\n\n');
      
      await this.sendCommand(this.commands.CUT_PAPER);
      
      return true;
    } catch (error) {
      throw error;
    }
  }
}

// Instancia singleton
const bluetoothPrinter = new BluetoothPrinterService();

// Función para escanear dispositivos (disponible en consola del navegador)
if (typeof window !== 'undefined') {
  window.scanBluetoothPrinter = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: bluetoothPrinter.config.serviceUUIDs
      });

      
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
          }
        } catch (error) {
        }
      }
      
      device.gatt.disconnect();
      return { device: device.name, services: services.map(s => s.uuid) };
    } catch (error) {
    }
  };
}

export default bluetoothPrinter;