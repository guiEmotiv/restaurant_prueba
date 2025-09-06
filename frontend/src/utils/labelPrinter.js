/**
 * Utilidad para impresión de etiquetas ESC/POS en etiquetadora de cocina
 * Modelo: DMN-C-E-R03523
 * IP: 192.168.1.23
 * Puerto: 9100 (TCP estándar para impresoras ESC/POS)
 */

class KitchenLabelPrinter {
  constructor() {
    this.printerIP = '192.168.1.23';
    this.printerPort = 9100;
    this.isConnected = false;
  }

  /**
   * Comandos ESC/POS para la etiquetadora
   */
  static ESC = '\x1B';
  static GS = '\x1D';

  // Comandos de inicialización
  static INIT = '\x1B@';
  static RESET = '\x1B@';

  // Comandos de texto
  static BOLD_ON = '\x1B\x45\x01';
  static BOLD_OFF = '\x1B\x45\x00';
  static CENTER = '\x1B\x61\x01';
  static LEFT = '\x1B\x61\x00';
  static RIGHT = '\x1B\x61\x02';

  // Comandos de tamaño de fuente
  static FONT_SIZE_NORMAL = '\x1D\x21\x00';
  static FONT_SIZE_DOUBLE_HEIGHT = '\x1D\x21\x10';
  static FONT_SIZE_DOUBLE_WIDTH = '\x1D\x21\x20';
  static FONT_SIZE_DOUBLE = '\x1D\x21\x11';

  // Comandos de corte
  static CUT_PAPER = '\x1D\x56\x42\x00'; // Corte completo
  static PARTIAL_CUT = '\x1D\x56\x41'; // Corte parcial

  // Salto de línea
  static LINE_FEED = '\x0A';
  static FORM_FEED = '\x0C';

