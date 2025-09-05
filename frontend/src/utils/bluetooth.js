/**
 * Bluetooth Printing Utilities
 * Para impresoras térmicas con soporte Web Bluetooth API
 */

class BluetoothPrinter {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.isConnected = false;
  }

  /**
   * Conectar a impresora Bluetooth
   */
  async connect() {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API no está soportada en este navegador');
      }

      
      // Solicitar dispositivo Bluetooth (impresora térmica)
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // Service UUID común para impresoras
      });


      // Conectar al servidor GATT
      this.server = await this.device.gatt.connect();

      // Obtener servicio de impresión
      this.service = await this.server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');

      // Obtener característica de escritura
      this.characteristic = await this.service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

      this.isConnected = true;
      return true;

    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Desconectar impresora
   */
  async disconnect() {
    try {
      if (this.device && this.device.gatt.connected) {
        await this.device.gatt.disconnect();
      }
      this.isConnected = false;
    } catch (error) {
      // Error al desconectar
    }
  }

  /**
   * Enviar datos a la impresora
   */
  async sendData(data) {
    if (!this.isConnected || !this.characteristic) {
      throw new Error('Impresora no conectada');
    }

    try {
      const encoder = new TextEncoder();
      const dataArray = encoder.encode(data);
      
      // Dividir en chunks de máximo 20 bytes (limitación Bluetooth LE)
      const chunkSize = 20;
      for (let i = 0; i < dataArray.length; i += chunkSize) {
        const chunk = dataArray.slice(i, i + chunkSize);
        await this.characteristic.writeValue(chunk);
        // Pequeña pausa entre chunks
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Comandos ESC/POS básicos
   */
  getCommands() {
    return {
      INIT: '\x1B\x40',           // Inicializar impresora
      FEED_LINE: '\x0A',          // Avance de línea
      CUT_PAPER: '\x1D\x56\x00',  // Cortar papel
      BOLD_ON: '\x1B\x45\x01',    // Texto en negrita
      BOLD_OFF: '\x1B\x45\x00',   // Desactivar negrita
      CENTER: '\x1B\x61\x01',     // Centrar texto
      LEFT: '\x1B\x61\x00',       // Alinear izquierda
      RIGHT: '\x1B\x61\x02',      // Alinear derecha
      SIZE_NORMAL: '\x1D\x21\x00', // Tamaño normal
      SIZE_DOUBLE: '\x1D\x21\x11', // Tamaño doble
    };
  }

  /**
   * Generar recibo de orden (actualizado para pagos parciales)
   */
  generateOrderReceipt(orderData) {
    const cmd = this.getCommands();
    let receipt = '';

    // Inicializar
    receipt += cmd.INIT;
    
    // Header del restaurante
    receipt += cmd.CENTER + cmd.SIZE_DOUBLE + cmd.BOLD_ON;
    receipt += 'RESTAURANT WEB\n';
    receipt += cmd.SIZE_NORMAL + cmd.BOLD_OFF;
    
    // Tipo de comprobante
    if (orderData.is_partial) {
      receipt += cmd.BOLD_ON + 'COMPROBANTE DE PAGO PARCIAL\n' + cmd.BOLD_OFF;
    } else {
      receipt += 'COMPROBANTE DE ORDEN\n';
    }
    receipt += cmd.FEED_LINE;

    // Información de la orden
    receipt += cmd.LEFT;
    receipt += `Fecha: ${new Date().toLocaleString('es-PE')}\n`;
    receipt += `Orden: #${orderData.id}\n`;
    receipt += `Mesa: ${orderData.table_name || orderData.table}\n`;
    
    if (orderData.customer_name) {
      receipt += `Cliente: ${orderData.customer_name}\n`;
    }
    
    if (orderData.party_size) {
      receipt += `Personas: ${orderData.party_size}\n`;
    }

    // Información del pago
    if (orderData.payment_method) {
      const methodNames = {
        efectivo: 'EFECTIVO',
        tarjeta: 'TARJETA',
        yape: 'YAPE',
        plin: 'PLIN',
        transferencia: 'TRANSFERENCIA'
      };
      receipt += `Método: ${methodNames[orderData.payment_method] || orderData.payment_method.toUpperCase()}\n`;
    }
    
    receipt += cmd.FEED_LINE;

    // Separator
    receipt += '================================\n';
    receipt += cmd.BOLD_ON + 'ITEMS' + cmd.BOLD_OFF + '\n';
    receipt += '================================\n';

    // Items del pedido
    let total = 0;
    if (orderData.items && orderData.items.length > 0) {
      orderData.items.forEach(item => {
        const itemTotal = parseFloat(item.total_with_container || item.total_price || 0);
        total += itemTotal;
        
        receipt += `${item.recipe_name}\n`;
        receipt += `  x${item.quantity}`;
        receipt += cmd.RIGHT + `S/ ${itemTotal.toFixed(2)}\n`;
        receipt += cmd.LEFT;
        
        if (item.notes) {
          receipt += `  Nota: ${item.notes}\n`;
        }
        
        if (item.is_takeaway) {
          receipt += `  PARA LLEVAR\n`;
        }
        
        receipt += '\n';
      });
    }

    // Total
    receipt += '================================\n';
    receipt += cmd.BOLD_ON + cmd.SIZE_DOUBLE;
    
    if (orderData.is_partial && orderData.payment_amount) {
      receipt += cmd.RIGHT + `PAGADO: S/ ${parseFloat(orderData.payment_amount).toFixed(2)}\n`;
      receipt += cmd.SIZE_NORMAL + cmd.BOLD_OFF;
      receipt += cmd.RIGHT + `Subtotal items: S/ ${total.toFixed(2)}\n`;
    } else {
      receipt += cmd.RIGHT + `TOTAL: S/ ${total.toFixed(2)}\n`;
    }
    
    receipt += cmd.SIZE_NORMAL + cmd.BOLD_OFF + cmd.LEFT;
    receipt += '================================\n';
    receipt += cmd.FEED_LINE;

    // Footer
    receipt += cmd.CENTER;
    receipt += 'Gracias por su visita!\n';
    receipt += 'Vuelva pronto\n';
    receipt += cmd.FEED_LINE + cmd.FEED_LINE;

    // Cortar papel
    receipt += cmd.CUT_PAPER;

    return receipt;
  }

  /**
   * Imprimir recibo de orden
   */
  async printOrderReceipt(orderData) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const receipt = this.generateOrderReceipt(orderData);
      await this.sendData(receipt);
      
      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Verificar si el navegador soporta Bluetooth
   */
  static isBluetoothSupported() {
    return 'bluetooth' in navigator;
  }
}

// Instancia singleton
let printerInstance = null;

export const bluetoothPrinter = {
  getInstance() {
    if (!printerInstance) {
      printerInstance = new BluetoothPrinter();
    }
    return printerInstance;
  },

  async connect() {
    const printer = this.getInstance();
    return await printer.connect();
  },

  async disconnect() {
    const printer = this.getInstance();
    return await printer.disconnect();
  },

  async printOrder(orderData) {
    const printer = this.getInstance();
    return await printer.printOrderReceipt(orderData);
  },

  isConnected() {
    const printer = this.getInstance();
    return printer.isConnected;
  },

  isSupported() {
    return BluetoothPrinter.isBluetoothSupported();
  }
};

export default bluetoothPrinter;