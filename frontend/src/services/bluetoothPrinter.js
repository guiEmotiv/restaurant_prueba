/**
 * Servicio de impresión Bluetooth para comprobantes de pago
 * Configurado para HOIN POS-58 con PIN: 1234, MAC: 66:32:35:92:92:26
 * Soporta Web Bluetooth API y QZ Tray con renderizado raster UTF-8
 */

class BluetoothPrinterService {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.isConnected = false;
    
    // QZ Tray configuration
    this.qzReady = false;
    this.selectedPrinter = null;
    
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
        beeper: true,
        utf8Native: false // requiere renderizado raster
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

  /**
   * Conecta con la impresora Bluetooth
   */
  async connect() {
    if (!this.isBluetoothSupported()) {
      throw new Error('Web Bluetooth no está soportado en este navegador');
    }

    try {
      console.log('Buscando impresora Bluetooth...');
      
      // Solicitar dispositivo Bluetooth con todos los UUIDs posibles
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.config.serviceUUIDs
      });

      console.log('Dispositivo encontrado:', this.device.name);

      // Conectar al servidor GATT
      this.server = await this.device.gatt.connect();
      console.log('Conectado al servidor GATT');

      // Intentar conectar con diferentes UUIDs de servicio
      let serviceFound = false;
      for (const serviceUUID of this.config.serviceUUIDs) {
        try {
          this.service = await this.server.getPrimaryService(serviceUUID);
          console.log('Servicio obtenido con UUID:', serviceUUID);
          serviceFound = true;
          break;
        } catch (error) {
          console.log('UUID de servicio no disponible:', serviceUUID);
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
          console.log('Característica obtenida con UUID:', charUUID);
          characteristicFound = true;
          break;
        } catch (error) {
          console.log('UUID de característica no disponible:', charUUID);
          continue;
        }
      }

      if (!characteristicFound) {
        throw new Error('No se pudo encontrar una característica compatible en la impresora');
      }

      this.isConnected = true;
      console.log('Impresora conectada exitosamente');

