import axios from 'axios';
import { logger } from '../utils/logger';
import { API_CONFIG } from '../utils/constants';

// Determine API URL based on environment
let API_BASE_URL;
if (import.meta.env.VITE_API_BASE_URL) {
  // Use explicit environment variable if set
  API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
} else {
  // Use relative path to leverage Vite proxy in dev and work in production
  API_BASE_URL = '/api/v1';
}

// API configurado silenciosamente - Fixed paths for proxy
logger.info('API Configuration:', {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  API_BASE_URL,
  MODE: import.meta.env.MODE,
  PROD: import.meta.env.PROD
});

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: true,  // Enable cookies for CSRF
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken'
});

// Network error retry function
const retryNetworkRequest = async (requestFunc, maxRetries = 2) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFunc();
    } catch (error) {
      // Handle network change errors
      if (error.code === 'ERR_NETWORK' || 
          error.code === 'ERR_INTERNET_DISCONNECTED' ||
          error.message?.includes('Network Error') ||
          error.message?.includes('ERR_NETWORK_CHANGED') ||
          error.message?.includes('ERR_INTERNET_DISCONNECTED')) {
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        
        // Silent fail on network errors for polling requests
        throw new Error('NETWORK_ERROR_SILENT');
      }
      throw error;
    }
  }
};

// Export API_BASE_URL for use in other components
export { API_BASE_URL };

// Debug function for authentication
export const debugAuth = async () => {
  try {
    // Check Django session authentication
    const response = await api.get('/debug/auth/');
    return response.data;
  } catch (error) {
    return null;
  }
};

// Debug functions removed for production security


// Get CSRF token function
const getCSRFToken = async () => {
  try {
    // Check if token is already in cookies
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
    
    if (token) return token;
    
    // If not in cookies, get from API server using axios instance
    const response = await api.get('/csrf/');
    return response.data.csrfToken;
  } catch (error) {
    logger.warn('Failed to get CSRF token:', error);
    return null;
  }
};

