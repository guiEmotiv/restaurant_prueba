/**
 * Servicio HTTP para gestión de impresoras y cola de impresión
 */
import api from './api';

class HttpPrinterService {
  // =============================================
  // CONFIGURACIÓN DE IMPRESORAS
  // =============================================
  
  /**
   * Obtener todas las configuraciones de impresoras
   */
  async getPrinterConfigs(params = {}) {
    const response = await api.get('/printer-config/', { params });
    return response.data;
  }

  // Alias para compatibilidad
  async getConfigurations(params = {}) {
    return this.getPrinterConfigs(params);
  }
  
  /**
   * Obtener una configuración de impresora específica
   */
  async getPrinterConfig(id) {
    const response = await api.get(`/printer-config/${id}/`);
    return response.data;
  }
  
  /**
   * Crear nueva configuración de impresora
   */
  async createPrinterConfig(data) {
    const response = await api.post('/printer-config/', data);
    return response.data;
  }

  // Alias para compatibilidad
  async createConfiguration(data) {
    return this.createPrinterConfig(data);
  }
  
  /**
   * Actualizar configuración de impresora
   */
  async updatePrinterConfig(id, data) {
    const response = await api.put(`/printer-config/${id}/`, data);
    return response.data;
  }

  // Alias para compatibilidad
  async updateConfiguration(id, data) {
    return this.updatePrinterConfig(id, data);
  }
  
  /**
   * Eliminar configuración de impresora
   */
  async deletePrinterConfig(id) {
    const response = await api.delete(`/printer-config/${id}/`);
    return response.data;
  }

  // Alias para compatibilidad
  async deleteConfiguration(id) {
    return this.deletePrinterConfig(id);
  }
  
  /**
   * Probar conexión de una impresora específica
   */
  async testPrinterConnection(id) {
    const response = await api.post(`/printer-config/${id}/test_connection/`);
    return response.data;
  }
  
  /**
   * Probar conexión de todas las impresoras activas
   */
  async testAllPrinters() {
    const response = await api.post('/printer-config/test_all/');
    return response.data;
  }
  
  /**
   * Activar una impresora
   */
  async activatePrinter(id) {
    const response = await api.post(`/printer-config/${id}/activate/`);
    return response.data;
  }
  
  /**
   * Desactivar una impresora
   */
  async deactivatePrinter(id) {
    const response = await api.post(`/printer-config/${id}/deactivate/`);
    return response.data;
  }
  
  /**
   * Obtener resumen del estado de todas las impresoras
   */
  async getPrinterStatusSummary() {
    const response = await api.get('/printer-config/status_summary/');
    return response.data;
  }
  
  // =============================================
  // COLA DE IMPRESIÓN
  // =============================================
  
  /**
   * Obtener trabajos de impresión en cola
   */
  async getPrintJobs(params = {}) {
    const response = await api.get('/print-queue/', { params });
    return response.data;
  }
  
  /**
   * Obtener trabajo de impresión específico
   */
  async getPrintJob(id) {
    const response = await api.get(`/print-queue/${id}/`);
    return response.data;
  }
  
  /**
   * Crear trabajo de impresión manual
   */
  async createPrintJob(data) {
    const response = await api.post('/print-queue/', data);
    return response.data;
  }
  
  /**
   * Actualizar trabajo de impresión (prioridad, max_attempts)
   */
  async updatePrintJob(id, data) {
    const response = await api.put(`/print-queue/${id}/`, data);
    return response.data;
  }
  
  /**
   * Cancelar/eliminar trabajo de impresión
   */
  async deletePrintJob(id) {
    const response = await api.delete(`/print-queue/${id}/`);
    return response.data;
  }
  
  /**
   * Reintentar un trabajo fallido
   */
  async retryPrintJob(id) {
    const response = await api.post(`/print-queue/${id}/retry_job/`);
    return response.data;
  }
  
  /**
   * Cancelar un trabajo específico
   */
  async cancelPrintJob(id, reason = 'Cancelado por usuario') {
    const response = await api.post(`/print-queue/${id}/cancel_job/`, { reason });
    return response.data;
  }
  
  /**
   * Procesar trabajos pendientes
   */
  async processPendingJobs(limit = 10) {
    const response = await api.post('/print-queue/process_pending/', { limit });
    return response.data;
  }
  
  /**
   * Obtener estado actual de la cola
   */
  async getQueueStatus() {
    const response = await api.get('/print-queue/queue_status/');
    const data = response.data;
    
    // Transformar el formato del backend al esperado por el frontend
    return {
      ...data,
      status_summary: {
        pending: data.pending_count || 0,
        in_progress: data.in_progress_count || 0,
        printed: data.printed_count || 0,
        failed: data.failed_count || 0,
        cancelled: data.cancelled_count || 0
      }
    };
  }
  
  /**
   * Obtener trabajos fallidos
   */
  async getFailedJobs() {
    const response = await api.get('/print-queue/failed_jobs/');
    return response.data;
  }
  
  /**
   * Reintentar todos los trabajos fallidos
   */
  async retryAllFailedJobs() {
    const response = await api.post('/print-queue/retry_all_failed/');
    return response.data;
  }
  
  /**
   * Limpiar trabajos completados antiguos
   */
  async clearCompletedJobs() {
    const response = await api.delete('/print-queue/clear_completed/');
    return response.data;
  }
  
  // =============================================
  // DIAGNÓSTICOS Y UTILIDADES
  // =============================================
  
