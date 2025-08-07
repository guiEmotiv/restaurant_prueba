/**
 * Configuración de impresora Bluetooth para El Fogón de Don Soto
 * 
 * CONFIGURACIÓN DE LA IMPRESORA:
 * - Dispositivo: Etiquetera Bluetooth
 * - PIN: 1234
 * - Dirección MAC: 66:32:35:92:92:26
 * - Fuente actual: Font-A
 * 
 * INSTRUCCIONES DE EMPAREJAMIENTO:
 * 1. Encender la impresora
 * 2. En el dispositivo, ir a Configuración > Bluetooth
 * 3. Buscar dispositivos disponibles
 * 4. Seleccionar la impresora (puede aparecer como "Label Printer" o similar)
 * 5. Introducir el PIN: 1234
 * 6. Confirmar emparejamiento
 * 
 * RESOLUCIÓN DE PROBLEMAS:
 * - Si no se encuentra la impresora, verificar que esté encendida y en modo de emparejamiento
 * - Si falla la conexión, reiniciar la impresora y volver a intentar
 * - Asegurar que el navegador sea Chrome o Edge (soportan Web Bluetooth)
 * - Verificar que el dispositivo tenga Bluetooth habilitado
 */

export const PRINTER_CONFIG = {
  // Información del dispositivo
  deviceName: 'Label Printer',
  macAddress: '66:32:35:92:92:26',
  pin: '1234',
  font: 'Font-A',
  
  // UUIDs para conexión Bluetooth (pueden variar según la impresora)
  // Estos son UUIDs genéricos para impresoras, ajustar según sea necesario
  serviceUUID: '000018f0-0000-1000-8000-00805f9b34fb',
  characteristicUUID: '00002af1-0000-1000-8000-00805f9b34fb',
  
  // UUIDs alternativos si los anteriores no funcionan
  alternativeUUIDs: {
    service: ['12345678-1234-5678-9abc-123456789abc', '49535343-fe7d-4ae5-8fa9-9fafd205e455'],
    characteristic: ['12345678-1234-5678-9abc-123456789abd', '49535343-1e4d-4bd9-ba61-23c647249616']
  }
};

export const PRINTER_COMMANDS = {
  // Comandos básicos ESC/POS
  INIT: [0x1B, 0x40],              // Inicializar impresora
  LF: [0x0A],                      // Salto de línea  
  CR: [0x0D],                      // Retorno de carro
  FF: [0x0C],                      // Alimentar papel
  
  // Control de papel
  CUT_PAPER: [0x1D, 0x56, 0x00],  // Cortar papel
  FEED_LINE: [0x1B, 0x64, 0x02],  // Alimentar 2 líneas
  
  // Alineación
  ALIGN_LEFT: [0x1B, 0x61, 0x00],     // Alinear izquierda
  ALIGN_CENTER: [0x1B, 0x61, 0x01],   // Alinear centro  
  ALIGN_RIGHT: [0x1B, 0x61, 0x02],    // Alinear derecha
  
  // Formato de texto
  BOLD_ON: [0x1B, 0x45, 0x01],        // Activar negrita
  BOLD_OFF: [0x1B, 0x45, 0x00],       // Desactivar negrita
  UNDERLINE_ON: [0x1B, 0x2D, 0x01],   // Activar subrayado
  UNDERLINE_OFF: [0x1B, 0x2D, 0x00],  // Desactivar subrayado
  DOUBLE_HEIGHT: [0x1B, 0x21, 0x10],  // Doble altura
  DOUBLE_WIDTH: [0x1B, 0x21, 0x20],   // Doble ancho
  NORMAL_SIZE: [0x1B, 0x21, 0x00],    // Tamaño normal
  
  // Fuentes
  FONT_A: [0x1B, 0x4D, 0x00],         // Fuente A (normal)
  FONT_B: [0x1B, 0x4D, 0x01],         // Fuente B (pequeña)
  FONT_C: [0x1B, 0x4D, 0x02],         // Fuente C (muy pequeña)
  
  // Codificación de caracteres
  CHAR_SET_SPAIN: [0x1B, 0x52, 0x0C], // Juego de caracteres España
  CODE_PAGE_CP850: [0x1B, 0x74, 0x02] // Página de códigos CP850 (español)
};

export const RECEIPT_SETTINGS = {
  // Configuración del comprobante
  maxLineWidth: 32,                    // Ancho máximo de línea en caracteres
  separatorChar: '-',                  // Caracter para líneas separadoras
  doubleSeparatorChar: '=',           // Caracter para líneas separadoras dobles
  
  // Información del restaurante
  restaurantName: 'EL FOGON DE DON SOTO',
  restaurantAddress: '',               // Agregar dirección si es necesario
  restaurantPhone: '',                 // Agregar teléfono si es necesario
  
  // Textos del comprobante
  receiptTitle: 'COMPROBANTE DE PAGO',
  splitReceiptTitle: 'COMPROBANTE DE PAGO',
  splitReceiptSubtitle: '(CUENTA DIVIDIDA)',
  thankYouMessage: '¡GRACIAS POR SU VISITA!',
  returnMessage: 'Vuelva pronto',
  
  // Configuración de impresión
  feedLines: 3,                        // Líneas de alimentación al final
  cutAfterPrint: true                  // Cortar papel después de imprimir
};

// Función helper para formatear líneas con ancho fijo
export const formatLine = (left, right, width = RECEIPT_SETTINGS.maxLineWidth) => {
  const leftStr = String(left);
  const rightStr = String(right);
  const spacesNeeded = width - leftStr.length - rightStr.length;
  const spaces = spacesNeeded > 0 ? ' '.repeat(spacesNeeded) : '';
  return leftStr + spaces + rightStr;
};

// Función helper para crear líneas separadoras
export const createSeparator = (char = RECEIPT_SETTINGS.separatorChar, width = RECEIPT_SETTINGS.maxLineWidth) => {
  return char.repeat(width);
};

export default {
  PRINTER_CONFIG,
  PRINTER_COMMANDS,
  RECEIPT_SETTINGS,
  formatLine,
  createSeparator
};