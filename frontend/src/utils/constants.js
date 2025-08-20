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
  COOK: 'cocineros',
  CASHIER: 'cajeros'
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


export default {
  API_CONFIG,
  USER_ROLES,
  ORDER_STATUS,
  PAYMENT_METHODS,
  UI_CONFIG
};