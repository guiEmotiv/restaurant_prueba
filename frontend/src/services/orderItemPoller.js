// Servicio de polling para detectar nuevos order items entre dispositivos
import { apiService } from './api';
import notificationService from './notifications';

class OrderItemPoller {
  constructor() {
    this.isPolling = false;
    this.pollInterval = null;
    this.knownItems = new Set();
    this.intervalMs = 5000;
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
      const kitchenBoard = await apiService.orders.getKitchenBoard();
      this.knownItems.clear();
      
      kitchenBoard.forEach(recipe => {
        recipe.items?.forEach(item => {
          this.knownItems.add(`${item.id}-${item.created_at}`);
        });
      });
      
    } catch (error) {
      // Error inicializando - continuar silenciosamente
    }
  }

  // Detectar cambios en order items usando kitchen board
  async checkForNewOrderItems() {
    try {
      const kitchenBoard = await apiService.orders.getKitchenBoard();
      const currentItems = new Set();
      const newItems = [];
      
      // Procesar items actuales
      kitchenBoard.forEach(recipe => {
        recipe.items?.forEach(item => {
          const itemKey = `${item.id}-${item.created_at}`;
          currentItems.add(itemKey);
          
          if (!this.knownItems.has(itemKey)) {
            newItems.push({ recipe_name: item.recipe_name, itemKey });
          }
        });
      });
      
      // Detectar cambios (nuevos items o items eliminados)
      const hasChanges = newItems.length > 0 || this.knownItems.size !== currentItems.size;
      
      // Actualizar items conocidos
      this.knownItems = currentItems;
      
      // Si hay cambios, actualizar la vista
      if (hasChanges && this.updateCallback) {
        this.updateCallback();
      }
      
      // Reproducir sonidos solo si está en vista de cocina
      if (this.isKitchenView && this.canNotify()) {
        if (newItems.length > 0) {
          notificationService.playNotification('itemCreated');
        }
      }
      
    } catch (error) {
      // Error en polling - continuar silenciosamente
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