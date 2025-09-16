// Bluetooth Printer Utility for Restaurant Management
// This module provides Bluetooth connectivity for thermal printers

class BluetoothPrinter {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.isConnected = false;
  }

  // Check if browser supports Bluetooth
  static isBluetoothSupported() {
    const supported = 'bluetooth' in navigator && navigator.bluetooth !== undefined;
    console.log('🔍 isBluetoothSupported check:', {
      hasProperty: 'bluetooth' in navigator,
      bluetoothObject: navigator.bluetooth,
      supported,
      userAgent: navigator.userAgent.substring(0, 60)
    });
    return supported;
  }

  // Connect to Bluetooth printer
  async connect() {
    try {
      // 🔍 DEBUGGING: Log detailed browser info
      console.log('🔍 BLUETOOTH DEBUG - Browser Info:', {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        onLine: navigator.onLine,
        cookieEnabled: navigator.cookieEnabled
      });

      console.log('🔍 BLUETOOTH DEBUG - Navigator Properties:', {
        hasBluetoothProperty: 'bluetooth' in navigator,
        bluetoothValue: navigator.bluetooth,
        bluetoothType: typeof navigator.bluetooth,
        isNull: navigator.bluetooth === null,
        isUndefined: navigator.bluetooth === undefined
      });

      console.log('🔍 BLUETOOTH DEBUG - Location Info:', {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        origin: window.location.origin,
        isSecureContext: window.isSecureContext
      });

      if (!navigator.bluetooth) {
        console.error('❌ navigator.bluetooth is:', navigator.bluetooth);
        throw new Error(`Bluetooth no está soportado en este navegador. User Agent: ${navigator.userAgent.substring(0, 100)}...`);
      }

      console.log('✅ navigator.bluetooth exists, attempting to connect...');

      // Request any Bluetooth device - let user choose printer manually
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
          '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
          '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (most common)
          '000018f0-0000-1000-8000-00805f9b34fb', // Generic printer service
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Custom printer service
          '0000180f-0000-1000-8000-00805f9b34fb'  // Battery service
        ]
      });

      // Connect to GATT server
      this.server = await this.device.gatt.connect();
      
      // Get the printer service
      this.service = await this.server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      
      // Get the characteristic for writing
      this.characteristic = await this.service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      
      this.isConnected = true;
      return { success: true, message: 'Conectado a la impresora Bluetooth' };
      
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Error conectando a impresora: ${error.message}`);
    }
  }

  // Disconnect from printer
  async disconnect() {
    try {
      if (this.device && this.device.gatt.connected) {
        await this.device.gatt.disconnect();
      }
      this.isConnected = false;
      return { success: true, message: 'Desconectado de la impresora' };
    } catch (error) {
      throw new Error(`Error desconectando: ${error.message}`);
    }
  }

  // Print order receipt
  async printOrderReceipt(orderData) {
    try {
      if (!this.isConnected || !this.characteristic) {
        throw new Error('No hay conexión con la impresora');
      }

      // Generate receipt content
      const receiptText = this.generateReceiptText(orderData);
      
      // Convert to bytes for thermal printer
      const bytes = this.textToBytes(receiptText);
      
      // Send data to printer in chunks
      const chunkSize = 20; // Bluetooth LE characteristic limit
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        await this.characteristic.writeValue(new Uint8Array(chunk));
        await this.delay(50); // Small delay between chunks
      }

      return { success: true, message: 'Recibo impreso correctamente' };
      
    } catch (error) {
      throw new Error(`Error imprimiendo: ${error.message}`);
    }
  }

  // Generate receipt text content
  generateReceiptText(orderData) {
    const width = 48; // Full width for thermal printer
    const line = '-'.repeat(width);
    const doubleLine = '='.repeat(width);
    
    let receipt = '\n';
    
    // Header
    receipt += this.centerText('EL FOGON DE DON SOTO', width) + '\n';
    receipt += this.centerText('RECIBO DE VENTA', width) + '\n';
    receipt += doubleLine + '\n';
    
    // Order info
    receipt += `Mesa: ${orderData.table_name || orderData.table}\n`;
    receipt += `Cliente: ${orderData.customer_name || 'Cliente'}\n`;
    receipt += `Pedido #: ${orderData.id}\n`;
    receipt += `Fecha: ${this.formatDate()}\n`;
    receipt += line + '\n';
    
    // Items header with column alignment
    receipt += this.formatColumns('ITEMS', '', '', width) + '\n';
    receipt += line + '\n';
    
    let total = 0;
    if (orderData.items && orderData.items.length > 0) {
      orderData.items.forEach(item => {
        const itemName = item.recipe_name || item.recipe?.name || 'Item';
        const itemPrice = parseFloat(item.total_with_container || item.total_price || 0);
        const quantity = item.quantity || 1;
        
        // Format line with quantity, item name, and price aligned
        const qtyText = `${quantity}x`;
        const priceText = `S/ ${itemPrice.toFixed(2)}`;
        const maxItemNameLength = width - qtyText.length - priceText.length - 2; // 2 spaces
        const truncatedName = itemName.length > maxItemNameLength ? 
          itemName.substring(0, maxItemNameLength - 3) + '...' : itemName;
        
        receipt += this.formatColumns(qtyText, truncatedName, priceText, width) + '\n';
        
        total += itemPrice;
      });
    }
    
    receipt += line + '\n';
    
    // Total
    receipt += this.rightAlign(`TOTAL: S/ ${total.toFixed(2)}`, width) + '\n';
    receipt += doubleLine + '\n';
    
    // Payment info
    if (orderData.payment_method) {
      receipt += `Método de pago: ${orderData.payment_method}\n`;
    }
    if (orderData.payment_amount) {
      receipt += `Monto pagado: S/ ${orderData.payment_amount.toFixed(2)}\n`;
    }
    if (orderData.is_partial) {
      receipt += '*** PAGO PARCIAL ***\n';
    }
    
    receipt += line + '\n';
    
    // Footer  
    receipt += this.centerText('Gracias por su preferencia!', width) + '\n';
    receipt += this.centerText('Vuelva pronto', width) + '\n';
    receipt += '\n\n';
    
    return receipt;
  }

  // Helper method to center text
  centerText(text, width) {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  // Helper method to right align text
  rightAlign(text, width) {
    const padding = Math.max(0, width - text.length);
    return ' '.repeat(padding) + text;
  }

  // Helper method to format columns (quantity, item, price)
  formatColumns(col1, col2, col3, width) {
    const col1Len = col1.length;
    const col3Len = col3.length;
    const col2MaxLen = width - col1Len - col3Len - 2; // 2 spaces between columns
    
    const col2Trimmed = col2.length > col2MaxLen ? 
      col2.substring(0, col2MaxLen) : col2.padEnd(col2MaxLen);
    
    return col1 + ' ' + col2Trimmed + ' ' + col3;
  }

  // Helper method to format date without special characters
  formatDate() {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  // Convert text to bytes for thermal printer
  textToBytes(text) {
    const bytes = [];
    
    // Initialize printer
    bytes.push(0x1B, 0x40); // ESC @ - Initialize printer
    
    // Set character encoding to CP437 (extended ASCII)
    bytes.push(0x1B, 0x74, 0x00);
    
    // Convert text to bytes
    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i);
      const code = char.charCodeAt(0);
      
      if (code <= 127) {
        bytes.push(code);
      } else {
        // Handle special characters
        switch (char) {
          case 'ñ': bytes.push(164); break;
          case 'Ñ': bytes.push(165); break;
          case 'á': bytes.push(160); break;
          case 'é': bytes.push(130); break;
          case 'í': bytes.push(161); break;
          case 'ó': bytes.push(162); break;
          case 'ú': bytes.push(163); break;
          case 'Á': bytes.push(181); break;
          case 'É': bytes.push(144); break;
          case 'Í': bytes.push(214); break;
          case 'Ó': bytes.push(224); break;
          case 'Ú': bytes.push(233); break;
          default: bytes.push(63); // ? for unknown chars
        }
      }
    }
    
    // Cut paper
    bytes.push(0x1D, 0x56, 0x42, 0x00); // GS V B 0 - Partial cut
    
    return bytes;
  }

  // Helper delay function
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Check if Bluetooth is supported
  static isBluetoothSupported() {
    return 'bluetooth' in navigator;
  }
}

// Singleton instance
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

  async printPaymentReceipt(receiptData) {
    const printer = this.getInstance();
    return await printer.printOrderReceipt(receiptData);
  },

  async printTest() {
    const printer = this.getInstance();
    const testData = {
      id: 'TEST',
      table_name: 'TEST',
      customer_name: 'Test Customer',
      items: [{ 
        recipe_name: 'Test Item', 
        quantity: 1, 
        total_price: 10.00 
      }],
      payment_method: 'TEST'
    };
    return await printer.printOrderReceipt(testData);
  },

  get isConnected() {
    const printer = this.getInstance();
    return printer.isConnected;
  },

  isSupported() {
    return BluetoothPrinter.isBluetoothSupported();
  },

  isBluetoothSupported() {
    return BluetoothPrinter.isBluetoothSupported();
  },

  getBluetoothErrorMessage() {
    if (!this.isBluetoothSupported()) {
      return 'Bluetooth no está disponible en este navegador';
    }
    return 'Error de conexión Bluetooth';
  }
};

export default bluetoothPrinter;