/**
 * Logger centralizado para la aplicación
 * PRODUCTION SAFE: All console statements removed for security
 */

// No-op function to maintain API compatibility while preventing console output
const noop = () => {};

export const logger = {
  /**
   * Errores críticos - disabled for production security
   */
  error: noop,

  /**
   * Advertencias - disabled for production security  
   */
  warn: noop,

  /**
   * Información general - disabled for production security
   */
  info: noop,

  /**
   * Debug detallado - disabled for production security
   */
  debug: noop,

  /**
   * Para APIs y requests - disabled for production security
   */
  api: noop,

  /**
   * Para timing de performance - disabled for production security
   */
  time: noop,

  timeEnd: noop
};

// Export default para compatibilidad
export default logger;