  /**
   * Generar etiqueta individual para un order item
   * Formato basado en ticketfds.jpeg
   */
  generateItemLabel(orderItem, order) {
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

    let label = '';
    
    // Inicializar impresora
    label += KitchenLabelPrinter.INIT;
    
    // Encabezado - Número de orden centrado y en negrita
    label += KitchenLabelPrinter.CENTER;
    label += KitchenLabelPrinter.BOLD_ON;
    label += KitchenLabelPrinter.FONT_SIZE_DOUBLE_HEIGHT;
    label += `N° ${order.id}`;
    label += KitchenLabelPrinter.LINE_FEED;
    label += KitchenLabelPrinter.BOLD_OFF;
    label += KitchenLabelPrinter.FONT_SIZE_NORMAL;
    
    // Información de ubicación - centrado
    label += KitchenLabelPrinter.CENTER;
    label += KitchenLabelPrinter.BOLD_ON;
    
    // Determinar ubicación según el tipo de orden
    let ubicacion = '';
    if (order.table_number && order.zone_name) {
      ubicacion = `${order.zone_name} - MESA ${order.table_number}`;
    } else if (order.items?.some(item => item.is_takeaway)) {
      ubicacion = 'DELIVERY';
    } else {
      ubicacion = 'SALON';
    }
    
    label += ubicacion;
    label += KitchenLabelPrinter.LINE_FEED;
    label += KitchenLabelPrinter.BOLD_OFF;
    
    // Información del mesero si existe
    if (order.waiter) {
      label += `MOZO: ${order.waiter.toUpperCase()}`;
      label += KitchenLabelPrinter.LINE_FEED;
    }
    
    label += KitchenLabelPrinter.LINE_FEED;
    
    // Hora y fecha - izquierda y derecha
    label += KitchenLabelPrinter.LEFT;
    label += `${timeStr}`;
    
    // Calcular espacios para alinear fecha a la derecha
    const timeLength = timeStr.length;
    const dateLength = dateStr.length;
    const lineWidth = 32; // Ancho típico para papel de 80mm
    const spacesNeeded = Math.max(0, lineWidth - timeLength - dateLength);
    label += ' '.repeat(spacesNeeded);
    label += dateStr;
    label += KitchenLabelPrinter.LINE_FEED;
    label += KitchenLabelPrinter.LINE_FEED;
    
    // Encabezados de tabla
    label += KitchenLabelPrinter.LEFT;
    label += 'Cant';
    label += ' '.repeat(8); // Espaciado
    label += 'Producto';
    label += KitchenLabelPrinter.LINE_FEED;
    
    // Línea separadora
    label += '-'.repeat(lineWidth);
    label += KitchenLabelPrinter.LINE_FEED;
    
    // Información del item - SOLO EL ITEM QUE CAMBIÓ DE ESTADO
    label += KitchenLabelPrinter.LEFT;
    label += KitchenLabelPrinter.BOLD_ON;
    label += KitchenLabelPrinter.FONT_SIZE_DOUBLE_HEIGHT;
    
    // Cantidad (centrada en 4 caracteres)
    const qty = orderItem.quantity.toString().padStart(2, ' ');
    label += qty;
    label += ' '.repeat(6); // Espaciado entre cantidad y producto
    
    // Nombre del producto (puede ocupar múltiples líneas)
    // Manejar diferentes estructuras posibles del objeto
    const productName = orderItem.recipe_name || orderItem.recipe?.name || orderItem.product_name || 'PRODUCTO SIN NOMBRE';
    const maxProductWidth = 20; // Caracteres máximos por línea de producto
    
    // Dividir el nombre del producto en líneas si es muy largo
    if (productName.length > maxProductWidth) {
      const words = productName.split(' ');
      let currentLine = '';
      let isFirstLine = true;
      
      for (const word of words) {
        if ((currentLine + ' ' + word).length <= maxProductWidth) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (!isFirstLine) {
            label += KitchenLabelPrinter.LINE_FEED;
            label += ' '.repeat(8); // Alinear con el texto del producto
          }
          label += currentLine;
          currentLine = word;
          isFirstLine = false;
        }
      }
      
      if (currentLine) {
        if (!isFirstLine) {
          label += KitchenLabelPrinter.LINE_FEED;
          label += ' '.repeat(8);
        }
        label += currentLine;
      }
    } else {
      label += productName;
    }
    
    label += KitchenLabelPrinter.BOLD_OFF;
    label += KitchenLabelPrinter.FONT_SIZE_NORMAL;
    label += KitchenLabelPrinter.LINE_FEED;
    
    // Notas especiales si existen
    if (orderItem.special_instructions) {
      label += KitchenLabelPrinter.LINE_FEED;
      label += 'NOTAS: ';
      label += orderItem.special_instructions;
      label += KitchenLabelPrinter.LINE_FEED;
    }
    
    // Líneas finales
    label += KitchenLabelPrinter.LINE_FEED;
    label += KitchenLabelPrinter.LINE_FEED;
    
    // Cortar papel
    label += KitchenLabelPrinter.CUT_PAPER;
    
