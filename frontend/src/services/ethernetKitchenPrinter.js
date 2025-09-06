/**
 * Servicio de impresión Ethernet ESC/POS para etiquetas de cocina
 * Compatible con impresora DMN-C-E-R03523 (IP: 192.168.1.23)
 * Envía comandos ESC/POS via HTTP POST al backend que los retransmite via TCP/IP
 */

import api from './api.js';

class EthernetKitchenPrinter {
  constructor() {
    this.config = {
      // Configuración de red de la impresora (puede ser modificada dinámicamente)
      ip: localStorage.getItem('printer_ip') || '192.168.1.23',
      port: parseInt(localStorage.getItem('printer_port')) || 9100, // Puerto estándar ESC/POS TCP/IP
      macAddress: 'E8:48:16:08:2C:25',
      gateway: '192.168.1.1',
      subnet: '255.255.255.0',
      dhcp: false, // IP estática
      
      // Características del modelo DMN-C-E-R03523
      model: 'DMN-C-E-R03523',
      printSpeed: 300, // mm/s (70-80 líneas por segundo)
      paperWidth: 80, // mm (3 pulgadas)
      printableWidth: 576, // px para 80mm
      interfaces: ['USB', 'Ethernet'],
      
      // Características adicionales
      features: {
        autoCut: true,
        beeper: true, // Con cada impresión
        density: 2, // Nivel 2 (ajustable)
        chineseMode: false,
        currentFont: 'Font A', // Fuente ESC/POS normal
        codePage: 'Page 0', // OEM437 - Europa estándar
      },
      
      // Códigos de barras soportados
      barcodeSupport: [
        'UPC-A', 'UPC-E', 'JAN13', 'EAN13', 'JAN8', 'EAN8',
        'CODE39', 'ITF', 'CODE93', 'CODE128', 'CODABAR', 'QR'
      ],
      
      // Conjuntos de caracteres soportados
      characterSets: [
        'Simplified Chinese (GB18030)',
        'Alfanumérico básico',
        'OEM437', 'OEM850', 'OEM860', 'OEM863', 'OEM865'
      ]
    };
    
    // Comandos ESC/POS idénticos al servicio Bluetooth para mantener formato
    this.commands = {
      INIT: [0x1B, 0x40],                    // Inicializar impresora
      RESET: [0x1B, 0x40],                   // Reset
      LF: [0x0A],                            // Salto de línea
      CR: [0x0D],                            // Retorno de carro
      CUT_PAPER: [0x1D, 0x56, 0x42, 0x00],  // Corte completo
      PARTIAL_CUT: [0x1D, 0x56, 0x41],      // Corte parcial
      ALIGN_LEFT: [0x1B, 0x61, 0x00],       // Alinear izquierda
      ALIGN_CENTER: [0x1B, 0x61, 0x01],     // Alinear centro
      ALIGN_RIGHT: [0x1B, 0x61, 0x02],      // Alinear derecha
      BOLD_ON: [0x1B, 0x45, 0x01],          // Activar negrita
      BOLD_OFF: [0x1B, 0x45, 0x00],         // Desactivar negrita
      FONT_SIZE_NORMAL: [0x1D, 0x21, 0x00], // Tamaño normal
      FONT_SIZE_DOUBLE_HEIGHT: [0x1D, 0x21, 0x10], // Doble altura
      FONT_SIZE_DOUBLE_WIDTH: [0x1D, 0x21, 0x20],  // Doble ancho
      FONT_SIZE_DOUBLE: [0x1D, 0x21, 0x11], // Doble ancho y altura (2x2)
      FONT_SIZE_LARGE: [0x1D, 0x21, 0x22],  // Tamaño grande para headers
      FONT_A: [0x1B, 0x4D, 0x00],           // Fuente A (monospace, más legible)
      FONT_B: [0x1B, 0x4D, 0x01],           // Fuente B (pequeña monospace)
      UNDERLINE_ON: [0x1B, 0x2D, 0x01],     // Activar subrayado
      UNDERLINE_OFF: [0x1B, 0x2D, 0x00],    // Desactivar subrayado
      FORM_FEED: [0x0C],                     // Alimentar papel
      BEEP: [0x1B, 0x42, 0x05, 0x05]        // Beep corto (5 unidades, 5 repeticiones)
    };
  }

  /**
   * Verifica la conectividad con la impresora Ethernet
   */
  async checkConnection() {
    try {
      // Verificar conectividad via backend usando el cliente API autenticado
      const response = await api.get('/kitchen/printer_status/', {
        params: {
          printer_ip: this.config.ip,
          printer_port: this.config.port
        }
      });
      
      return { success: true, ...response.data };
      
    } catch (error) {
      throw new Error(`No se puede conectar con la impresora en ${this.config.ip}:${this.config.port} - ${error.message}`);
    }
  }

