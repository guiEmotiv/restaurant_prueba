import axios from 'axios';
import { logger } from '../utils/logger';
import { API_CONFIG } from '../utils/constants';

// Determine API URL based on environment
let API_BASE_URL;
if (import.meta.env.VITE_API_BASE_URL) {
  // Use explicit environment variable if set
  API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
} else if (import.meta.env.MODE === 'production') {
  // In production, assume API is on same host
  API_BASE_URL = `${window.location.origin}/api/v1`;
} else {
  // Development mode - use same host as frontend but port 8000
  const hostname = window.location.hostname;
  API_BASE_URL = `http://${hostname}:8000/api/v1`;
}

// API configurado silenciosamente
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

// Export API_BASE_URL for use in other components
export { API_BASE_URL };

// Debug function for authentication
export const debugAuth = async () => {
  try {
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const session = await fetchAuthSession();
    
    return session;
  } catch (error) {
    return null;
  }
};

// Make debug function available globally in development and production
window.debugAuth = debugAuth;

// Add global debugging function to test API with current auth
window.testApiAuth = async () => {
  try {
    const response = await api.get('/auth-debug/');
    return response.data;
  } catch (error) {
    return { error: error.message };
  }
};


// Get CSRF token function
const getCSRFToken = async () => {
  try {
    // Check if token is already in cookies
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
    
    if (token) return token;
    
    // If not in cookies, get from main server (not API)
    const baseUrl = API_BASE_URL.replace('/api/v1', '');
    const response = await fetch(`${baseUrl}/csrf/`, {
      credentials: 'include'
    });
    const data = await response.json();
    return data.csrfToken;
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
    
    // Add JWT token for authentication
    try {
      // Try to get auth session from AWS Amplify
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      
      logger.info('🔐 Auth Debug:', {
        hasTokens: !!session.tokens,
        hasIdToken: !!session.tokens?.idToken,
        hasAccessToken: !!session.tokens?.accessToken,
        url: config.url
      });
      
      // IMPORTANTE: Usar ID Token en lugar de Access Token para obtener grupos
      // El ID Token incluye los grupos del usuario (cognito:groups)
      if (session.tokens?.idToken) {
        config.headers.Authorization = `Bearer ${session.tokens.idToken}`;
        logger.info('✅ ID Token attached to request');
      } else if (session.tokens?.accessToken) {
        // Fallback to access token if ID token not available
        config.headers.Authorization = `Bearer ${session.tokens.accessToken}`;
        logger.info('✅ Access Token attached to request');
      } else {
        logger.warn('❌ No auth tokens available');
      }
    } catch (error) {
      logger.error('❌ Auth error:', error);
      // If not authenticated or error getting token, continue without auth
    }
    
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
      // Retry en caso de error de red durante navegación
      if (retries > 0 && (error.code === 'NETWORK_ERROR' || error.response?.status >= 500)) {
        logger.warn(`Retrying ${endpoint} API call. Retries left: ${retries}`);
        await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
        return this.getAll(endpoint, retries - 1);
      }
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
      const baseUrl = API_BASE_URL.replace('/api/v1', '');
      const response = await axios.post(`${baseUrl}/import-units/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
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
      const baseUrl = API_BASE_URL.replace('/api/v1', '');
      const response = await axios.post(`${baseUrl}/import-zones/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
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
      const baseUrl = API_BASE_URL.replace('/api/v1', '');
      const response = await axios.post(`${baseUrl}/import-tables/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
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
      const baseUrl = API_BASE_URL.replace('/api/v1', '');
      const response = await axios.post(`${baseUrl}/import-groups/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
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
      const baseUrl = API_BASE_URL.replace('/api/v1', '');
      const response = await axios.post(`${baseUrl}/import-ingredients/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
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
        // Retry logic para navegación robusta
        if (retries > 0 && (error.code === 'NETWORK_ERROR' || error.response?.status >= 500)) {
          logger.warn(`Retrying recipes API call. Retries left: ${retries}`);
          await new Promise(resolve => setTimeout(resolve, 300));
          return apiService.recipes.getAll(params, retries - 1);
        }
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
      // Use direct axios to bypass API base path since import endpoints are at root level
      const baseUrl = API_BASE_URL.replace('/api/v1', ''); // Remove /api/v1 from base URL
      const response = await axios.post(`${baseUrl}/import-recipes/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 seconds for file upload
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
    create: (data) => apiService.create('orders', data),
    update: (id, data) => apiService.update('orders', id, data),
    patch: (id, data) => apiService.patch('orders', id, data),
    delete: (id) => apiService.delete('orders', id),
    updateStatus: async (id, status) => {
      const response = await api.post(`/orders/${id}/update_status/`, { status });
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
    getKitchen: async () => {
      const response = await api.get('/orders/kitchen/');
      return response.data;
    },
    getKitchenBoard: async () => {
      const response = await api.get('/orders/kitchen_board/');
      return response.data;
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
  },

  orderItems: {
    getAll: () => apiService.getAll('order-items'),
    getById: (id) => apiService.getById('order-items', id),
    create: (data) => apiService.create('order-items', data),
    update: (id, data) => apiService.update('order-items', id, data),
    patch: (id, data) => apiService.patch('order-items', id, data),
    delete: (id) => apiService.delete('order-items', id),
    updateStatus: async (id, status) => {
      const response = await api.post(`/order-items/${id}/update_status/`, { status });
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

  // Dashboard endpoints
  dashboard: {
    getReport: async (date = null, period = null) => {
      let url = '/dashboard/report/';
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
    },
    downloadExcel: async (date = null) => {
      const url = date ? `/dashboard/export_excel/?date=${date}` : '/dashboard/export_excel/';
      
      const response = await api.get(url, {
        responseType: 'blob',
        timeout: 30000 // 30 segundos para Excel pesado
      });
      
      // Verificar que la respuesta es un blob válido
      if (response.data.size === 0) {
        throw new Error('Archivo Excel vacío recibido del servidor');
      }
      
      // Crear enlace de descarga con mejor naming
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Nombre más descriptivo con fecha legible
      const dateStr = date || new Date().toISOString().split('T')[0];
      const [year, month, day] = dateStr.split('-');
      link.download = `Dashboard_Ventas_${day}-${month}-${year}.xlsx`;
      
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
      const baseUrl = API_BASE_URL.replace('/api/v1', '');
      const response = await axios.post(`${baseUrl}/import-containers/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
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

};

export default api;