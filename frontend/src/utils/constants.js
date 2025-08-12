/**
 * Constantes globales de la aplicación
 * Centraliza valores que se usan en múltiples componentes
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  VERSION: 'v1',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3
};

// User Roles
export const USER_ROLES = {
  ADMIN: 'administradores',
  WAITER: 'meseros', 
  COOK: 'cocineros'
};

// Order Status
export const ORDER_STATUS = {
  CREATED: 'CREATED',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED'
};

// Payment Methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  YAPE: 'yape',
  TRANSFER: 'transfer'
};

// UI Configuration
export const UI_CONFIG = {
  TOAST_DURATION: 5000,
  REFRESH_INTERVAL: 30000,
  DEBOUNCE_DELAY: 300,
  PAGINATION_SIZE: 20
};

// Route Paths
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  TABLES: '/tables',
  ORDERS: '/orders',
  INVENTORY: '/inventory',
  KITCHEN: '/kitchen',
  REPORTS: '/reports'
};

// Validation Rules
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_NAME_LENGTH: 100,
  MAX_NOTES_LENGTH: 500,
  MIN_PRICE: 0.01,
  MAX_PRICE: 9999.99
};

// Feature Flags
export const FEATURES = {
  BLUETOOTH_PRINTING: import.meta.env.VITE_ENABLE_BLUETOOTH_PRINTER === 'true',
  ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  DEBUG_PANEL: import.meta.env.DEV && import.meta.env.VITE_SHOW_DEBUG === 'true'
};

// Local Storage Keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'restaurant_user_preferences',
  CART: 'restaurant_cart',
  LAST_TABLE: 'restaurant_last_table'
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Error de conexión. Verifica tu internet.',
  UNAUTHORIZED: 'No tienes permisos para realizar esta acción.',
  NOT_FOUND: 'El recurso solicitado no fue encontrado.',
  VALIDATION_ERROR: 'Por favor verifica los datos ingresados.',
  UNKNOWN_ERROR: 'Ocurrió un error inesperado. Intenta nuevamente.'
};

export default {
  API_CONFIG,
  USER_ROLES,
  ORDER_STATUS,
  PAYMENT_METHODS,
  UI_CONFIG,
  ROUTES,
  VALIDATION,
  FEATURES,
  STORAGE_KEYS,
  ERROR_MESSAGES
};