  /**
   * Envía comandos ESC/POS a la impresora via TCP/IP a través del backend
   */
  async sendCommand(commandBytes) {
    try {
      
      // Enviar comando al backend usando el cliente API autenticado
      const response = await api.post('/kitchen/print_label/', {
        printer_ip: this.config.ip,
        printer_port: this.config.port,
        label_data: Array.from(commandBytes) // Convertir a array para JSON
      });
      
      return response.data;
      
    } catch (error) {
      throw new Error(`Error comunicándose con impresora Ethernet: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Genera etiqueta para un item de la orden (IDÉNTICO al Bluetooth para mantener formato)
   */
  generateKitchenLabel(orderItem, order) {
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
    const dateStr = now.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    let label = [];
    
    
    // Inicializar con fuente monospace Font A
    label.push(...this.commands.INIT);
    label.push(...this.commands.FONT_A); // Fuente monospace
    
    // ESPACIO INICIAL reducido para portacomandera
    label.push(...this.commands.LF);
    label.push(...this.commands.LF);
    label.push(...this.commands.LF);
    
    // Header - Número de orden centrado (tamaño reducido)
    label.push(...this.commands.ALIGN_CENTER);
    const orderNumber = `No. ${order.id}`;
    label.push(...this.textToBytes(orderNumber));
    label.push(...this.commands.LF);
    
    // Ubicación - centrada 
    let ubicacion = '';
    if (order.table_number && order.zone_name) {
      ubicacion = `${order.zone_name} - MESA ${order.table_number}`;
    } else if (order.items?.some(item => item.is_takeaway)) {
      ubicacion = 'DELIVERY';
    } else {
      ubicacion = 'SALON';
    }
    
    label.push(...this.commands.ALIGN_CENTER);
    label.push(...this.commands.FONT_SIZE_DOUBLE_HEIGHT);
    label.push(...this.textToBytes(ubicacion));
    label.push(...this.commands.FONT_SIZE_NORMAL);
    label.push(...this.commands.LF);
    
    // Mesero centrado
    if (order.waiter) {
      label.push(...this.commands.ALIGN_CENTER);
      label.push(...this.textToBytes(`MOZO: ${order.waiter.toUpperCase()}`));
      label.push(...this.commands.LF);
    }
    
    label.push(...this.commands.LF);
    
    // Fecha y hora centrados
    label.push(...this.commands.ALIGN_CENTER);
    const timeDate = `${timeStr}     ${dateStr}`;
    label.push(...this.textToBytes(timeDate));
    label.push(...this.commands.LF);
    label.push(...this.commands.LF);
    
    // TABLA como ticketfds.jpeg con columnas definidas y datos centrados en cada columna
    const qty = orderItem.quantity.toString();
    let productName = orderItem.recipe_name || orderItem.recipe?.name || orderItem.product_name || 'PRODUCTO';
    
    // Definir anchos de columnas como en ticketfds.jpeg
    // Para etiquetadora 80mm = aproximadamente 48 caracteres
    const totalWidth = 40;
    const qtyColWidth = 6;   // Columna cantidad pequeña
    const prodColWidth = totalWidth - qtyColWidth - 2; // Resto para producto
    
    // Headers de tabla - alineados izquierda como tabla Excel
    label.push(...this.commands.ALIGN_LEFT);
    const cantHeader = 'Cant'.padEnd(qtyColWidth, ' ');
    const prodHeader = 'Producto';
    const headerLine = cantHeader + '  ' + prodHeader;
    label.push(...this.textToBytes(headerLine));
    label.push(...this.commands.LF);
    
    // Separador debajo de headers
    label.push(...this.commands.ALIGN_LEFT);
    const qtyDashes = '-'.repeat(qtyColWidth);
    const prodDashes = '-'.repeat(Math.min(prodColWidth, 20));
    const separatorLine = qtyDashes + '  ' + prodDashes;
    label.push(...this.textToBytes(separatorLine));
    label.push(...this.commands.LF);
    label.push(...this.commands.LF); // Espacio extra antes del data line
    
    // DATOS manteniendo formato de tabla con salto de línea inteligente
    label.push(...this.commands.ALIGN_LEFT);
    label.push(...this.commands.BOLD_ON);
    label.push(...this.commands.FONT_SIZE_DOUBLE); // 0x11 = Doble ancho y altura (2x2)
    
    // Con FONT_SIZE_DOUBLE, ajustar anchos de columnas (mitad de espacio disponible)
    const tableWidthDouble = 20;  // Ancho total con texto grande
    const qtyColWidthDouble = 3;  // Columna cantidad más pequeña
    const prodColWidthDouble = tableWidthDouble - qtyColWidthDouble - 1; // Columna producto
    
    // Cantidad centrada en su columna pequeña
    const qtySpacesDouble = Math.max(0, Math.floor((qtyColWidthDouble - qty.length) / 2));
    const qtyFormattedDouble = ' '.repeat(qtySpacesDouble) + qty + ' '.repeat(qtyColWidthDouble - qtySpacesDouble - qty.length);
    
    // Producto con salto de línea inteligente manteniendo formato de tabla
    const words = productName.split(' ');
    let productLines = [];
    let currentLine = '';
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? currentLine + ' ' + word : word;
      
      if (testLine.length <= prodColWidthDouble) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          productLines.push(currentLine);
        }
        currentLine = word;
      }
    }
    
    if (currentLine) {
      productLines.push(currentLine);
    }
    
    // Imprimir primera línea con cantidad y primera línea del producto
    const firstProdLine = productLines[0] || '';
    const firstDataLine = qtyFormattedDouble + ' ' + firstProdLine;
    label.push(...this.textToBytes(firstDataLine));
    label.push(...this.commands.LF);
    
    // Imprimir líneas adicionales del producto alineadas con la columna producto
    for (let i = 1; i < productLines.length; i++) {
      const emptyQtySpace = ' '.repeat(qtyColWidthDouble + 1); // Espacios para columna cantidad + separador
      const additionalLine = emptyQtySpace + productLines[i];
      label.push(...this.textToBytes(additionalLine));
      label.push(...this.commands.LF);
    }
    
    label.push(...this.commands.BOLD_OFF);
    label.push(...this.commands.FONT_SIZE_NORMAL);
    label.push(...this.commands.LF);
    label.push(...this.commands.LF);
    
    // Notas especiales si existen (tamaño NORMAL como solicitado)
    const notes = orderItem.notes || orderItem.special_instructions || orderItem.nota || '';
    
    if (notes && notes.trim()) {
      label.push(...this.commands.LF);
      label.push(...this.commands.ALIGN_LEFT);
      label.push(...this.commands.FONT_SIZE_NORMAL); // Asegurar tamaño normal
      label.push(...this.commands.BOLD_ON);
      label.push(...this.textToBytes('NOTAS:'));
      label.push(...this.commands.BOLD_OFF);
      label.push(...this.commands.LF);
      label.push(...this.textToBytes(notes.trim()));
      label.push(...this.commands.LF);
    }
    
    // Beep de confirmación (característica del modelo DMN-C-E-R03523)
    label.push(...this.commands.BEEP);
    
    // MAYOR ESPACIO FINAL para mejor corte
    label.push(...this.commands.LF);
    label.push(...this.commands.LF);
    label.push(...this.commands.LF);
    label.push(...this.commands.LF);
    label.push(...this.commands.CUT_PAPER);
    
    return new Uint8Array(label);
  }

  /**
   * Convierte texto a bytes UTF-8
   */
  textToBytes(text) {
    const encoder = new TextEncoder();
    return Array.from(encoder.encode(text));
  }

  /**
   * Imprime etiqueta para un item de cocina via Ethernet
   */
  async printKitchenLabel(orderItem, order) {
    try {
      
      const labelData = this.generateKitchenLabel(orderItem, order);
      
      await this.sendCommand(labelData);
      
      return { success: true, item_id: orderItem.id, method: 'ethernet' };
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Imprime múltiples etiquetas de cocina via Ethernet
   */
  async printMultipleLabels(orderItems, order) {
    const results = [];
    
    for (const item of orderItems) {
      try {
        const result = await this.printKitchenLabel(item, order);
        results.push({ item_id: item.id, success: true, result });
        
        // Pausa menor entre impresiones (Ethernet es más rápido que Bluetooth)
        await new Promise(resolve => setTimeout(resolve, 200));
        
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
   * Test de conectividad e impresión Ethernet usando endpoint del backend
   */
  async testPrinter() {
    try {
      
      // Usar el endpoint de test del backend con cliente API autenticado
      const response = await api.post('/kitchen/test_printer/', {
        printer_ip: this.config.ip,
        printer_port: this.config.port
      });
      
      return true;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Actualiza la configuración de red de la impresora
   */
  updateNetworkConfig(ip, port = 9100) {
    this.config.ip = ip;
    this.config.port = port;
    
    // Guardar en localStorage para persistencia
    localStorage.setItem('printer_ip', ip);
    localStorage.setItem('printer_port', port.toString());
    
  }

  /**
   * Obtiene información de estado de la impresora
   */
  async getStatus() {
    try {
      const status = await this.checkConnection();
      return {
        connected: true,
        method: 'ethernet',
        ip: this.config.ip,
        port: this.config.port,
        model: this.config.model,
        features: this.config.features,
        ...status
      };
    } catch (error) {
      return {
        connected: false,
        method: 'ethernet',
        ip: this.config.ip,
        port: this.config.port,
        error: error.message
      };
    }
  }
}

// Instancia singleton para cocina Ethernet
const ethernetKitchenPrinter = new EthernetKitchenPrinter();

// Función helper para imprimir etiquetas de cocina via Ethernet
export const printEthernetKitchenLabels = async (orderItems, order) => {
  try {
    
    const results = await ethernetKitchenPrinter.printMultipleLabels(orderItems, order);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    
    return {
      success: failed === 0,
      total: orderItems.length,
      successful,
      failed,
      results,
      method: 'ethernet'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      total: orderItems.length,
      successful: 0,
      failed: orderItems.length,
      method: 'ethernet'
    };
  }
};

export default ethernetKitchenPrinter;