// Add request interceptor for authentication and CSRF
api.interceptors.request.use(
  async (config) => {
    logger.api(config.method?.toUpperCase(), config.url, config.data);
    
    // Add CSRF token for non-GET requests
    if (config.method && config.method.toLowerCase() !== 'get') {
      const csrfToken = await getCSRFToken();
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    
    // Django session authentication - no additional headers needed
    // Authentication is handled via session cookies (withCredentials: true)
    logger.info('🔐 Using Django session authentication for:', config.url);
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    // DON'T modify the response here - let handlePaginatedResponse handle it
    return response;
  },
  (error) => {
    // Handle errors silently in production
    return Promise.reject(error);
  }
);

// Helper function to handle paginated responses - OPTIMIZADO para navegación
const handlePaginatedResponse = (response) => {
  // Validar que tenemos una respuesta válida
  if (!response || !response.data) {
    logger.warn('API response missing data field');
    return [];
  }
  
  // Handle paginated response (DRF pagination)
  if (response.data && typeof response.data === 'object' && response.data.results !== undefined) {
    const results = response.data.results;
    return Array.isArray(results) ? results : [];
  }
  
  // Direct array response
  if (Array.isArray(response.data)) {
    return response.data;
  }
  
  // Handle null/undefined data
  if (response.data === null || response.data === undefined) {
    logger.warn('API returned null/undefined data');
    return [];
  }
  
  // Single object returned - wrap in array for consistency
  if (typeof response.data === 'object') {
    logger.info('API returned single object, wrapping in array');
    return [response.data];
  }
  
  // Fallback for any other case
  logger.warn('Unexpected API response format', response.data);
  return [];
};

// API service functions
export const apiService = {
  // Generic CRUD operations - OPTIMIZADO con retry para navegación
  async getAll(endpoint, retries = 2) {
    try {
      const response = await api.get(`/${endpoint}/`);
      return handlePaginatedResponse(response);
    } catch (error) {
      // Better network error handling
      const isNetworkError = (
        error.code === 'NETWORK_ERROR' || 
        error.code === 'ERR_NETWORK_CHANGED' ||
        error.code === 'ERR_INTERNET_DISCONNECTED' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('ERR_INTERNET_DISCONNECTED') ||
        error.response?.status >= 500
      );
      
      // Errores específicos de conexión - manejar silenciosamente para polling
      if (error.code === 'ERR_NETWORK_CHANGED' || error.code === 'ERR_INTERNET_DISCONNECTED') {
        logger.warn(`${error.code} error on ${endpoint} - silent fail for polling`);
        throw new Error('NETWORK_ERROR_SILENT');
      }
      
      if (retries > 0 && isNetworkError) {
        logger.warn(`Network error on ${endpoint}, retrying... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 1000 + (3 - retries) * 500)); // Progressive backoff
        return this.getAll(endpoint, retries - 1);
      }
      
      // Log error for debugging
      logger.error(`API Error on ${endpoint}:`, error.code, error.message);
      throw error;
    }
  },

  async getById(endpoint, id) {
    const response = await api.get(`/${endpoint}/${id}/`);
    return response.data;
  },

  async create(endpoint, data) {
    const response = await api.post(`/${endpoint}/`, data);
    return response.data;
  },

  async update(endpoint, id, data) {
    const response = await api.put(`/${endpoint}/${id}/`, data);
    return response.data;
  },

  async patch(endpoint, id, data) {
    const response = await api.patch(`/${endpoint}/${id}/`, data);
    return response.data;
  },

  async delete(endpoint, id) {
    const response = await api.delete(`/${endpoint}/${id}/`);
    return response.data;
  },

  // Config endpoints

  units: {
    getAll: () => apiService.getAll('units'),
    getById: (id) => apiService.getById('units', id),
    create: (data) => apiService.create('units', data),
    update: (id, data) => apiService.update('units', id, data),
    delete: (id) => apiService.delete('units', id),
    getIngredients: async (id) => {
      const response = await api.get(`/units/${id}/ingredients/`);
      return response.data;
    },
    importExcel: async (formData) => {
      const response = await axios.post('/import-units/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
        withCredentials: true
      });
      return response.data;
    },
  },

  zones: {
    getAll: () => apiService.getAll('zones'),
    getById: (id) => apiService.getById('zones', id),
    create: (data) => apiService.create('zones', data),
    update: (id, data) => apiService.update('zones', id, data),
    delete: (id) => apiService.delete('zones', id),
    getTables: async (id) => {
      const response = await api.get(`/zones/${id}/tables/`);
      return response.data;
    },
    importExcel: async (formData) => {
      const response = await axios.post('/import-zones/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
        withCredentials: true
      });
      return response.data;
    },
  },

  tables: {
    getAll: () => apiService.getAll('tables'),
    getById: (id) => apiService.getById('tables', id),
    create: (data) => apiService.create('tables', data),
    update: (id, data) => apiService.update('tables', id, data),
    delete: (id) => apiService.delete('tables', id),
    getOrders: async (id) => {
      const response = await api.get(`/tables/${id}/orders/`);
      return response.data;
    },
    getCurrentOrder: async (id) => {
      const response = await api.get(`/tables/${id}/current_order/`);
      return response.data;
    },
    getActiveOrders: async (id) => {
      const response = await api.get(`/tables/${id}/active_orders/`);
      return response.data;
    },
    importExcel: async (formData) => {
      const response = await axios.post('/import-tables/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
        withCredentials: true
      });
      return response.data;
    },
  },


  // Inventory endpoints
  groups: {
    getAll: () => apiService.getAll('groups'),
    getById: (id) => apiService.getById('groups', id),
    create: (data) => apiService.create('groups', data),
    update: (id, data) => apiService.update('groups', id, data),
    delete: (id) => apiService.delete('groups', id),
    getRecipes: async (id) => {
      const response = await api.get(`/groups/${id}/recipes/`);
      return response.data;
    },
    importExcel: async (formData) => {
      const response = await axios.post('/import-groups/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
        withCredentials: true
      });
      return response.data;
    },
  },

  ingredients: {
    getAll: async (params = {}, retries = 2) => {
      try {
        // Fetch all ingredients by requesting all pages
        let allIngredients = [];
        let page = 1;
        let hasNextPage = true;
        
        while (hasNextPage) {
          const pageParams = { ...params, page };
          const queryParams = new URLSearchParams(pageParams).toString();
          const url = queryParams ? `/ingredients/?${queryParams}` : '/ingredients/';
          const response = await api.get(url);
          
          if (response.data && response.data.results) {
            allIngredients = [...allIngredients, ...response.data.results];
            hasNextPage = !!response.data.next;
            page++;
          } else if (Array.isArray(response.data)) {
            // Non-paginated response
            return response.data;
          } else {
            hasNextPage = false;
          }
        }
        
        return allIngredients;
      } catch (error) {
        // Retry logic para navegación robusta
        if (retries > 0 && (error.code === 'NETWORK_ERROR' || error.response?.status >= 500)) {
          logger.warn(`Retrying ingredients API call. Retries left: ${retries}`);
          await new Promise(resolve => setTimeout(resolve, 300));
          return apiService.ingredients.getAll(params, retries - 1);
        }
        throw error;
      }
    },
    getById: (id) => apiService.getById('ingredients', id),
    create: (data) => apiService.create('ingredients', data),
    update: (id, data) => apiService.update('ingredients', id, data),
    delete: (id) => apiService.delete('ingredients', id),
    updateStock: async (id, quantity, operation) => {
      const response = await api.post(`/ingredients/${id}/update_stock/`, { quantity, operation });
      return response.data;
    },
    importExcel: async (formData) => {
      const response = await axios.post('/import-ingredients/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
        withCredentials: true
      });
      return response.data;
    },
  },

  recipes: {
    getAll: async (params = {}, retries = 2) => {
      try {
        const queryParams = new URLSearchParams(params).toString();
        const url = queryParams ? `/recipes/?${queryParams}` : '/recipes/';
        const response = await api.get(url);
        return handlePaginatedResponse(response);
      } catch (error) {
        // Better network error handling
        const isNetworkError = (
          error.code === 'NETWORK_ERROR' || 
          error.code === 'ERR_NETWORK_CHANGED' ||
          error.message?.includes('Network Error') ||
          error.response?.status >= 500
        );
        
        // Errores específicos de conexión - manejar silenciosamente  
        if (error.code === 'ERR_NETWORK_CHANGED' || error.code === 'ERR_INTERNET_DISCONNECTED') {
          logger.warn(`${error.code} error on recipes - silent fail for polling`);
          throw new Error('NETWORK_ERROR_SILENT');
        }
        
        if (retries > 0 && isNetworkError) {
          logger.warn(`Network error on recipes API, retrying... (${retries} left)`);
          await new Promise(resolve => setTimeout(resolve, 1000 + (3 - retries) * 500));
          return apiService.recipes.getAll(params, retries - 1);
        }
        
        logger.error(`Recipes API Error:`, error.code, error.message);
        throw error;
      }
    },
    getById: (id) => apiService.getById('recipes', id),
    create: (data) => apiService.create('recipes', data),
    update: (id, data) => apiService.update('recipes', id, data),
    delete: (id) => apiService.delete('recipes', id),
    updatePrice: async (id) => {
      const response = await api.post(`/recipes/${id}/update_price/`);
      return response.data;
    },
    checkAvailability: async (id) => {
      const response = await api.get(`/recipes/${id}/check_availability/`);
      return response.data;
    },
    addIngredient: async (id, ingredient, quantity) => {
      const response = await api.post(`/recipes/${id}/add_ingredient/`, { ingredient, quantity });
      return response.data;
    },
    removeIngredient: async (id, ingredientId) => {
      const response = await api.delete(`/recipes/${id}/remove_ingredient/`, { data: { ingredient_id: ingredientId } });
      return response.data;
    },
    importExcel: async (formData) => {
      const response = await axios.post('/import-recipes/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
        withCredentials: true
      });
      return response.data;
    },
  },

  recipeItems: {
    getAll: () => apiService.getAll('recipe-items'),
    getById: (id) => apiService.getById('recipe-items', id),
    getByRecipe: async (recipeId) => {
      const response = await api.get(`/recipe-items/?recipe=${recipeId}`);
      return response.data;
    },
    create: (data) => apiService.create('recipe-items', data),
    update: (id, data) => apiService.update('recipe-items', id, data),
    delete: (id) => apiService.delete('recipe-items', id),
  },

  // Operation endpoints
  orders: {
    getAll: () => apiService.getAll('orders'),
    getById: (id) => apiService.getById('orders', id),
    get: (id) => apiService.getById('orders', id),
    create: (data) => apiService.create('orders', data),
    update: (id, data) => apiService.update('orders', id, data),
    patch: (id, data) => apiService.patch('orders', id, data),
    delete: (id) => apiService.delete('orders', id),
    cancel: async (id, cancellationReason) => {
      const response = await api.post(`/orders/${id}/cancel/`, {
        cancellation_reason: cancellationReason
      });
      return response.data;
    },
    updateStatus: async (id, status, cancellationReason = null) => {
      const data = { status };
      if (cancellationReason) {
        data.cancellation_reason = cancellationReason;
      }
      const response = await api.post(`/orders/${id}/update_status/`, data);
      return response.data;
    },
    checkPrintStatus: async (id) => {
      const response = await api.post(`/orders/${id}/check_print_status/`);
      return response.data;
    },
    addItem: async (id, itemData) => {
      const response = await api.post(`/orders/${id}/add_item/`, itemData);
      return response.data;
    },
    getActive: async () => {
      const response = await api.get('/orders/active/');
      return response.data;
    },
    getKitchenBoard: async () => {
      try {
        return await retryNetworkRequest(async () => {
          const response = await api.get('/orders/kitchen_board/', {
            timeout: 8000  // Shorter timeout for frequent polling
          });
          return response.data;
        });
      } catch (error) {
        if (error.message === 'NETWORK_ERROR_SILENT') {
          // Silent fail for network errors in polling
          return [];
        }
        throw error;
      }
    },
    getServed: async () => {
      const response = await api.get('/orders/served/');
      return response.data;
    },
    splitPayment: async (id, data) => {
      const response = await api.post(`/orders/${id}/split_payment/`, data);
      return response.data;
    },
    processPayment: async (id, paymentData) => {
      const response = await api.post(`/orders/${id}/process_payment/`, paymentData);
      return response.data;
    },
    processSplitPayment: async (id, splitData) => {
      const response = await api.post(`/orders/${id}/process_split_payment/`, splitData);
      return response.data;
    },
    resetAll: async () => {
      const response = await api.post('/orders/reset_all/');
      return response.data;
    },
    resetAllTables: async () => {
      const response = await api.post('/orders/reset_all_tables/');
      return response.data;
    },
    // Nuevos métodos para el flujo de 2 fases
    retryFailedPrints: async (id) => {
      const response = await api.post(`/orders/${id}/retry_failed_prints/`);
      return response.data;
    },
    getPrintStatus: async (id) => {
      const response = await api.get(`/orders/${id}/print_status/`);
      return response.data;
    },
  },

  orderItems: {
    getAll: () => apiService.getAll('order-items'),
    getById: (id) => apiService.getById('order-items', id),
    create: (data) => apiService.create('order-items', data),
    update: (id, data) => apiService.update('order-items', id, data),
    patch: (id, data) => apiService.patch('order-items', id, data),
    delete: (id) => apiService.delete('order-items', id),
    updateStatus: async (id, data) => {
      const response = await api.patch(`/order-items/${id}/`, data);
      return response.data;
    },
    cancel: async (id, cancellationReason) => {
      const response = await api.post(`/order-items/${id}/cancel/`, {
        cancellation_reason: cancellationReason
      });
      return response.data;
    },
    processPayment: async (id, paymentData) => {
      const response = await api.post(`/order-items/${id}/process_payment/`, paymentData);
      return response.data;
    },
    updateNotes: async (id, notes) => {
      const response = await api.patch(`/order-items/${id}/`, { notes });
      return response.data;
    },
    addIngredient: async (id, ingredient, quantity) => {
      const response = await api.post(`/order-items/${id}/add_ingredient/`, { ingredient, quantity });
      return response.data;
    },
    retryPrint: async (id) => {
      const response = await api.post(`/order-items/${id}/retry_print/`);
      return response.data;
    },
  },

  orderItemIngredients: {
    getAll: () => apiService.getAll('order-item-ingredients'),
    getById: (id) => apiService.getById('order-item-ingredients', id),
    create: (data) => apiService.create('order-item-ingredients', data),
    update: (id, data) => apiService.update('order-item-ingredients', id, data),
    delete: (id) => apiService.delete('order-item-ingredients', id),
  },

  payments: {
    getAll: () => apiService.getAll('payments'),
    getById: (id) => apiService.getById('payments', id),
    create: (data) => apiService.create('payments', data),
    update: (id, data) => apiService.update('payments', id, data),
    delete: (id) => apiService.delete('payments', id),
    markReceiptPrinted: async (paymentId) => {
      const response = await api.post(`/payments/${paymentId}/mark_receipt_printed/`);
      return response.data;
    },
    getDailySummary: async () => {
      const response = await api.get('/payments/daily_summary/');
      return response.data;
    },
    getOperationalSummary: async (date = null) => {
      const url = date ? `/payments/operational_summary/?date=${date}` : '/payments/operational_summary/';
      const response = await api.get(url);
      return response.data;
    },
    getDashboardData: async (date = null) => {
      const url = date ? `/payments/dashboard_data/?date=${date}` : '/payments/dashboard_data/';
      const response = await api.get(url);
      return response.data;
    },
  },


  // Dashboard Financiero endpoints - Vista optimizada con BD view
  dashboardFinanciero: {
    getReport: async (date = null, period = null) => {
      let url = '/dashboard-financiero/report/';
      const params = [];
      
      if (date) {
        params.push(`date=${date}`);
      }
      
      if (period) {
        params.push(`period=${period}`);
      }
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      
      const response = await api.get(url);
      return response.data;
    }
  },

  // Dashboard Operativo endpoints - Vista optimizada con BD view
  dashboardOperativo: {
    getReport: async (date = null) => {
      let url = '/dashboard-operativo/report/';
      
      if (date) {
        url += `?date=${date}`;
      }
      
      const response = await api.get(url);
      return response.data;
    },
    downloadExcel: async (date = null) => {
      const url = date ? `/dashboard-operativo/export_excel/?date=${date}` : '/dashboard-operativo/export_excel/';
      
      const response = await api.get(url, {
        responseType: 'blob',
        timeout: 30000 // 30 segundos para Excel pesado
      });
      
      // Verificar que la respuesta es un blob válido
      if (response.data.size === 0) {
        throw new Error('Archivo Excel vacío recibido del servidor');
      }
      
      // Detectar el tipo de archivo por el content-type
      const contentType = response.headers['content-type'] || '';
      const isExcel = contentType.includes('spreadsheet') || contentType.includes('excel');
      const isCsv = contentType.includes('csv') || contentType.includes('text');
      
      // Crear blob con el tipo correcto
      const blob = new Blob([response.data], {
        type: isExcel ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'
      });
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Nombre más descriptivo con fecha legible
      const dateStr = date || new Date().toISOString().split('T')[0];
      const [year, month, day] = dateStr.split('-');
      const extension = isExcel ? 'xlsx' : 'csv';
      link.download = `Dashboard_Operativo_${day}-${month}-${year}.${extension}`;
      
      // Asegurar que el link se descarga incluso en navegadores restrictivos
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup más robusto
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      }, 100);
      
      return response;
    }
  },

  // Debug endpoint
  debug: {
    checkAuth: async () => {
      const response = await api.get('/debug/auth/');
      return response.data;
    }
  },

  // Restaurant config endpoints
  restaurantConfig: {
    getAll: () => apiService.getAll('restaurant-config'),
    getById: (id) => apiService.getById('restaurant-config', id),
    create: (data) => apiService.create('restaurant-config', data),
    update: (id, data) => apiService.update('restaurant-config', id, data),
    delete: (id) => apiService.delete('restaurant-config', id),
    getActive: async () => {
      const response = await api.get('/restaurant-config/active/');
      return response.data;
    },
    activate: async (id) => {
      const response = await api.post(`/restaurant-config/${id}/activate/`);
      return response.data;
    },
    getOperationalInfo: async () => {
      const response = await api.get('/restaurant-config/operational_info/');
      return response.data;
    },
  },

  containers: {
    getAll: async (params = {}, retries = 2) => {
      try {
        const queryParams = new URLSearchParams(params).toString();
        const url = queryParams ? `/containers/?${queryParams}` : '/containers/';
        const response = await api.get(url);
        return handlePaginatedResponse(response);
      } catch (error) {
        // Retry logic para navegación robusta
        if (retries > 0 && (error.code === 'NETWORK_ERROR' || error.response?.status >= 500)) {
          logger.warn(`Retrying containers API call. Retries left: ${retries}`);
          await new Promise(resolve => setTimeout(resolve, 300));
          return apiService.containers.getAll(params, retries - 1);
        }
        throw error;
      }
    },
    getById: (id) => apiService.getById('containers', id),
    create: (data) => apiService.create('containers', data),
    update: (id, data) => apiService.update('containers', id, data),
    delete: (id) => apiService.delete('containers', id),
    importExcel: async (formData) => {
      const response = await axios.post('/import-containers/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
        withCredentials: true
      });
      return response.data;
    },
  },

  containerSales: {
    getAll: () => apiService.getAll('container-sales'),
    getById: (id) => apiService.getById('container-sales', id),
    create: (data) => apiService.create('container-sales', data),
    update: (id, data) => apiService.update('container-sales', id, data),
    delete: (id) => apiService.delete('container-sales', id),
  },

  // ===== NEW CART API =====
  carts: {
    getAll: () => apiService.getAll('carts'),
    getById: (sessionId) => apiService.getById('carts', sessionId),
    create: (data) => apiService.create('carts', data),
    update: (sessionId, data) => apiService.update('carts', sessionId, data),
    delete: (sessionId) => apiService.delete('carts', sessionId),
    
    // Get or create cart for session
    getOrCreate: async (sessionId, tableId, user = '') => {
      const response = await api.get(`/carts/get_or_create/?session_id=${sessionId}&table_id=${tableId}&user=${encodeURIComponent(user)}`);
      return response.data;
    },
    
    // Add item to cart
    addItem: async (sessionId, itemData) => {
      const response = await api.post(`/carts/${sessionId}/add_item/`, itemData);
      return response.data;
    },
    
    // Remove item from cart
    removeItem: async (sessionId, itemId) => {
      const response = await api.post(`/carts/${sessionId}/remove_item/`, { item_id: itemId });
      return response.data;
    },
    
    // Update item in cart
    updateItem: async (sessionId, itemId, itemData) => {
      const response = await api.post(`/carts/${sessionId}/update_item/`, { item_id: itemId, ...itemData });
      return response.data;
    },
    
    // Clear cart
    clear: async (sessionId) => {
      const response = await api.post(`/carts/${sessionId}/clear/`);
      return response.data;
    },
    
    // Convert cart to order
    convertToOrder: async (sessionId) => {
      const response = await api.post(`/carts/${sessionId}/convert_to_order/`, {});
      return response.data;
    }
  },

  cartItems: {
    getAll: (params = {}) => {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `/cart-items/?${queryParams}` : '/cart-items/';
      return api.get(url).then(response => response.data);
    },
    getById: (id) => apiService.getById('cart-items', id),
    create: (data) => apiService.create('cart-items', data),
    update: (id, data) => apiService.update('cart-items', id, data),
    delete: (id) => apiService.delete('cart-items', id),
  },

  // REMOVIDO: Print Queue - Ya no se usa con impresión USB directa


};

export default api;