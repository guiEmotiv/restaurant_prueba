import axios from 'axios';

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

// Debug log to see what URL is being used
console.log('🔍 API Configuration Debug:');
console.log('  VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('  API_BASE_URL:', API_BASE_URL);
console.log('  MODE:', import.meta.env.MODE);
console.log('  PROD:', import.meta.env.PROD);
console.log('  Timestamp:', new Date().toISOString());

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});


// Add request interceptor for authentication and debugging
api.interceptors.request.use(
  async (config) => {
    const timestamp = new Date().toISOString();
    console.log(`[⚖️ ${timestamp}] 📡 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    
    // Store API request logs
    const apiLogs = JSON.parse(sessionStorage.getItem('api-debug-logs') || '[]');
    apiLogs.push({
      timestamp,
      type: 'request',
      method: config.method?.toUpperCase(),
      url: `${config.baseURL}${config.url}`,
      headers: config.headers
    });
    sessionStorage.setItem('api-debug-logs', JSON.stringify(apiLogs.slice(-50)));
    
    // Add JWT token for authentication
    try {
      // Try to get auth session from AWS Amplify
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      
      if (session.tokens?.accessToken) {
        config.headers.Authorization = `Bearer ${session.tokens.accessToken}`;
        console.log('🔐 Added JWT token to request');
      } else {
        console.log('ℹ️ No access token available in session');
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

// Add response interceptor to handle pagination
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    // If the response has a 'results' field, it's paginated
    if (response.data && response.data.results !== undefined) {
      return { ...response, data: response.data.results };
    }
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
  // Handle paginated response
  if (response.data && typeof response.data === 'object' && response.data.results) {
    console.log('📋 Extracted results:', response.data.results);
    return response.data.results;
  }
  const fallback = Array.isArray(response.data) ? response.data : [];
  console.log('📋 Using fallback:', fallback);
  return fallback;
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
  },

};

export default api;