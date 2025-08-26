// Servicio de polling para detectar nuevos order items entre dispositivos
import { apiService } from './api';
import notificationService from './notifications';

class OrderItemPoller {
  constructor() {
    this.isPolling = false;
    this.pollInterval = null;
    this.knownItems = new Set();
    this.knownItemIds = new Set(); // Para rastrear IDs y detectar eliminaciones reales
    this.intervalMs = 3000; // Polling cada 3 segundos para reducir carga de red
    this.isKitchenView = false;
    this.updateCallback = null;
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
      
      kitchenBoard.forEach(recipe => {
        recipe.items?.forEach(item => {
          this.knownItems.add(`${item.id}-${item.created_at}`);
          this.knownItemIds.add(item.id);
        });
      });
      
    } catch (error) {
      // Manejo específico para ERR_NETWORK_CHANGED
      if (error.message?.includes('Network connection changed')) {
        console.warn('OrderItemPoller: Network changed during initialization');
        return;
      }
      
      // Error inicializando - continuar silenciosamente para otros errores
    }
  }

  // Detectar cambios en order items usando kitchen board
  async checkForNewOrderItems() {
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
          
          if (!this.knownItems.has(itemKey)) {
            newItems.push({ recipe_name: item.recipe_name, itemKey });
          }
        });
      });
      
      // Detectar items eliminados (simplificado - solo items de cocina)
      const deletedItems = [];
      this.knownItemIds.forEach(itemId => {
        if (!currentItemIds.has(itemId)) {
          deletedItems.push(itemId);
        }
      });
      
      // Detectar cambios
      const hasChanges = newItems.length > 0 || deletedItems.length > 0 || 
                        this.knownItems.size !== currentItems.size;
      
      // Actualizar items conocidos
      this.knownItems = currentItems;
      this.knownItemIds = currentItemIds;
      
      // Si hay cambios, actualizar la vista
      if (hasChanges && this.updateCallback) {
        this.updateCallback();
      }
      
      // Reproducir sonidos solo si está en vista de cocina y audio está activo
      if (this.isKitchenView && this.canNotify()) {
        // Sonido cuando se crean nuevos items
        if (newItems.length > 0) {
          notificationService.playNotification('itemCreated');
        }
        // Sonido cuando se eliminan items del pedido (eliminación real, no cambio de estado)
        if (deletedItems.length > 0) {
          notificationService.playNotification('itemDeleted');
        }
      }
      
    } catch (error) {
      // Manejo específico para ERR_NETWORK_CHANGED
      if (error.message?.includes('Network connection changed')) {
        console.warn('OrderItemPoller: Network changed, pausing polling for 5 seconds');
        this.stopPolling();
        setTimeout(() => {
          if (!this.isPolling) {
            this.startPolling();
          }
        }, 5000);
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