import { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is authenticated on app load
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setLoading(false);
        return;
      }

      // Set token in API service
      apiService.setAuthToken(token);
      
      // Verify token with backend
      const userData = await apiService.auth.getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      // Clear invalid token
      localStorage.removeItem('authToken');
      apiService.setAuthToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await apiService.auth.login(username, password);
      const { token, user: userData, message } = response;

      // Store token
      localStorage.setItem('authToken', token);
      apiService.setAuthToken(token);

      // Update state
      setUser(userData);
      setIsAuthenticated(true);

      return { success: true, message, user: userData };
    } catch (error) {
      console.error('Login failed:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error de autenticación' 
      };
    }
  };

  const logout = async () => {
    try {
      await apiService.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state regardless of API success
      localStorage.removeItem('authToken');
      apiService.setAuthToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const hasRole = (role) => {
    return user?.role === role;
  };

  const canAccessView = (viewName) => {
    return user?.allowed_views?.includes(viewName) || false;
  };

  const isAdmin = () => hasRole('admin');
  const isMesero = () => hasRole('mesero');
  const isCajero = () => hasRole('cajero');

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    hasRole,
    canAccessView,
    isAdmin,
    isMesero,
    isCajero,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};