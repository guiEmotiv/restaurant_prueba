// Servicio de polling para detectar nuevos order items entre dispositivos
import { apiService } from './api';
import notificationService from './notifications';

class OrderItemPoller {
  constructor() {
    this.isPolling = false;
    this.pollInterval = null;
    this.knownItems = new Set();
    this.knownItemIds = new Set(); // Para rastrear IDs y detectar eliminaciones reales
    this.allKnownItemIds = new Set(); // Para rastrear TODOS los items que han existido (incluidos SERVED)
    this.intervalMs = 2000; // Polling cada 2 segundos para mejor sincronización multi-usuario
    this.isKitchenView = false;
    this.updateCallback = null;
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = 3;
    this.backoffMs = 5000; // Tiempo base para backoff
    
    // Detector de estado de conexión
    this.setupNetworkDetection();
  }

  // Configurar detección de estado de red
  setupNetworkDetection() {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      window.addEventListener('online', () => {
        console.log('OrderItemPoller: Connection restored, resuming polling');
        if (!this.isPolling && this.isKitchenView) {
          this.consecutiveErrors = 0;
          this.startPolling();
        }
      });
      
      window.addEventListener('offline', () => {
        console.log('OrderItemPoller: Connection lost, pausing polling');
        this.stopPolling();
      });
    }
  }

  // Configurar vista de cocina
  setKitchenView(isKitchen) {
    this.isKitchenView = isKitchen;
  }

  // Configurar callback para actualizar la UI
  setUpdateCallback(callback) {
    this.updateCallback = callback;
  }

  // Verificar si puede notificar
  canNotify() {
    return this.isKitchenView && notificationService.canListen();
  }

  // Inicializar items conocidos usando kitchen board
  async initializeOrderItems() {
    try {
      // Solo usar kitchen board para reducir llamadas API
      const kitchenBoard = await apiService.orders.getKitchenBoard();
      this.knownItems.clear();
      this.knownItemIds.clear();
      
      // Inicializar también el conjunto de todos los items conocidos
      // Para evitar sonidos al inicio, agregar todos los items actuales como conocidos
      kitchenBoard.forEach(recipe => {
        recipe.items?.forEach(item => {
          this.knownItems.add(`${item.id}-${item.created_at}`);
          this.knownItemIds.add(item.id);
          this.allKnownItemIds.add(item.id); // Agregar a todos los conocidos
        });
      });
      
    } catch (error) {
      // Manejo específico para errores de red/internet
      if (error.message?.includes('Network connection changed') || 
          error.message?.includes('NETWORK_ERROR_SILENT') ||
          error.code === 'ERR_INTERNET_DISCONNECTED') {
        console.warn('OrderItemPoller: Network issue during initialization');
        return;
      }
      
      // Error inicializando - continuar silenciosamente para otros errores
    }
  }

  // Detectar cambios en order items usando kitchen board
  async checkForNewOrderItems() {
    // Verificar estado de conexión antes de hacer la llamada
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      // No hacer polling si está offline
      return;
    }
    
    try {
      // Solo usar kitchen board para reducir llamadas API
      const kitchenBoard = await apiService.orders.getKitchenBoard();
      
      const currentItems = new Set();
      const currentItemIds = new Set();
      const newItems = [];
      
      // Procesar items de cocina
      kitchenBoard.forEach(recipe => {
        recipe.items?.forEach(item => {
          const itemKey = `${item.id}-${item.created_at}`;
          currentItems.add(itemKey);
          currentItemIds.add(item.id);
          
          // Agregar a todos los items conocidos
          this.allKnownItemIds.add(item.id);
          
          if (!this.knownItems.has(itemKey)) {
            newItems.push({ recipe_name: item.recipe_name, itemKey });
          }
        });
      });
      
      // MEJORADO: Solo considerar como "eliminado" si un item desapareció del kitchen board
      // Y además no existe en la API cuando lo consultamos directamente
      const potentiallyDeletedItems = [];
      this.knownItemIds.forEach(itemId => {
        if (!currentItemIds.has(itemId)) {
          potentiallyDeletedItems.push(itemId);
        }
      });
      
      // Verificar si los items "desaparecidos" fueron realmente eliminados o solo cambiaron de estado
      const reallyDeletedItems = [];
      for (const itemId of potentiallyDeletedItems) {
        try {
          // Intentar obtener el item directamente de la API
          await apiService.orderItems.getById(itemId);
          // Si llegamos aquí, el item existe pero cambió de estado (ej: SERVED)
          // NO reproducir sonido de eliminación
        } catch (error) {
          // Si da error 404, el item fue realmente eliminado
          if (error.response && error.response.status === 404) {
            reallyDeletedItems.push(itemId);
            // IMPORTANTE: Remover de allKnownItemIds para evitar futuros 404
            this.allKnownItemIds.delete(itemId);
          }
          // Para otros errores (500, red, etc), asumir que el item existe pero no es accesible
          // NO agregar a reallyDeletedItems para evitar sonidos incorrectos
        }
      }
      
      // Detectar cambios
      const hasChanges = newItems.length > 0 || potentiallyDeletedItems.length > 0 || 
                        this.knownItems.size !== currentItems.size;
      
      // Actualizar items conocidos
      this.knownItems = currentItems;
      this.knownItemIds = currentItemIds;
      
      // Reset contador de errores en polling exitoso
      this.consecutiveErrors = 0;
      
      // Si hay cambios, actualizar la vista
      if (hasChanges && this.updateCallback) {
        this.updateCallback();
      }
      
      // Reproducir sonidos solo si está en vista de cocina y audio está activo
      if (this.isKitchenView && this.canNotify()) {
        // Sonido cuando se crean nuevos items (solo items verdaderamente nuevos)
        if (newItems.length > 0) {
          notificationService.playNotification('itemCreated');
        }
        // Sonido SOLO cuando se eliminan items del pedido (eliminación real, no cambio de estado)
        if (reallyDeletedItems.length > 0) {
          notificationService.playNotification('itemDeleted');
        }
      }
      
    } catch (error) {
      // Incrementar contador de errores consecutivos
      this.consecutiveErrors++;
      
      // Manejo específico para errores de conexión a internet
      if (error.message?.includes('Network connection changed') ||
          error.message?.includes('NETWORK_ERROR_SILENT') ||
          error.code === 'ERR_INTERNET_DISCONNECTED' ||
          error.code === 'ERR_NETWORK_CHANGED') {
        
        // No mostrar error en console si el navegador detecta que está offline
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // Silencioso cuando está offline según el navegador
          this.stopPolling();
          return;
        }
        
        console.warn(`OrderItemPoller: ${error.code || 'Network error'}, pausing polling`);
        this.stopPolling();
        
        // Backoff progresivo basado en errores consecutivos
        const pauseTime = Math.min(this.backoffMs * Math.pow(2, this.consecutiveErrors - 1), 60000);
        setTimeout(() => {
          if (!this.isPolling && this.isKitchenView) {
            this.startPolling();
          }
        }, pauseTime);
        return;
      }
      
      // Para otros errores, usar backoff más conservador
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        console.warn(`OrderItemPoller: Too many consecutive errors (${this.consecutiveErrors}), pausing polling`);
        this.stopPolling();
        setTimeout(() => {
          this.consecutiveErrors = 0;
          if (!this.isPolling && this.isKitchenView) {
            this.startPolling();
          }
        }, 30000); // 30 segundos de pausa para errores persistentes
        return;
      }
      
      // Error en polling - continuar silenciosamente para otros errores
    }
  }

  // Iniciar polling
  startPolling() {
    if (this.isPolling) return;

    this.isPolling = true;
    this.initializeOrderItems();
    
    this.pollInterval = setInterval(() => {
      this.checkForNewOrderItems();
    }, this.intervalMs);
  }

  // Detener polling
  stopPolling() {
    if (!this.isPolling) return;

    this.isPolling = false;
    clearInterval(this.pollInterval);
    this.pollInterval = null;
  }
}

// Exportar instancia singleton
export default new OrderItemPoller();