    return label;
  }

  /**
   * Enviar etiqueta a la impresora via TCP
   */
  async sendToPrinter(labelData) {
    try {
      // Verificar si estamos en un entorno web que soporte TCP directo
      if (!window.chrome || !window.chrome.sockets) {
        console.warn('TCP directo no disponible, usando método alternativo');
        return await this.sendViaProxy(labelData);
      }

      // Método directo TCP (requiere Chrome Apps API o extensión)
      return new Promise((resolve, reject) => {
        chrome.sockets.tcp.create({}, (socketInfo) => {
          const socketId = socketInfo.socketId;
          
          chrome.sockets.tcp.connect(socketId, this.printerIP, this.printerPort, (result) => {
            if (result < 0) {
              reject(new Error(`Error conectando a impresora: ${result}`));
              return;
            }
            
            const data = new TextEncoder().encode(labelData);
            
            chrome.sockets.tcp.send(socketId, data.buffer, (sendInfo) => {
              chrome.sockets.tcp.close(socketId);
              
              if (sendInfo.resultCode < 0) {
                reject(new Error(`Error enviando datos: ${sendInfo.resultCode}`));
              } else {
                resolve(sendInfo);
              }
            });
          });
        });
      });
      
    } catch (error) {
      console.error('Error enviando a impresora:', error);
      throw error;
    }
  }

  /**
   * Método alternativo: enviar via proxy backend
   */
  async sendViaProxy(labelData) {
    try {
      // Importar api service para usar autenticación correcta
      const { default: api } = await import('../services/api');
      
      const response = await api.post('/kitchen/print_label/', {
        printer_ip: this.printerIP,
        printer_port: this.printerPort,
        label_data: Array.from(new TextEncoder().encode(labelData))
      });

      // Axios response - data ya viene parseado
      return response.data;
      
    } catch (error) {
      console.error('Error enviando via proxy:', error);
      throw error;
    }
  }

  /**
   * Imprimir etiquetas para múltiples order items
   */
  async printItemLabels(orderItems, order) {
    const results = [];
    
    for (const item of orderItems) {
      try {
        // Debug: ver estructura del item
        console.log('📦 Estructura del item:', item);
        const itemName = item.recipe_name || item.recipe?.name || item.product_name || 'Sin nombre';
        console.log(`🏷️ Generando etiqueta para item ${item.id}: ${itemName}`);
        
        const labelData = this.generateItemLabel(item, order);
        
        console.log(`📤 Enviando etiqueta a impresora ${this.printerIP}:${this.printerPort}`);
        const result = await this.sendToPrinter(labelData);
        
        console.log(`✅ Etiqueta impresa para item ${item.id}`);
        results.push({ item_id: item.id, success: true, result });
        
        // Pequeña pausa entre impresiones para evitar saturar la impresora
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error imprimiendo etiqueta para item ${item.id}:`, error);
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
   * Test de conectividad con la impresora
   */
  async testConnection() {
    try {
      const testLabel = this.generateTestLabel();
      await this.sendToPrinter(testLabel);
      console.log('✅ Test de impresora exitoso');
      return true;
    } catch (error) {
      console.error('❌ Test de impresora falló:', error);
      return false;
    }
  }

  /**
   * Generar etiqueta de prueba
   */
  generateTestLabel() {
    let label = '';
    label += KitchenLabelPrinter.INIT;
    label += KitchenLabelPrinter.CENTER;
    label += KitchenLabelPrinter.BOLD_ON;
    label += 'TEST DE IMPRESORA';
    label += KitchenLabelPrinter.LINE_FEED;
    label += KitchenLabelPrinter.BOLD_OFF;
    label += 'Etiquetadora de Cocina';
    label += KitchenLabelPrinter.LINE_FEED;
    label += new Date().toLocaleString('es-ES');
    label += KitchenLabelPrinter.LINE_FEED;
    label += KitchenLabelPrinter.LINE_FEED;
    label += KitchenLabelPrinter.CUT_PAPER;
    return label;
  }
}

// Instancia singleton del printer
export const kitchenPrinter = new KitchenLabelPrinter();

// Función helper para imprimir desde componentes
export const printKitchenLabels = async (orderItems, order) => {
  try {
    console.log(`🏷️ Iniciando impresión de ${orderItems.length} etiquetas para orden ${order.id}`);
    
    const results = await kitchenPrinter.printItemLabels(orderItems, order);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`📊 Impresión completada: ${successful} exitosas, ${failed} fallidas`);
    
    return {
      success: failed === 0,
      total: orderItems.length,
      successful,
      failed,
      results
    };
    
  } catch (error) {
    console.error('❌ Error general en impresión de etiquetas:', error);
    return {
      success: false,
      error: error.message,
      total: orderItems.length,
      successful: 0,
      failed: orderItems.length
    };
  }
};

export default KitchenLabelPrinter;