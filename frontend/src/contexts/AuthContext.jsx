import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { API_BASE_URL } from '../services/api';

console.log('🔧 AuthContext Enhanced - Using shared API instance from services/api.js');

// Helper function to get CSRF token from cookies
const getCSRFToken = () => {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrftoken') {
      return value;
    }
  }
  return null;
};

// Helper function to ensure CSRF token is available
const ensureCSRFToken = async () => {
  let token = getCSRFToken();
  if (!token) {
    console.log('🔐 No CSRF token found, fetching new one...');
    try {
      await api.get('/csrf/');
      token = getCSRFToken();
      console.log('✅ CSRF token obtained:', token ? 'Yes' : 'No');
    } catch (error) {
      console.error('❌ Error fetching CSRF token:', error);
    }
  }
  return token;
};

// Enhanced User roles for the restaurant system
const USER_ROLES = {
  ADMIN: 'Administradores',
  MANAGER: 'Gerentes',
  WAITER: 'Meseros',
  COOK: 'Cocineros',
  CASHIER: 'Cajeros'
};

// Request interceptor for enhanced logging and CSRF handling
api.interceptors.request.use(
  async (config) => {
    console.log(`📤 API Request: ${config.method?.toUpperCase()} ${config.url}`);

    // For POST, PUT, PATCH, DELETE requests, ensure CSRF token is set
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
      await ensureCSRFToken();
      const token = getCSRFToken();
      if (token) {
        config.headers['X-CSRFToken'] = token;
        console.log('🛡️ CSRF token added to request');
      } else {
        console.warn('⚠️ No CSRF token available for request');
      }
    }

    return config;
  },
  (error) => {
    console.error('📤 Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for enhanced error handling
api.interceptors.response.use(
  (response) => {
    console.log(`📥 API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`📥 Response Error: ${error.response?.status || 'Network'} ${error.config?.url}`, error.response?.data);

    // Handle session expiration
    if (error.response?.status === 401) {
      console.warn('🚨 Session expired - clearing authentication state');
      // We'll handle this in the context
    }

    return Promise.reject(error);
  }
);

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [error, setError] = useState(null);

  // Use centralized user roles
  const ROLES = USER_ROLES;

  const PERMISSIONS = {
    [ROLES.ADMIN]: {
      canManageUsers: true,
      canViewAdmin: true,
      canAccessDashboard: true,
      canCreateOrders: true,
      canProcessPayments: true,
      canManageKitchen: true,
      canManageInventory: true,
      canViewReports: true,
      canManageConfig: true
    },
    [ROLES.MANAGER]: {
      canManageUsers: false,
      canViewAdmin: false,
      canAccessDashboard: true,
      canCreateOrders: true,
      canProcessPayments: true,
      canManageKitchen: true,
      canManageInventory: true,
      canViewReports: true,
      canManageConfig: false
    },
    [ROLES.WAITER]: {
      canManageUsers: false,
      canViewAdmin: false,
      canAccessDashboard: false,
      canCreateOrders: true,
      canProcessPayments: false,
      canManageKitchen: false,
      canManageInventory: false,
      canViewReports: false,
      canManageConfig: false
    },
    [ROLES.COOK]: {
      canManageUsers: false,
      canViewAdmin: false,
      canAccessDashboard: false,
      canCreateOrders: false,
      canProcessPayments: false,
      canManageKitchen: true,
      canManageInventory: false,
      canViewReports: false,
      canManageConfig: false
    },
    [ROLES.CASHIER]: {
      canManageUsers: false,
      canViewAdmin: false,
      canAccessDashboard: false,
      canCreateOrders: false,
      canProcessPayments: true,
      canManageKitchen: false,
      canManageInventory: false,
      canViewReports: false,
      canManageConfig: false
    }
  };

  // Helper function to get user permissions
  const getUserPermissions = useCallback((userData) => {
    if (!userData || !userData.groups || userData.groups.length === 0) {
      return {};
    }

    // Use the permissions from the backend if available
    if (userData.permissions) {
      return userData.permissions;
    }

    // Fallback to role-based permissions
    const userGroup = userData.groups[0]; // Use first group as primary role
    return PERMISSIONS[userGroup] || {};
  }, [PERMISSIONS]);

  // Enhanced error handling
  const handleError = useCallback((error, context = 'Unknown') => {
    console.error(`🚨 Auth Error in ${context}:`, error);

    if (error.response?.data?.error) {
      setError(error.response.data.error);
    } else if (error.message) {
      setError(error.message);
    } else {
      setError('Error de conexión');
    }

    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  }, []);

  // Check authentication status
  const checkAuthStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Checking authentication status...');
      const response = await api.get('/auth/status/');

      if (response.data.authenticated) {
        const userData = response.data.user;
        const sessionData = response.data.session;

        console.log('✅ User authenticated:', userData.username);

        setUser(userData);
        setUserRole(userData.groups?.[0] || null);
        setIsAuthenticated(true);
        setSessionInfo(sessionData);
      } else {
        console.log('❌ User not authenticated');
        setUser(null);
        setUserRole(null);
        setIsAuthenticated(false);
        setSessionInfo(null);
      }
    } catch (error) {
      console.error('🚨 Auth status check failed:', error);
      setUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
      setSessionInfo(null);
      handleError(error, 'checkAuthStatus');
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // Enhanced login function
  const login = useCallback(async (username, password) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`🔐 Attempting login for user: ${username}`);

      // Ensure we have a CSRF token before attempting login
      await ensureCSRFToken();

      const response = await api.post('/auth/login/', {
        username: username.trim(),
        password
      });

      if (response.data.success) {
        const userData = response.data.user;

        console.log('✅ Login successful:', userData.username);
        console.log('👤 User groups:', userData.groups);
        console.log('🔐 User permissions:', userData.permissions);

        setUser(userData);
        setUserRole(userData.groups?.[0] || null);
        setIsAuthenticated(true);

        // Store session info if provided
        if (response.data.session_id) {
          setSessionInfo({ session_id: response.data.session_id });
        }

        return {
          success: true,
          message: response.data.message,
          user: userData
        };
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (error) {
      console.error('🚨 Login failed:', error);
      handleError(error, 'login');

      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Error de login'
      };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // Enhanced logout function
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🚪 Attempting logout...');

      const response = await api.post('/auth/logout/');

      if (response.data.success) {
        console.log('✅ Logout successful:', response.data.message);

        // Clear all authentication state
        setUser(null);
        setUserRole(null);
        setIsAuthenticated(false);
        setSessionInfo(null);

        return {
          success: true,
          message: response.data.message
        };
      } else {
        throw new Error(response.data.error || 'Logout failed');
      }
    } catch (error) {
      console.error('🚨 Logout error:', error);

      // Even if logout fails on server, clear local state
      setUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
      setSessionInfo(null);

      handleError(error, 'logout');

      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Error al cerrar sesión'
      };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // Change password function
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔐 Attempting password change...');

      const response = await api.post('/auth/change-password/', {
        current_password: currentPassword,
        new_password: newPassword
      });

      if (response.data.success) {
        console.log('✅ Password changed successfully');

        // Update user data if provided
        if (response.data.user) {
          setUser(response.data.user);
        }

        return {
          success: true,
          message: response.data.message
        };
      } else {
        throw new Error(response.data.error || 'Password change failed');
      }
    } catch (error) {
      console.error('🚨 Password change failed:', error);
      handleError(error, 'changePassword');

      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Error cambiando contraseña'
      };
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // Permission checking functions
  const hasPermission = useCallback((permission) => {
    if (!user) return false;

    const permissions = getUserPermissions(user);
    return permissions[permission] === true;
  }, [user, getUserPermissions]);

  const hasRole = useCallback((role) => {
    if (!user || !user.groups) return false;
    return user.groups.includes(role);
  }, [user]);

  const hasAnyRole = useCallback((roles) => {
    if (!user || !user.groups) return false;
    return roles.some(role => user.groups.includes(role));
  }, [user]);

  // Initialize authentication status on mount
  useEffect(() => {
    console.log('🚀 AuthContext initializing...');

    // Initialize CSRF token and check auth status
    const initializeAuth = async () => {
      await ensureCSRFToken();
      await checkAuthStatus();
    };

    initializeAuth();
  }, [checkAuthStatus]);

  // Context value
  const contextValue = {
    // State
    user,
    userRole,
    loading,
    isAuthenticated,
    sessionInfo,
    error,

    // Functions
    login,
    logout,
    changePassword,
    checkAuthStatus,

    // Permission helpers
    hasPermission,
    hasRole,
    hasAnyRole,
    getUserPermissions: () => getUserPermissions(user),

    // Constants
    ROLES,
    PERMISSIONS,

    // Utility
    clearError: () => setError(null)
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Export API instance for use in other components
export { api };

export default AuthContext;