      return true;
    } catch (error) {
      console.error('Error conectando a la impresora:', error);
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
    console.log('Impresora desconectada');
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
      console.error('Error enviando comando:', error);
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

      // Header centrado (con caracteres especiales)
      await this.sendCommand(this.commands.ALIGN_CENTER);
      await this.sendCommand(this.commands.BOLD_ON);
      await this.printText('EL FOGÓN DE DON SOTO\n');
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

      // Separador (igual que web)
      await this.printText('-------------------------------------\n');

      // Items con cálculo correcto del total
      let itemsTotal = 0;
      if (paymentData.order.items && paymentData.order.items.length > 0) {
        for (const item of paymentData.order.items) {
          const itemName = item.recipe_name || 'Item';
          const quantity = item.quantity || 1;
          const itemPrice = parseFloat(item.total_price || 0);
          itemsTotal += itemPrice;
          const price = this.formatPrice(itemPrice); // Sin símbolo S/
          
          // Formato: "2x Nombre del Plato              15.00" (sin S/)
          const itemLine = `${quantity}x ${itemName}`;
          const spaces = Math.max(1, 37 - itemLine.length - price.length);
          await this.printText(`${itemLine}${' '.repeat(spaces)}${price}\n`);
          
          if (item.is_takeaway) {
            await this.printText(`  Para llevar\n`);
          }
        }
      }

      // Separador antes del total
      await this.printText('-------------------------------------\n');

      // Total alineado con los precios (derecha como los items)
      const displayTotal = this.formatCurrency(itemsTotal || paymentData.amount || paymentData.order.total_amount || 0);
      const totalLine = 'TOTAL:';
      const totalSpaces = Math.max(1, 37 - totalLine.length - displayTotal.length);
      await this.sendCommand(this.commands.BOLD_ON);
      await this.printText(`${totalLine}${' '.repeat(totalSpaces)}${displayTotal}\n`);
      await this.sendCommand(this.commands.BOLD_OFF);

      // Separador final
      await this.printText('-------------------------------------\n');

      // Footer centrado (con signo de admiración inicial)
      await this.sendCommand(this.commands.ALIGN_CENTER);
      await this.printText('¡Gracias por su visita!\n');

      // Espaciado suficiente antes del corte para evitar corte del texto
      await this.printText('\n\n\n\n');
      await this.sendCommand(this.commands.CUT_PAPER);

      console.log('Comprobante impreso exitosamente');
      return true;

    } catch (error) {
      console.error('Error imprimiendo comprobante:', error);
      throw error;
    }
  }

  /**
   * Imprime comprobante de pago dividido
   */
  async printSplitPaymentReceipt(order, splitPayments) {
    try {
      for (let i = 0; i < splitPayments.length; i++) {
        const split = splitPayments[i];
        
        if (!this.isConnected) {
          await this.connect();
        }

        // Encabezado
        await this.sendCommand(this.commands.INIT);
        await this.sendCommand(this.commands.FONT_A);
        await this.sendCommand(this.commands.ALIGN_CENTER);
        await this.sendCommand(this.commands.BOLD_ON);
        await this.printText('EL FOGON DE DON SOTO\n');
        await this.sendCommand(this.commands.BOLD_OFF);
        await this.printText('=====================================\n');
        await this.printText(`COMPROBANTE DE PAGO ${i + 1}/${splitPayments.length}\n`);
        await this.printText('(CUENTA DIVIDIDA)\n');
        await this.printText('=====================================\n\n');

        // Información de la orden
        await this.sendCommand(this.commands.ALIGN_LEFT);
        await this.printText(`Orden: #${order.id}\n`);
        await this.printText(`Mesa: ${order.table_number}\n`);
        
        const now = new Date();
        const fecha = now.toLocaleDateString('es-PE');
        const hora = now.toLocaleTimeString('es-PE');
        await this.printText(`Fecha: ${fecha}\n`);
        await this.printText(`Hora: ${hora}\n\n`);

        // Items de este pago
        await this.printText('-------------------------------------\n');
        await this.sendCommand(this.commands.BOLD_ON);
        await this.printText('ITEMS DE ESTE PAGO\n');
        await this.sendCommand(this.commands.BOLD_OFF);
        await this.printText('-------------------------------------\n');

        if (split.items && split.items.length > 0) {
          for (const item of split.items) {
            const itemName = item.recipe_name || 'Item';
            const price = this.formatCurrency(item.total_price || 0);
            
            await this.printText(`${itemName}\n`);
            await this.printText(`1x              ${price}\n\n`);
          }
        }

        // Total de este pago
        await this.printText('=====================================\n');
        await this.sendCommand(this.commands.BOLD_ON);
        const total = this.formatCurrency(split.amount || 0);
        await this.printText(`TOTAL A PAGAR:          ${total}\n`);
        await this.sendCommand(this.commands.BOLD_OFF);
        await this.printText('=====================================\n\n');

        // Método de pago
        await this.printText('METODO DE PAGO\n');
        await this.printText('-------------------------------------\n');
        const metodoPago = this.getPaymentMethodName(split.payment_method);
        await this.sendCommand(this.commands.BOLD_ON);
        await this.printText(`${metodoPago}: ${total}\n`);
        await this.sendCommand(this.commands.BOLD_OFF);

        if (split.notes) {
          await this.printText(`Notas: ${split.notes}\n`);
        }

        // Pie del comprobante
        await this.sendCommand(this.commands.ALIGN_CENTER);
        await this.printText('\n=====================================\n');
        await this.printText('¡GRACIAS POR SU VISITA!\n');
        await this.printText('Vuelva pronto\n');
        await this.printText('=====================================\n\n');

        // Saltos y corte
        await this.printText('\n\n\n');
        await this.sendCommand(this.commands.CUT_PAPER);

        // Pausa entre impresiones si hay múltiples
        if (i < splitPayments.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`${splitPayments.length} comprobantes de pago dividido impresos`);
      return true;

    } catch (error) {
      console.error('Error imprimiendo comprobantes divididos:', error);
      throw error;
    }
  }

  /**
   * Formatea cantidad como moneda peruana sin caracteres especiales
   */
  formatCurrency(amount) {
    const value = parseFloat(amount) || 0;
    // Usar S/ en lugar del símbolo PEN que puede causar problemas en la impresora
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
   * Formatea fecha y hora sin caracteres especiales problemáticos
   */
  formatDateTime(date) {
    const d = new Date(date);
    
    // Formatear fecha como DD/MM/YYYY
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const fecha = `${day}/${month}/${year}`;
    
    // Formatear hora como HH:MM:SS sin caracteres especiales
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    const hora = `${hours}:${minutes}:${seconds}`;
    
    return { fecha, hora };
  }

  /**
   * Obtiene el nombre del método de pago
   */
  getPaymentMethodName(method) {
    const methods = {
      'CASH': 'EFECTIVO',
      'CARD': 'TARJETA',
      'TRANSFER': 'TRANSFERENCIA',
      'YAPE_PLIN': 'YAPE/PLIN',
      'OTHER': 'OTRO'
    };
    return methods[method] || method;
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
      await this.printText('===================\n');
      await this.printText('EL FOGON DE DON SOTO\n');
      
      const now = new Date();
      const fecha = now.toLocaleDateString('es-PE');
      const hora = now.toLocaleTimeString('es-PE');
      await this.printText(`${fecha} ${hora}\n`);
      
      await this.printText('===================\n');
      await this.printText('Impresora conectada\n');
      await this.printText('correctamente\n\n\n');
      
      await this.sendCommand(this.commands.CUT_PAPER);
      
      console.log('Prueba de impresión completada');
      return true;
    } catch (error) {
      console.error('Error en prueba de impresión:', error);
      throw error;
    }
  }

  // ============================================
  // QZ TRAY METHODS - UTF-8 RASTER PRINTING
  // ============================================

  /**
   * Inicializa y verifica QZ Tray
   */
  async ensureQZ() {
    try {
      // Verificar si QZ está disponible
      if (typeof qz === 'undefined') {
        throw new Error('QZ Tray no está disponible. Instale QZ Tray y cargue qz-tray.js');
      }

      if (!qz.websocket.isActive()) {
        console.log('🔌 Conectando con QZ Tray...');
        
        // Configurar certificado inseguro para desarrollo
        qz.security.setCertificatePromise(() => {
          return Promise.resolve("-----BEGIN CERTIFICATE-----\n" +
            "MIIEWzCCA0OgAwIBAgIJALdZbJ8JbTuJMA0GCSqGSIb3DQEBCwUAMIGBMQswCQYD\n" +
            // ... resto del certificado de desarrollo
            "-----END CERTIFICATE-----");
        });

        await qz.websocket.connect();
        console.log('✅ QZ Tray conectado');
      }

      this.qzReady = true;
      return true;
    } catch (error) {
      console.error('❌ Error inicializando QZ Tray:', error);
      throw error;
    }
  }

  /**
   * Busca la impresora Bluetooth por nombre y MAC
   */
  async findBluetoothPrinter() {
    try {
      if (!this.qzReady) {
        await this.ensureQZ();
      }

      console.log('🔍 Buscando impresora Bluetooth...');
      const printers = await qz.printers.find();
      console.log('📋 Impresoras disponibles:', printers);

      // Buscar por nombre exacto
      let printer = printers.find(p => 
        p.name === this.config.deviceName || 
        p.name.includes('Bluetooth') ||
        p.name.includes(this.config.deviceName)
      );

      if (!printer) {
        // Si no encuentra por nombre, permitir selección manual
        console.log('⚠️ Impresora no encontrada automáticamente');
        printer = await this.selectPrinterDialog();
      }

      if (printer) {
        this.selectedPrinter = printer;
        console.log(`✅ Impresora seleccionada: ${printer.name}`);
        return printer;
      } else {
        throw new Error(`Impresora "${this.config.deviceName}" no encontrada. Verifique que esté emparejada y conectada.`);
      }
    } catch (error) {
      console.error('❌ Error buscando impresora:', error);
      throw error;
    }
  }

  /**
   * Muestra diálogo de selección de impresora
   */
  async selectPrinterDialog() {
    try {
      const printers = await qz.printers.find();
      const printerNames = printers.map(p => p.name);
      
      // Simple prompt para selección (en producción usar un modal)
      const selectedName = prompt(
        `Seleccione impresora:\n${printerNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}\n\nIngrese el número:`
      );
      
      if (selectedName && !isNaN(selectedName)) {
        const index = parseInt(selectedName) - 1;
        if (index >= 0 && index < printers.length) {
          return printers[index];
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error en diálogo de selección:', error);
      return null;
    }
  }

  /**
   * Renderiza ticket a canvas y convierte a imagen raster
   */
  async renderTicketToCanvas(ticketData, options = {}) {
    const opts = {
      widthPx: this.config.printableWidth,
      fontFamily: 'DejaVu Sans Mono, Noto Sans Mono, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.4,
      padding: 8,
      ...options
    };

    try {
      // Crear canvas temporal
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = opts.widthPx;

      // Configurar fuente para soporte UTF-8
      ctx.font = `${opts.fontSize}px ${opts.fontFamily}`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Calcular altura dinámica basada en contenido
      const lines = this.prepareTicketLines(ticketData, opts);
      const totalHeight = (lines.length * opts.fontSize * opts.lineHeight) + (opts.padding * 2);
      canvas.height = Math.max(totalHeight, 100);

      // Fondo blanco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';

      // Renderizar líneas
      let y = opts.padding;
      lines.forEach(line => {
        if (line.align === 'center') {
          ctx.textAlign = 'center';
          ctx.fillText(line.text, canvas.width / 2, y);
        } else if (line.align === 'right') {
          ctx.textAlign = 'right';
          ctx.fillText(line.text, canvas.width - opts.padding, y);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(line.text, opts.padding, y);
        }

        if (line.bold) {
          // Simular negrita con doble renderizado
          ctx.fillText(line.text, opts.padding + 0.5, y);
        }

        y += opts.fontSize * opts.lineHeight;
      });

      // Convertir a PNG monocromo con dithering
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const ditheredData = this.applyFloydSteinbergDithering(imageData);
      
      ctx.putImageData(ditheredData, 0, 0);
      
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('❌ Error renderizando ticket:', error);
      throw error;
    }
  }

  /**
   * Prepara las líneas del ticket basado en nuestro formato actual
   */
  prepareTicketLines(ticketData, opts) {
    const lines = [];
    const { order, payment } = ticketData;

    // Header
    lines.push({ text: 'EL FOGÓN DE DON SOTO', align: 'center', bold: true });
    lines.push({ text: 'COMPROBANTE', align: 'center', bold: false });
    lines.push({ text: '', align: 'left', bold: false }); // Espacio

    // Info básica
    lines.push({ text: `Orden:               #${order.id}`, align: 'left', bold: false });
    lines.push({ text: `Mesa:                ${order.table_number}`, align: 'left', bold: false });
    
    if (order.waiter) {
      lines.push({ text: `Mesero:              ${order.waiter}`, align: 'left', bold: false });
    }
    
    const paymentDate = payment.created_at || order.created_at || new Date().toISOString();
    const date = new Date(paymentDate);
    const { fecha, hora } = this.formatDateTime(date);
    lines.push({ text: `Fecha:               ${fecha}`, align: 'left', bold: false });
    lines.push({ text: `Hora:                ${hora}`, align: 'left', bold: false });

    // Separador
    lines.push({ text: '-------------------------------------', align: 'left', bold: false });

    // Items
    if (order.items && order.items.length > 0) {
      order.items.forEach(item => {
        const itemName = item.recipe_name || 'Item';
        const quantity = item.quantity || 1;
        const price = this.formatPrice(item.total_price || 0);
        
        // Formato: "2x Nombre del Plato              15.00"
        const itemLine = `${quantity}x ${itemName}`;
        const spaces = Math.max(1, 37 - itemLine.length - price.length);
        lines.push({ 
          text: `${itemLine}${' '.repeat(spaces)}${price}`, 
          align: 'left', 
          bold: false 
        });
        
        if (item.is_takeaway) {
          lines.push({ text: '  Para llevar', align: 'left', bold: false });
        }
      });
    }

    // Total
    lines.push({ text: '-------------------------------------', align: 'left', bold: false });
    
    const itemsTotal = order.items?.reduce((total, item) => {
      return total + parseFloat(item.total_price || 0);
    }, 0) || 0;
    
    const displayTotal = this.formatCurrency(itemsTotal || payment.amount || order.total_amount || 0);
    const totalLine = 'TOTAL:';
    const totalSpaces = Math.max(1, 37 - totalLine.length - displayTotal.length);
    lines.push({ 
      text: `${totalLine}${' '.repeat(totalSpaces)}${displayTotal}`, 
      align: 'left', 
      bold: true 
    });

    // Footer
    lines.push({ text: '-------------------------------------', align: 'left', bold: false });
    lines.push({ text: '¡Gracias por su visita!', align: 'center', bold: false });

    return lines;
  }

  /**
   * Aplica dithering Floyd-Steinberg para mejorar calidad B/W
   */
  applyFloydSteinbergDithering(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const gray = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
        
        const newGray = gray > 128 ? 255 : 0;
        const error = gray - newGray;
        
        data[idx] = data[idx + 1] = data[idx + 2] = newGray;
        
        // Distribuir error Floyd-Steinberg
        if (x + 1 < width) {
          const rightIdx = (y * width + x + 1) * 4;
          data[rightIdx] = Math.max(0, Math.min(255, data[rightIdx] + error * 7 / 16));
        }
        if (y + 1 < height && x - 1 >= 0) {
          const bottomLeftIdx = ((y + 1) * width + x - 1) * 4;
          data[bottomLeftIdx] = Math.max(0, Math.min(255, data[bottomLeftIdx] + error * 3 / 16));
        }
        if (y + 1 < height) {
          const bottomIdx = ((y + 1) * width + x) * 4;
          data[bottomIdx] = Math.max(0, Math.min(255, data[bottomIdx] + error * 5 / 16));
        }
        if (y + 1 < height && x + 1 < width) {
          const bottomRightIdx = ((y + 1) * width + x + 1) * 4;
          data[bottomRightIdx] = Math.max(0, Math.min(255, data[bottomRightIdx] + error * 1 / 16));
        }
      }
    }

    return imageData;
  }

  /**
   * Imprime imagen raster usando QZ Tray
   */
  async printRasterWithQZ(imageDataUrl, options = {}) {
    try {
      if (!this.qzReady) {
        await this.ensureQZ();
      }

      if (!this.selectedPrinter) {
        await this.findBluetoothPrinter();
      }

      const opts = {
        cut: this.config.features.autoCut,
        beep: this.config.features.beeper,
        ...options
      };

      console.log('🖨️ Enviando imagen a impresora...');

      const config = qz.configs.create(this.selectedPrinter.name);
      const data = [];

      // Inicializar impresora
      data.push({ type: 'raw', format: 'command', data: '\x1B\x40' }); // ESC @

      // Imagen raster
      data.push({
        type: 'image',
        format: 'png',
        data: imageDataUrl,
        options: {
          language: 'ESCPOS',
          legacy: false
        }
      });

      // Beep si está habilitado
      if (opts.beep) {
        data.push({ type: 'raw', format: 'command', data: '\x1B\x42\x05\x05' }); // ESC B
      }

      // Saltos de línea y corte
      data.push({ type: 'raw', format: 'command', data: '\n\n\n\n' });
      
      if (opts.cut) {
        data.push({ type: 'raw', format: 'command', data: '\x1D\x56\x00' }); // GS V
      }

      await qz.print(config, data);
      console.log('✅ Impresión enviada correctamente');
      return true;

    } catch (error) {
      console.error('❌ Error imprimiendo con QZ Tray:', error);
      throw error;
    }
  }

  /**
   * Método principal para imprimir con QZ Tray (mantiene compatibilidad con interfaz actual)
   */
  async printPaymentReceiptQZ(paymentData) {
    try {
      console.log('🎫 Iniciando impresión QZ Tray con soporte UTF-8...');
      
      // Renderizar ticket a imagen
      const imageDataUrl = await this.renderTicketToCanvas(paymentData);
      
      // Imprimir imagen raster
      await this.printRasterWithQZ(imageDataUrl);
      
      console.log('✅ Ticket impreso exitosamente con caracteres especiales');
      return true;
    } catch (error) {
      console.error('❌ Error en impresión QZ Tray:', error);
      throw error;
    }
  }

  /**
   * Test de impresión QZ Tray
   */
  async printTestQZ() {
    try {
      const testData = {
        order: {
          id: '999',
          table_number: 'TEST',
          waiter: 'Usuario Test',
          items: [
            {
              recipe_name: 'Test con ÑOÑO y FOGÓN',
              quantity: 1,
              total_price: 10.50
            }
          ]
        },
        payment: {
          amount: 10.50,
          created_at: new Date().toISOString()
        }
      };

      await this.printPaymentReceiptQZ(testData);
      console.log('✅ Test de impresión QZ completado');
      return true;
    } catch (error) {
      console.error('❌ Error en test QZ:', error);
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

      console.log('📱 Dispositivo:', device.name || 'Sin nombre');
      
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      
      console.log('🔍 Servicios encontrados:');
      for (const service of services) {
        console.log(`  📦 ${service.uuid}`);
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            console.log(`    • ${char.uuid} - Propiedades:`, {
              read: char.properties.read,
              write: char.properties.write,
              writeWithoutResponse: char.properties.writeWithoutResponse
            });
          }
        } catch (error) {
          console.log(`    ⚠️ Error obteniendo características`);
        }
      }
      
      device.gatt.disconnect();
      return { device: device.name, services: services.map(s => s.uuid) };
    } catch (error) {
      console.error('❌ Error:', error);
    }
  };
}

export default bluetoothPrinter;