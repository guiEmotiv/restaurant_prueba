import axios from 'axios';
import { logger } from '../utils/logger';
import { API_CONFIG } from '../utils/constants';

// Determine API URL based on environment
let API_BASE_URL;
if (import.meta.env.VITE_API_URL) {
  // Use explicit environment variable if set
  API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/v1`;
} else if (import.meta.env.MODE === 'production') {
  // In production, assume API is on same host
  API_BASE_URL = `${window.location.origin}/api/v1`;
} else {
  // Development mode - use localhost
  API_BASE_URL = 'http://localhost:8000/api/v1';
}

// Log API configuration (solo en desarrollo)
logger.info('API Configuration:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
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
  timeout: API_CONFIG.TIMEOUT
});

// Export API_BASE_URL for use in other components
export { API_BASE_URL };


// Add request interceptor for authentication
api.interceptors.request.use(
  async (config) => {
    logger.api(config.method?.toUpperCase(), config.url, config.data);
    
    // Add JWT token for authentication
    try {
      // Try to get auth session from AWS Amplify
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      
      // IMPORTANTE: Usar ID Token en lugar de Access Token para obtener grupos
      // El ID Token incluye los grupos del usuario (cognito:groups)
      if (session.tokens?.idToken) {
        config.headers.Authorization = `Bearer ${session.tokens.idToken}`;
        console.log('🔐 Added ID Token to request (includes user groups)');
      } else if (session.tokens?.accessToken) {
        // Fallback to access token if ID token not available
        config.headers.Authorization = `Bearer ${session.tokens.accessToken}`;
        console.log('⚠️ Using Access Token (may not include groups)');
      } else {
        console.log('ℹ️ No tokens available in session');
      }
    } catch (error) {
      // If not authenticated or error getting token, continue without auth
      console.log('ℹ️ No auth token available:', error.message);
    }
    
    return config;
  },
  (error) => {
    console.error('🚨 Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    console.log('  Response data type:', typeof response.data);
    console.log('  Has results field:', response.data?.results !== undefined);
    // DON'T modify the response here - let handlePaginatedResponse handle it
    return response;
  },
  (error) => {
    console.error('🚨 API Error Details:');
    console.error('  URL:', error.config?.url);
    console.error('  Method:', error.config?.method?.toUpperCase());
    console.error('  Full URL:', error.config?.baseURL + error.config?.url);
    console.error('  Status:', error.response?.status);
    console.error('  Error:', error.message);
    console.error('  Response:', error.response?.data);
    
    // Handle authentication errors - DON'T auto-reload
    if (error.response?.status === 401) {
      console.log('🚨 Authentication failed - user needs to login again');
      console.log('⚠️ Token may be expired or invalid');
      // Just log the error, let the auth context handle the flow
    }
    
    // Handle CORS or network errors
    if (!error.response) {
      console.error('🚨 Network error - server may be unreachable');
    }
    
    return Promise.reject(error);
  }
);

// Helper function to handle paginated responses
const handlePaginatedResponse = (response) => {
  console.log('🔍 Raw API Response:', response.data);
  console.log('  Response type:', typeof response.data);
  console.log('  Is Array:', Array.isArray(response.data));
  
  // Handle paginated response
  if (response.data && typeof response.data === 'object' && response.data.results !== undefined) {
    console.log('📋 Paginated response detected');
    console.log('  Results:', response.data.results);
    console.log('  Count:', response.data.count);
    console.log('  Next:', response.data.next);
    return response.data.results;
  }
  
  // Direct array response
  if (Array.isArray(response.data)) {
    console.log('📋 Direct array response:', response.data.length, 'items');
    return response.data;
  }
  
  // Fallback
  console.warn('⚠️ Unexpected response format, returning empty array');
  return [];
};

// API service functions
export const apiService = {
  // Generic CRUD operations
  async getAll(endpoint) {
    const response = await api.get(`/${endpoint}/`);
    return handlePaginatedResponse(response);
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
      const response = await axios.post('http://localhost:8000/import-units/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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
      const response = await axios.post('http://localhost:8000/import-zones/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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
      const response = await axios.post('http://localhost:8000/import-tables/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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
      const response = await axios.post('http://localhost:8000/import-groups/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
  },

  ingredients: {
    getAll: async (params = {}) => {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `/ingredients/?${queryParams}` : '/ingredients/';
      const response = await api.get(url);
      return handlePaginatedResponse(response);
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
      const response = await axios.post('http://localhost:8000/import-ingredients/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
  },

  recipes: {
    getAll: async (params = {}) => {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `/recipes/?${queryParams}` : '/recipes/';
      const response = await api.get(url);
      return response.data;
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
      const response = await axios.post('http://localhost:8000/import-recipes/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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
    getReport: async (date = null) => {
      const url = date ? `/dashboard/report/?date=${date}` : '/dashboard/report/';
      const response = await api.get(url);
      return response.data;
    },
    downloadExcel: async (date = null) => {
      const url = date ? `/dashboard/export_excel/?date=${date}` : '/dashboard/export_excel/';
      const response = await api.get(url, {
        responseType: 'blob'
      });
      
      // Crear enlace de descarga
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `dashboard_ventas_${date || new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      
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
    getAll: async (params = {}) => {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `/containers/?${queryParams}` : '/containers/';
      const response = await api.get(url);
      console.log('🔍 CONTAINERS Raw response:', response.data);
      // Return data directly since pagination is disabled
      return Array.isArray(response.data) ? response.data : [];
    },
    getById: (id) => apiService.getById('containers', id),
    create: (data) => apiService.create('containers', data),
    update: (id, data) => apiService.update('containers', id, data),
    delete: (id) => apiService.delete('containers', id),
    importExcel: async (formData) => {
      const response = await axios.post('http://localhost:8000/import-containers/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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