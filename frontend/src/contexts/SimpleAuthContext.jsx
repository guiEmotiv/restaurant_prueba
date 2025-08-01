import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';

const SimpleAuthContext = createContext();

export const useAuth = () => {
  const context = useContext(SimpleAuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a SimpleAuthProvider');
  }
  return context;
};

export const SimpleAuthProvider = ({ children }) => {
  const logWithTimestamp = (message, data) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data);
    const logs = JSON.parse(sessionStorage.getItem('auth-debug-logs') || '[]');
    logs.push({ timestamp, message, data });
    sessionStorage.setItem('auth-debug-logs', JSON.stringify(logs.slice(-50)));
  };
  
  logWithTimestamp('🔐 SimpleAuthProvider rendering...', {
    childrenType: typeof children,
    hasChildren: !!children
  });
  
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  
  console.log('🔐 SimpleAuthProvider - user:', user?.username, 'loading:', loading);

  // Define user roles and their permissions
  const ROLES = {
    ADMIN: 'administradores',
    WAITER: 'meseros',
    COOK: 'cocineros'
  };

  const PERMISSIONS = {
    [ROLES.ADMIN]: {
      // Administradores: Acceso a TODAS las vistas
      canViewDashboard: true,
      canManageConfig: true,
      canManageInventory: true,
      canManageOrders: true,
      canViewKitchen: true,
      canViewTableStatus: true,
      canManagePayments: true,
      canViewHistory: true,
    },
    [ROLES.WAITER]: {
      // Meseros: Solo estado de mesas e historial
      canViewDashboard: false,
      canManageConfig: false,
      canManageInventory: false,
      canManageOrders: true,
      canViewKitchen: false,
      canViewTableStatus: true, // Vista principal para meseros
      canManagePayments: true,
      canViewHistory: true, // Vista secundaria para meseros
    },
    [ROLES.COOK]: {
      // Cocineros: Solo vista de cocina
      canViewDashboard: false,
      canManageConfig: false,
      canManageInventory: false,
      canManageOrders: false,
      canViewKitchen: true, // ÚNICA vista para cocineros
      canViewTableStatus: false,
      canManagePayments: false,
      canViewHistory: false,
    }
  };

  // Get user role from Cognito groups
  useEffect(() => {
    const getUserRole = async () => {
      if (!user) {
        setUserRole(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('🔍 Getting user role for:', user.username);
        
        const session = await fetchAuthSession();
        console.log('📋 Full session:', session);
        console.log('📋 Access token payload:', session.tokens?.accessToken?.payload);
        const groups = session.tokens?.accessToken?.payload?.['cognito:groups'] || [];
        logWithTimestamp('🔍 User groups from token:', groups);
        
        if (Array.isArray(groups)) {
          if (groups.includes(ROLES.ADMIN)) {
            logWithTimestamp('✅ User is admin', { username: user.username });
            setUserRole(ROLES.ADMIN);
          } else if (groups.includes(ROLES.WAITER)) {
            logWithTimestamp('✅ User is waiter', { username: user.username });
            setUserRole(ROLES.WAITER);
          } else if (groups.includes(ROLES.COOK)) {
            logWithTimestamp('✅ User is cook', { username: user.username });
            setUserRole(ROLES.COOK);
          } else {
            logWithTimestamp('⚠️ User has no recognized groups, defaulting to admin', { username: user.username, groups });
            setUserRole(ROLES.ADMIN);
          }
        } else {
          console.log('⚠️ No groups found, defaulting to admin');
          setUserRole(ROLES.ADMIN);
        }
      } catch (error) {
        console.log('❌ Error getting groups from session:', error);
        setUserRole(ROLES.ADMIN); // Default to admin on error
      } finally {
        setLoading(false);
      }
    };

    getUserRole();
  }, [user]);

  const isAuthenticated = !!user;

  const hasPermission = (permission) => {
    if (!userRole || !PERMISSIONS[userRole]) {
      return false;
    }
    return PERMISSIONS[userRole][permission] || false;
  };

  const isAdmin = () => userRole === ROLES.ADMIN;
  const isWaiter = () => userRole === ROLES.WAITER;
  const isCook = () => userRole === ROLES.COOK;

  // Función para obtener la ruta por defecto según el rol
  const getDefaultRoute = () => {
    if (isAdmin()) return '/'; // Dashboard para administradores
    if (isWaiter()) return '/table-status'; // Estado de mesas para meseros
    if (isCook()) return '/kitchen'; // Vista de cocina para cocineros
    return '/'; // Fallback
  };

  const logout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
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
    hasPermission,
    getDefaultRoute,
    logout,
    ROLES,
    PERMISSIONS
  };

  console.log('🔐 About to render context provider with value:', value);
  console.log('🔐 About to render children inside provider...');
  
  return (
    <SimpleAuthContext.Provider value={value}>
      {console.log('🔐 Inside context provider, rendering children...')}
      {children}
    </SimpleAuthContext.Provider>
  );
};

export default SimpleAuthContext;