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
  }

  // Configurar vista de cocina
  setKitchenView(isKitchen) {
    this.isKitchenView = isKitchen;
  }

  // Verificar si puede notificar
  canNotify() {
    return this.isKitchenView && notificationService.canListen();
  }

  // Inicializar items conocidos
  async initializeOrderItems() {
    try {
      const orders = await apiService.orders.getAll();
      this.knownItems.clear();
      
      orders.forEach(order => {
        order.items?.forEach(item => {
          this.knownItems.add(`${item.id}-${item.created_at || order.created_at}`);
        });
      });
      
      console.log('📋 Items inicializados:', this.knownItems.size);
    } catch (error) {
      console.error('❌ Error inicializando:', error);
    }
  }

  // Detectar cambios en order items
  async checkForNewOrderItems() {
    if (!this.canNotify()) return;

    try {
      const orders = await apiService.orders.getAll();
      const currentItems = new Set();
      const newItems = [];
      
      // Procesar items actuales
      orders.forEach(order => {
        order.items?.forEach(item => {
          const itemKey = `${item.id}-${item.created_at || order.created_at}`;
          currentItems.add(itemKey);
          
          if (!this.knownItems.has(itemKey)) {
            newItems.push({ recipe_name: item.recipe_name, itemKey });
          }
        });
      });
      
      // Detectar eliminados
      const deletedCount = this.knownItems.size - currentItems.size + newItems.length;
      
      // Actualizar items conocidos
      this.knownItems = currentItems;
      
      // Reproducir sonidos
      if (newItems.length > 0) {
        console.log('🆕 Nuevos items:', newItems.length);
        notificationService.playNotification('itemCreated');
      }

      if (deletedCount > 0) {
        console.log('🗑️ Items eliminados:', deletedCount);
        notificationService.playNotification('itemDeleted');
      }
      
    } catch (error) {
      console.error('❌ Error en polling:', error);
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
    
    console.log('🔄 Polling iniciado');
  }

  // Detener polling
  stopPolling() {
    if (!this.isPolling) return;

    this.isPolling = false;
    clearInterval(this.pollInterval);
    this.pollInterval = null;
    console.log('⏹️ Polling detenido');
  }
}

// Exportar instancia singleton
export default new OrderItemPoller();