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
  // ALWAYS use AWS Cognito - no development mode bypass
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
      canProcessPayment: true,
      canViewHistory: true,
    },
    [ROLES.WAITER]: {
      canViewDashboard: false,
      canManageConfig: false,
      canManageInventory: false,
      canManageOrders: true,      // Función principal de meseros - gestión de pedidos
      canViewOrders: true,
      canViewKitchen: false,
      canViewTableStatus: true,   // Necesario para ver estado de mesas
      canManagePayments: false,   // SOLO administradores y cajeros pueden procesar pagos
      canProcessPayment: false,   // NO pueden procesar pagos
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
      canManageOrders: false,     // NO pueden gestionar pedidos/mesas - solo pagos
      canViewOrders: false,       // NO necesitan ver gestión de pedidos
      canViewKitchen: false,
      canViewTableStatus: false,  // NO pueden ver gestión de mesas
      canManagePayments: true,    // Función principal de cajeros
      canProcessPayment: true,    // Pueden procesar pagos
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
      console.log('🔐 [DEBUG] AuthContext - checkAuthState iniciado');
      setLoading(true);
      
      // Add a small delay to ensure session is fully established
      await new Promise(resolve => setTimeout(resolve, 500));
      const currentUser = await getCurrentUser();
      
      if (currentUser) {
        console.log('✅ [DEBUG] AuthContext - usuario encontrado:', currentUser.username);
        setUser(currentUser);
        setIsAuthenticated(true);
        
        // Get user role from Cognito groups
        const role = await getUserRole(currentUser);
        console.log('👤 [DEBUG] AuthContext - rol obtenido:', role);
        setUserRole(role);
        
      } else {
        console.log('❌ [DEBUG] AuthContext - usuario no encontrado');
        setUser(null);
        setUserRole(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('💥 [DEBUG] AuthContext - error en checkAuthState:', error);
      setUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
    } finally {
      console.log('🏁 [DEBUG] AuthContext - checkAuthState completado, loading=false');
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔄 [DEBUG] AuthContext - useEffect ejecutado, configurando listeners');
    
    // Solo ejecutar checkAuthState una vez al inicio
    let hasCheckedAuth = false;
    
    const performInitialCheck = () => {
      if (!hasCheckedAuth) {
        console.log('🎯 [DEBUG] AuthContext - ejecutando checkAuthState inicial único');
        hasCheckedAuth = true;
        checkAuthState();
      } else {
        console.log('⚠️ [DEBUG] AuthContext - checkAuthState saltado, ya ejecutado');
      }
    };
    
    // Ejecutar check inicial después de un delay mínimo
    const initialTimeout = setTimeout(performInitialCheck, 1000);
    
    // Listen for authentication events from Hub (sin múltiples checkAuthState)
    const hubListenerCancel = Hub.listen('auth', ({ payload }) => {
      console.log('📡 [DEBUG] AuthContext - Hub event recibido:', payload.event);
      
      switch (payload.event) {
        case 'signedOut':
          console.log('👋 [DEBUG] AuthContext - usuario deslogueado');
          setUser(null);
          setUserRole(null);
          setIsAuthenticated(false);
          setLoading(false);
          break;
        case 'tokenRefresh':
          console.log('🔄 [DEBUG] AuthContext - token refreshed, pero NO ejecutar checkAuthState');
          // No ejecutar checkAuthState en token refresh para evitar bucles
          break;
        default:
          console.log('ℹ️ [DEBUG] AuthContext - evento Hub ignorado:', payload.event);
          break;
      }
    });

    return () => {
      console.log('🧹 [DEBUG] AuthContext - limpiando listeners');
      clearTimeout(initialTimeout);
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
    // All users go to welcome page initially
    return '/';
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