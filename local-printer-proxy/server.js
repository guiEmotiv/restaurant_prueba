/**
 * Servidor Proxy Local para Impresión
 * Ejecutar en una máquina dentro del restaurante
 * Permite que EC2 imprima en impresoras locales
 */

const express = require('express');
const cors = require('cors');
const net = require('net');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de impresoras locales
const PRINTERS = {
  kitchen: {
    ip: '192.168.1.23',
    port: 9100,
    name: 'DMN-C-E-R03523 - Cocina'
  },
  bar: {
    ip: '192.168.1.24', // Si tienes otra
    port: 9100,
    name: 'Impresora Bar'
  },
  cashier: {
    ip: '192.168.1.25', // Si tienes otra
    port: 9100,
    name: 'Impresora Caja'
  }
};

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '10mb' }));

// Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * Status endpoint
 */
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    printers: Object.keys(PRINTERS).map(key => ({
      id: key,
      name: PRINTERS[key].name,
      ip: PRINTERS[key].ip
    }))
  });
});

/**
 * Test printer connectivity
 */
app.post('/test/:printer', async (req, res) => {
  const printerKey = req.params.printer || 'kitchen';
  const printer = PRINTERS[printerKey];
  
  if (!printer) {
    return res.status(404).json({ error: 'Printer not found' });
  }
  
  try {
    const isConnected = await testPrinterConnection(printer.ip, printer.port);
    res.json({
      success: isConnected,
      printer: printer.name,
      ip: printer.ip,
      message: isConnected ? 'Printer is online' : 'Printer is offline'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Print endpoint
 */
app.post('/print/:printer?', async (req, res) => {
  const printerKey = req.params.printer || 'kitchen';
  const printer = PRINTERS[printerKey];
  
  if (!printer) {
    return res.status(404).json({ error: 'Printer not found' });
  }
  
  const { label_data, printer_ip, printer_port } = req.body;
  
  // Override con IP custom si se proporciona
  const targetIp = printer_ip || printer.ip;
  const targetPort = printer_port || printer.port;
  
  try {
    console.log(`🖨️ Printing to ${printer.name} at ${targetIp}:${targetPort}`);
    
    // Convertir datos a Buffer
    let dataBuffer;
    if (Array.isArray(label_data)) {
      dataBuffer = Buffer.from(label_data);
    } else if (typeof label_data === 'string') {
      dataBuffer = Buffer.from(label_data, 'base64');
    } else {
      dataBuffer = Buffer.from(label_data);
    }
    
    // Enviar a impresora
    const result = await sendToPrinter(targetIp, targetPort, dataBuffer);
    
    console.log(`✅ Successfully sent ${dataBuffer.length} bytes to printer`);
    
    res.json({
      success: true,
      bytes_sent: dataBuffer.length,
      printer: printer.name,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ Print error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      printer: printer.name
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * Enviar datos a impresora via TCP
 */
function sendToPrinter(ip, port, data) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ port, host: ip }, () => {
      console.log(`📡 Connected to printer at ${ip}:${port}`);
    });
    
    client.setTimeout(10000); // 10 second timeout
    
    client.on('error', (err) => {
      reject(new Error(`Printer connection error: ${err.message}`));
    });
    
    client.on('timeout', () => {
      client.destroy();
      reject(new Error('Printer connection timeout'));
    });
    
    client.on('close', () => {
      console.log('📡 Connection closed');
    });
    
    // Send data and close
    client.write(data, () => {
      client.end();
      resolve({ success: true });
    });
  });
}

/**
 * Test printer connection
 */
function testPrinterConnection(ip, port, timeout = 5000) {
  return new Promise((resolve) => {
    const client = net.createConnection({ port, host: ip }, () => {
      client.end();
      resolve(true);
    });
    
    client.setTimeout(timeout);
    
    client.on('error', () => {
      resolve(false);
    });
    
    client.on('timeout', () => {
      client.destroy();
      resolve(false);
    });
  });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Local Printer Proxy Server');
  console.log(`📡 Listening on http://0.0.0.0:${PORT}`);
  console.log('🖨️ Configured printers:');
  Object.entries(PRINTERS).forEach(([key, printer]) => {
    console.log(`   - ${key}: ${printer.name} (${printer.ip}:${printer.port})`);
  });
  console.log('\n💡 Make sure this server is accessible from tablets/PCs in the restaurant');
  console.log('💡 For internet access, use ngrok: ngrok http 3001');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, closing server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, closing server...');
  process.exit(0);
});