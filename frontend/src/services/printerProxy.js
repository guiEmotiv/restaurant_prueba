/**
 * Servicio de Proxy de Impresión para Producción
 * Permite imprimir desde EC2 a impresora local
 */

class PrinterProxyService {
  constructor() {
    this.config = {
      // En desarrollo: usar backend local
      development: {
        useProxy: false,
        backendUrl: 'http://localhost:8000'
      },
      // En producción: determinar si usar proxy local
      production: {
        useProxy: true,
        proxyUrl: 'http://192.168.1.100:3001', // Raspberry Pi proxy
        backendUrl: import.meta.env.VITE_API_BASE_URL
      }
    };
    
    this.isProduction = import.meta.env.PROD;
    this.isLocalClient = this.detectLocalClient();
  }

  /**
   * Detecta si el cliente está en la red local
   */
  detectLocalClient() {
    const hostname = window.location.hostname;
    // Cliente local si accede desde IP privada o localhost
    return hostname === 'localhost' || 
           hostname.startsWith('192.168.') || 
           hostname.startsWith('10.') ||
           hostname.startsWith('172.');
  }

  /**
   * Determina la mejor ruta para imprimir
   */
  async print(printerData) {
    // Si es producción Y el cliente está en red local
    if (this.isProduction && this.isLocalClient) {
      console.log('🖨️ Modo Producción: Usando proxy local para impresión');
      return this.printViaLocalProxy(printerData);
    }
    
    // Si es desarrollo O producción sin cliente local
    console.log('🖨️ Usando backend directo para impresión');
    return this.printViaBackend(printerData);
  }

  /**
   * Imprime via proxy local (para producción)
   */
  async printViaLocalProxy(data) {
    try {
      // Intentar proxy local primero
      const response = await fetch(`${this.config.production.proxyUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        console.log('✅ Impresión exitosa via proxy local');
        return await response.json();
      }
      
      // Si falla, intentar con backend
      console.warn('⚠️ Proxy local no disponible, intentando backend');
      return this.printViaBackend(data);
      
    } catch (error) {
      console.error('❌ Error con proxy local:', error);
      // Fallback a backend
      return this.printViaBackend(data);
    }
  }

  /**
   * Imprime via backend (desarrollo o fallback)
   */
  async printViaBackend(data) {
    // Usar el servicio existente
    if (window.ethernetKitchenPrinter) {
      return window.ethernetKitchenPrinter.sendCommand(data.label_data);
    }
    
    // Fallback directo
    const url = this.isProduction 
      ? `${this.config.production.backendUrl}/kitchen/print_label/`
      : `${this.config.development.backendUrl}/api/v1/kitchen/print_label/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    return response.json();
  }

  /**
   * Verifica estado de conexión
   */
  async checkStatus() {
    const status = {
      environment: this.isProduction ? 'production' : 'development',
      isLocalClient: this.isLocalClient,
      printerRoute: 'unknown',
      proxyAvailable: false,
      backendAvailable: false
    };
    
    // Check proxy local
    if (this.isLocalClient) {
      try {
        const proxyResponse = await fetch(`${this.config.production.proxyUrl}/status`);
        status.proxyAvailable = proxyResponse.ok;
      } catch (e) {
        status.proxyAvailable = false;
      }
    }
    
    // Check backend
    try {
      const backendUrl = this.isProduction 
        ? this.config.production.backendUrl 
        : this.config.development.backendUrl;
      const backendResponse = await fetch(`${backendUrl}/health/`);
      status.backendAvailable = backendResponse.ok;
    } catch (e) {
      status.backendAvailable = false;
    }
    
    // Determinar ruta
    if (this.isProduction && this.isLocalClient && status.proxyAvailable) {
      status.printerRoute = 'local-proxy';
    } else if (status.backendAvailable) {
      status.printerRoute = 'backend-direct';
    } else {
      status.printerRoute = 'none-available';
    }
    
    return status;
  }
}

// Exportar instancia singleton
const printerProxy = new PrinterProxyService();

// Auto-check en carga
if (typeof window !== 'undefined') {
  printerProxy.checkStatus().then(status => {
    console.log('🖨️ Estado del Proxy de Impresión:', status);
    
    if (status.environment === 'production' && status.isLocalClient) {
      console.log('📍 Cliente local detectado en producción');
      console.log(`🖨️ Ruta de impresión: ${status.printerRoute}`);
      
      if (!status.proxyAvailable) {
        console.warn('⚠️ Proxy local no disponible. Necesitas ejecutar el servidor proxy local.');
        console.log('💡 Instrucciones: npm run proxy en la máquina local');
      }
    }
  });
}

export default printerProxy;