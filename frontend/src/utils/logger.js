/**
 * Logger centralizado para la aplicación
 * Controla el logging basado en el entorno y configuración
 */

const isDev = import.meta.env.DEV;
const logLevel = import.meta.env.VITE_LOG_LEVEL || 'info';

// Niveles de logging (menor número = mayor prioridad)
const levels = {
  error: 0,
  warn: 1, 
  info: 2,
  debug: 3
};

const currentLevel = levels[logLevel] || 2;

// Colores para consola (solo en desarrollo)
const colors = {
  error: '\x1b[31m',   // Rojo
  warn: '\x1b[33m',    // Amarillo
  info: '\x1b[36m',    // Cian
  debug: '\x1b[90m',   // Gris
  reset: '\x1b[0m'
};

const formatMessage = (level, message, ...args) => {
  const timestamp = new Date().toISOString().substr(11, 8);
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (isDev) {
    return [`${colors[level]}${prefix}${colors.reset}`, message, ...args];
  }
  return [prefix, message, ...args];
};

export const logger = {
  /**
   * Errores críticos - siempre se muestran
   */
  error: (message, ...args) => {
    if (currentLevel >= 0) {
      console.error(...formatMessage('error', message, ...args));
    }
  },

  /**
   * Advertencias - importantes pero no críticas
   */
  warn: (message, ...args) => {
    if (currentLevel >= 1) {
      console.warn(...formatMessage('warn', message, ...args));
    }
  },

  /**
   * Información general - solo en desarrollo por defecto
   */
  info: (message, ...args) => {
    if (currentLevel >= 2 && (isDev || import.meta.env.VITE_LOG_INFO === 'true')) {
      console.info(...formatMessage('info', message, ...args));
    }
  },

  /**
   * Debug detallado - solo en desarrollo
   */
  debug: (message, ...args) => {
    if (currentLevel >= 3 && isDev) {
      console.log(...formatMessage('debug', message, ...args));
    }
  },

  /**
   * Para APIs y requests - con información estructurada
   */
  api: (method, url, data, response) => {
    if (isDev && currentLevel >= 2) {
      console.group(`🌐 API ${method} ${url}`);
      if (data) console.log('Request:', data);
      if (response) console.log('Response:', response);
      console.groupEnd();
    }
  },

  /**
   * Para timing de performance
   */
  time: (label) => {
    if (isDev && currentLevel >= 3) {
      console.time(label);
    }
  },

  timeEnd: (label) => {
    if (isDev && currentLevel >= 3) {
      console.timeEnd(label);
    }
  }
};

// Export default para compatibilidad
export default logger;