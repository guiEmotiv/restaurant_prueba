/**
 * Service para manejar Server-Sent Events (SSE) en tiempo real
 * Proporciona sincronización automática entre vistas Kitchen y OrderManagement
 */
import { useState, useEffect } from 'react';

class SSEService {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map(); // {eventType: [callback1, callback2, ...]}
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.isConnected = false;
    this.userId = null;
    this.streamType = 'orders';
    this.debug = false;
  }

  /**
   * Inicializa la conexión SSE
   * @param {string} userId - ID del usuario para el stream
   * @param {string} streamType - Tipo de stream ('orders' o 'kitchen')
   */
  connect(userId = 'anonymous', streamType = 'orders') {
    // Evitar múltiples conexiones
    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
      return;
    }

    if (this.eventSource) {
      this.disconnect();
    }

    this.userId = userId;
    this.streamType = streamType;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const sseUrl = `${baseUrl}/api/v1/sse/${streamType}/?user_id=${encodeURIComponent(userId)}`;


    try {
      this.eventSource = new EventSource(sseUrl);
      
      // Event listeners básicos
      this.eventSource.onopen = (event) => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', { status: 'connected' });
      };

      this.eventSource.onerror = (event) => {
        this.isConnected = false;
        
        
        // Desconectar la conexión problemática
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        
        // Intentar reconectar con delay más agresivo
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          this.emit('max_reconnect_attempts', { attempts: this.reconnectAttempts });
        }
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('message', data);
        } catch (error) {
          console.error('❌ SSE: Error parseando mensaje', error, event.data);
        }
      };

      // Event listeners específicos
      this.setupEventListeners();

    } catch (error) {
      console.error('❌ SSE: Error creando EventSource', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Configura los event listeners específicos para cada tipo de evento
   */
  setupEventListeners() {
    if (!this.eventSource) return;

    // Heartbeat para mantener conexión
    this.eventSource.addEventListener('heartbeat', (event) => {
      try {
        const data = JSON.parse(event.data);
      } catch (error) {
        console.error('❌ SSE: Error en heartbeat', error);
      }
    });

    // Actualizaciones de order items
    this.eventSource.addEventListener('order_item_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('order_item_update', data);
      } catch (error) {
        console.error('❌ SSE: Error en order_item_update', error);
      }
    });

    // Actualizaciones de órdenes
    this.eventSource.addEventListener('order_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('order_update', data);
      } catch (error) {
        console.error('❌ SSE: Error en order_update', error);
      }
    });

    // Eliminación de order items
    this.eventSource.addEventListener('order_item_delete', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('order_item_delete', data);
      } catch (error) {
        console.error('❌ SSE: Error en order_item_delete', error);
      }
    });

    // Eliminación de órdenes
    this.eventSource.addEventListener('order_delete', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('order_delete', data);
      } catch (error) {
        console.error('❌ SSE: Error en order_delete', error);
      }
    });
  }

  /**
   * Programa un intento de reconexión
   */
  scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Delays más conservadores: 2s, 5s, 10s, 20s, 30s
    const delays = [2000, 5000, 10000, 20000, 30000];
    const delay = delays[Math.min(this.reconnectAttempts, delays.length - 1)];
    this.reconnectAttempts++;


    this.reconnectTimeout = setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId, this.streamType);
      }
    }, delay);
  }

  /**
   * Desconecta el SSE
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
    
  }

  /**
   * Suscribe un callback a un tipo de evento específico
   * @param {string} eventType - Tipo de evento
   * @param {function} callback - Función callback
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);

    // Retornar función para desuscribirse
    return () => {
      this.off(eventType, callback);
    };
  }

  /**
   * Desuscribe un callback de un tipo de evento
   * @param {string} eventType - Tipo de evento
   * @param {function} callback - Función callback
   */
  off(eventType, callback) {
    if (this.listeners.has(eventType)) {
      const callbacks = this.listeners.get(eventType);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
      
      // Limpiar listeners vacíos
      if (callbacks.length === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  /**
   * Emite un evento a todos los listeners suscritos
   * @param {string} eventType - Tipo de evento
   * @param {object} data - Datos del evento
   */
  emit(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ SSE: Error en callback de ${eventType}`, error);
        }
      });
    }
  }

  /**
   * Verifica si está conectado
   * @returns {boolean}
   */
  isConnectionOpen() {
    return this.isConnected && this.eventSource && this.eventSource.readyState === EventSource.OPEN;
  }

  /**
   * Obtiene el estado de la conexión
   * @returns {object}
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: this.eventSource ? this.eventSource.readyState : EventSource.CLOSED,
      reconnectAttempts: this.reconnectAttempts,
      userId: this.userId
    };
  }
}

// Instancia singleton para uso global
const sseService = new SSEService();

export default sseService;

/**
 * Hook personalizado para usar SSE en componentes React
 * @param {string} userId - ID del usuario
 * @param {string} streamType - Tipo de stream ('orders' o 'kitchen')
 * @param {object} eventHandlers - Objeto con handlers para diferentes eventos
 * @returns {object} Estado de la conexión SSE
 */
export const useSSE = (userId = 'anonymous', streamType = 'orders', eventHandlers = {}) => {
  const [connectionStatus, setConnectionStatus] = useState(sseService.getConnectionStatus());

  useEffect(() => {
    // Conectar al montar
    sseService.connect(userId, streamType);

    // Suscribirse a eventos de estado
    const unsubscribeConnected = sseService.on('connected', () => {
      setConnectionStatus(sseService.getConnectionStatus());
    });

    const unsubscribeMaxReconnect = sseService.on('max_reconnect_attempts', () => {
      setConnectionStatus(sseService.getConnectionStatus());
    });

    // Suscribirse a event handlers personalizados
    const unsubscribers = Object.entries(eventHandlers).map(([eventType, handler]) => 
      sseService.on(eventType, handler)
    );

    // Cleanup al desmontar
    return () => {
      unsubscribeConnected();
      unsubscribeMaxReconnect();
      unsubscribers.forEach(unsubscribe => unsubscribe());
      sseService.disconnect();
    };
  }, [userId, streamType]);

  return {
    ...connectionStatus,
    reconnect: () => sseService.connect(userId, streamType),
    disconnect: () => sseService.disconnect()
  };
};