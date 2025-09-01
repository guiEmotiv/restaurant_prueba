import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { logger } from '../utils/logger';
import { USER_ROLES } from '../utils/constants';
import { API_BASE_URL } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Check if we're in development mode
  const isDevelopmentMode = import.meta.env.VITE_DISABLE_COGNITO === 'true';
  
  const [user, setUser] = useState(isDevelopmentMode ? { username: 'dev-user' } : null);
  const [userRole, setUserRole] = useState(isDevelopmentMode ? USER_ROLES.ADMIN : null);
  const [loading, setLoading] = useState(false); // ✅ Start as false, LoginForm will handle loading
  const [isAuthenticated, setIsAuthenticated] = useState(isDevelopmentMode);

  // Use centralized user roles
  const ROLES = USER_ROLES;

  const PERMISSIONS = {
    [ROLES.ADMIN]: {
      canViewDashboard: true,
      canManageConfig: true,
      canManageInventory: true,
      canManageOrders: true,
      canViewOrders: true,
      canViewKitchen: true,
      canViewTableStatus: true,
      canManagePayments: true,
      canViewHistory: true,
    },
    [ROLES.WAITER]: {
      canViewDashboard: false,
      canManageConfig: false,
      canManageInventory: false,
      canManageOrders: true,      // Necesario para crear/modificar pedidos desde Estado Mesas
      canViewOrders: true,
      canViewKitchen: false,
      canViewTableStatus: true,
      canManagePayments: false,   // SOLO administradores y cajeros pueden procesar pagos
      canViewHistory: false,
    },
    [ROLES.COOK]: {
      canViewDashboard: false,
      canManageConfig: false,
      canManageInventory: false,
      canManageOrders: false,
      canViewOrders: false,
      canViewKitchen: true,
      canViewTableStatus: false,
      canManagePayments: false,
      canViewHistory: false,
    },
    [ROLES.CASHIER]: {
      canViewDashboard: false,
      canManageConfig: false,
      canManageInventory: false,
      canManageOrders: true,      // Pueden ver/procesar pedidos para pagos
      canViewOrders: true,        // Necesario para ver pedidos a pagar
      canViewKitchen: false,
      canViewTableStatus: true,   // Pueden ver estado de mesas para operaciones
      canManagePayments: true,    // Función principal de cajeros
      canViewHistory: true,       // Pueden ver historial de transacciones
    }
  };

  const getUserRole = async (user) => {
    try {
      const session = await fetchAuthSession();
      
      // Try to get groups from access token
      const accessTokenPayload = session.tokens?.accessToken?.payload;
      
      // Also check ID token for groups
      const idTokenPayload = session.tokens?.idToken?.payload;
      
      // Try both tokens for groups
      const groups = accessTokenPayload?.['cognito:groups'] || 
                    idTokenPayload?.['cognito:groups'] || 
                    [];
      
      // Check which group the user belongs to
      if (groups.includes(ROLES.ADMIN)) {
        return ROLES.ADMIN;
      } else if (groups.includes(ROLES.WAITER)) {
        return ROLES.WAITER;
      } else if (groups.includes(ROLES.COOK)) {
        return ROLES.COOK;
      } else if (groups.includes(ROLES.CASHIER)) {
        return ROLES.CASHIER;
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const checkAuthState = async () => {
    try {
      setLoading(true);
      
      // Skip Cognito authentication in development mode
      if (isDevelopmentMode) {
        console.log('🔧 Development mode: Bypassing Cognito authentication');
        setUser({ username: 'dev-user' });
        setUserRole(USER_ROLES.ADMIN);
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }
      
      // Add a small delay to ensure session is fully established
      await new Promise(resolve => setTimeout(resolve, 500));
      const currentUser = await getCurrentUser();
      
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
        
        // Get user role from Cognito groups
        const role = await getUserRole(currentUser);
        setUserRole(role);
        
      } else {
        setUser(null);
        setUserRole(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      setUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ✅ NO ejecutar checkAuthState inmediatamente
    // Esperar a que LoginForm/Authenticator maneje la autenticación
    
    // Listen for custom authentication success event
    const handleAuthSuccess = (event) => {
      setTimeout(() => {
        checkAuthState();
      }, 500);
    };
    
    window.addEventListener('cognitoAuthSuccess', handleAuthSuccess);
    
    // EMERGENCY FIX: También ejecutar checkAuthState después de un delay
    // en caso de que el evento se pierda
    setTimeout(() => {
      checkAuthState();
    }, 2000);
    
    // Listen for authentication events from Hub
    const hubListenerCancel = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signInWithRedirect':
        case 'signedIn':
          setTimeout(() => {
            checkAuthState();
          }, 1000);
          break;
        case 'signedOut':
          setUser(null);
          setUserRole(null);
          setIsAuthenticated(false);
          setLoading(false);
          break;
        case 'tokenRefresh':
          setTimeout(() => {
            checkAuthState();
          }, 500);
          break;
        default:
          break;
      }
    });

    return () => {
      window.removeEventListener('cognitoAuthSuccess', handleAuthSuccess);
      hubListenerCancel();
    };
  }, []);

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
      window.location.reload(); // Force page reload to clear any cached data
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const hasPermission = (permission) => {
    if (!userRole || !PERMISSIONS[userRole]) {
      return false;
    }
    return PERMISSIONS[userRole][permission] || false;
  };

  const isAdmin = () => userRole === ROLES.ADMIN;
  const isWaiter = () => userRole === ROLES.WAITER;
  const isCook = () => userRole === ROLES.COOK;
  const isCashier = () => userRole === ROLES.CASHIER;

  const refreshAuth = async () => {
    await checkAuthState();
  };

  const getDefaultRoute = () => {
    if (!userRole) return '/';
    
    // Return default route based on user role
    switch (userRole) {
      case ROLES.ADMIN:
        return '/';  // Dashboard Operativo
      case ROLES.WAITER:
        return '/operations';  // Gestión de Mesas
      case ROLES.COOK:
        return '/kitchen';  // Cocina
      case ROLES.CASHIER:
        return '/operations';  // Vista de operaciones para procesar pagos
      default:
        return '/';
    }
  };

  const value = {
    user,
    userRole,
    loading,
    isAuthenticated,
    isAdmin,
    isWaiter,
    isCook,
    isCashier,
    hasPermission,
    logout,
    refreshAuth,
    getDefaultRoute,
    ROLES,
    PERMISSIONS
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};


export default AuthContext;