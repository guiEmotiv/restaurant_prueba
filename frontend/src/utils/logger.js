/**
 * Logger centralizado para la aplicación
 * CLEAN MODE: Minimal logging for production-like experience
 */

export const logger = {
  /**
   * Errores críticos - solo errores importantes
   */
  error: (...args) => console.error('[ERROR]', ...args),

  /**
   * Advertencias - disabled for clean console
   */
  warn: (...args) => {}, // console.warn('[WARN]', ...args),

  /**
   * Información general - disabled for clean console
   */
  info: (...args) => {}, // console.info('[INFO]', ...args),

  /**
   * Debug detallado - disabled for clean console
   */
  debug: (...args) => {}, // console.debug('[DEBUG]', ...args),

  /**
   * Para APIs y requests - disabled for clean console  
   */
  api: (...args) => {}, // console.log('[API]', ...args),

  /**
   * Para timing de performance - disabled for clean console
   */
  time: (label) => {}, // console.time(label),

  timeEnd: (label) => {} // console.timeEnd(label)
};

// Export default para compatibilidad
export default logger;