  /**
   * Obtener información de diagnóstico de impresoras
   */
  async getPrinterDiagnostics() {
    const response = await api.get('/printer-diagnostics/');
    return response.data;
  }
  
  /**
   * Verificar salud del Raspberry Pi
   */
  async checkRpiHealth() {
    const response = await api.get('/rpi-health/');
    return response.data;
  }
  
  // =============================================
  // HELPERS Y UTILIDADES
  // =============================================
  
  /**
   * Formatear puerto USB
   */
  formatUsbPort(port) {
    if (!port.startsWith('/dev/')) {
      return `/dev/${port}`;
    }
    return port;
  }
  
  /**
   * Validar formato de puerto USB
   */
  validateUsbPort(port) {
    const usbPortRegex = /^\/dev\/(usb\/lp[0-9]|ttyUSB[0-9]|lp[0-9])$/;
    return usbPortRegex.test(port);
  }
  
  /**
   * Obtener texto para estado de impresora
   */
  getPrinterStatusEmoji(isActive) {
    return isActive ? 'Activa' : 'Inactiva';
  }
  
  /**
   * Obtener emoji para estado de trabajo
   */
  getJobStatusEmoji(status) {
    const statusEmojis = {
      'pending': '⏳',
      'in_progress': '🔄',
      'printed': '✅',
      'failed': '❌',
      'cancelled': '🚫'
    };
    return statusEmojis[status] || '❓';
  }
  
  
  /**
   * Formatear fecha legible
   */
  formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  /**
   * Calcular tiempo transcurrido
   */
  getTimeElapsed(dateString) {
    if (!dateString) return 'N/A';
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Menos de 1 min';
    if (diffMins < 60) return `${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} h ${diffMins % 60} min`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} días ${diffHours % 24} h`;
  }
  
  /**
   * Obtener sugerencias de puertos USB comunes
   */
  getCommonUsbPorts() {
    return [
      '/dev/usb/lp0',
      '/dev/usb/lp1',
      '/dev/ttyUSB0',
      '/dev/ttyUSB1',
      '/dev/lp0',
      '/dev/lp1'
    ];
  }
  
  /**
   * Crear contenido de etiqueta de muestra
   */
  createSampleLabel(printerName) {
    const now = new Date();
    return `
================================
      ETIQUETA DE PRUEBA
================================

Impresora: ${printerName}
Fecha: ${this.formatDate(now.toISOString())}
Sistema: Restaurant Web

--------------------------------
IMPRESIÓN EXITOSA
Test de conectividad
Sistema de Cocina
================================

\x1B\x6D`.trim();
  }

  /**
   * Métodos adicionales requeridos por la nueva interfaz
   */

  // Escanear puertos disponibles en RPi4
  async scanAvailablePorts() {
    try {
      const response = await api.get('/rpi-scan-ports/');
      return response.data;
    } catch (error) {
      console.error('Error scanning ports:', error);
      // Fallback con puertos comunes
      return {
        available_ports: this.getCommonUsbPorts(),
        message: 'Using fallback common ports'
      };
    }
  }

  // Obtener trabajos de la cola
  async getQueueJobs(params = {}) {
    try {
      const response = await api.get('/print-queue/', { params });
      return response.data;
    } catch (error) {
      console.error('Error getting queue jobs:', error);
      return { jobs: [] };
    }
  }

  // Probar conexión de impresora (IMPRIME ticket de prueba)
  async testConnection(printerId) {
    try {
      const response = await api.post(`/printer-config/${printerId}/test_connection/`);
      return response.data;
    } catch (error) {
      console.error('Error testing printer:', error);
      return { success: false, message: error.message || 'Error testing printer' };
    }
  }

  // Verificar SOLO conexión USB sin imprimir nada (usando proxy Django)
  async checkUsbConnection(printerId) {
    try {
      // Usar el endpoint proxy de Django en lugar de conectar directamente al RPi4
      const response = await api.post(`/printer-config/${printerId}/check_usb_connection/`);
      
      return {
        success: response.data.usb_result?.success || false,
        connected: response.data.connected || false,
        message: response.data.message || 'Verificación USB completada',
        test_result: response.data.usb_result // Para compatibilidad con código existente
      };
    } catch (error) {
      console.error('Error checking USB connection:', error);
      return { 
        success: false, 
        connected: false,
        message: error.message || 'Error verificando conexión USB',
        test_result: { success: false, message: error.message }
      };
    }
  }

  // Actualizar todos los métodos legacy para usar apiService
  async testPrinterConnection(id) {
    return this.testConnection(id);
  }

  async testAllPrinters() {
    const response = await api.post('/printer-config/test_all/');
    return response.data;
  }

  async activatePrinter(id) {
    const response = await api.post(`/printer-config/${id}/activate/`);
    return response.data;
  }

  async deactivatePrinter(id) {
    const response = await api.post(`/printer-config/${id}/deactivate/`);
    return response.data;
  }

  async getPrinterStatusSummary() {
    const response = await api.get('/printer-config/status_summary/');
    return response.data;
  }

  async processQueue() {
    const response = await api.post('/print-queue/process_pending/');
    return response.data;
  }

  async retryFailedJobs() {
    const response = await api.post('/print-queue/retry_failed/');
    return response.data;
  }


  async clearCompletedJobs() {
    const response = await api.post('/print-queue/clear_completed/');
    return response.data;
  }
}

// Exportar instancia única del servicio
const httpPrinterService = new HttpPrinterService();
export { httpPrinterService };
export default httpPrinterService;