import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

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

  // Define user roles and their permissions
  const ROLES = {
    ADMIN: 'administradores',
    WAITER: 'meseros',
    COOK: 'cocineros'
  };

  const PERMISSIONS = {
    [ROLES.ADMIN]: {
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
      canViewDashboard: false,
      canManageConfig: false,
      canManageInventory: false,
      canManageOrders: true,      // Necesario para crear/modificar pedidos desde Estado Mesas
      canViewKitchen: false,
      canViewTableStatus: true,
      canManagePayments: true,    // Necesario para procesar pagos desde Estado Mesas  
      canViewHistory: false,
    },
    [ROLES.COOK]: {
      canViewDashboard: false,
      canManageConfig: false,
      canManageInventory: false,
      canManageOrders: false,
      canViewKitchen: true,
      canViewTableStatus: false,
      canManagePayments: false,
      canViewHistory: false,
    }
  };

  const getUserRole = async (user) => {
    try {
      const session = await fetchAuthSession();
      const groups = session.tokens?.accessToken?.payload?.['cognito:groups'] || [];
      
      // Check which group the user belongs to
      if (groups.includes(ROLES.ADMIN)) {
        return ROLES.ADMIN;
      } else if (groups.includes(ROLES.WAITER)) {
        return ROLES.WAITER;
      } else if (groups.includes(ROLES.COOK)) {
        return ROLES.COOK;
      }
      return null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  };

  const checkAuthState = async () => {
    try {
      console.log('🔍 Starting auth state check...');
      setLoading(true);
      
      // Add a small delay to ensure session is fully established
      console.log('🔍 Waiting half second for session to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('🔍 Getting current user...');
      const currentUser = await getCurrentUser();
      
      if (currentUser) {
        console.log('✅ Found authenticated user:', currentUser.username);
        setUser(currentUser);
        setIsAuthenticated(true);
        
        // Get user role from Cognito groups
        console.log('🔍 Getting user role...');
        const role = await getUserRole(currentUser);
        setUserRole(role);
        
        console.log('✅ Auth state updated:', {
          username: currentUser.username,
          role: role,
          isAuthenticated: true
        });
      } else {
        console.log('❌ No authenticated user found');
        setUser(null);
        setUserRole(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.log('❌ Auth check failed:', error.message);
      console.error('❌ Full error:', error);
      setUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
    } finally {
      console.log('🔍 Auth check completed, setting loading to false');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initialize auth state check immediately
    console.log('🔍 Initializing AuthContext...');
    checkAuthState();
    
    // Listen for custom authentication success event
    const handleAuthSuccess = (event) => {
      console.log('🎯 Custom auth success event received:', event.detail);
      setTimeout(() => {
        checkAuthState();
      }, 500);
    };
    
    window.addEventListener('cognitoAuthSuccess', handleAuthSuccess);
    
    // Listen for authentication events from Hub
    const hubListenerCancel = Hub.listen('auth', ({ payload }) => {
      console.log('🎯 Hub auth event received:', payload.event);
      switch (payload.event) {
        case 'signInWithRedirect':
        case 'signedIn':
          console.log('🔐 Hub: User signed in, refreshing auth state');
          setTimeout(() => {
            checkAuthState();
          }, 1000);
          break;
        case 'signedOut':
          console.log('🔓 Hub: User signed out');
          setUser(null);
          setUserRole(null);
          setIsAuthenticated(false);
          setLoading(false);
          break;
        case 'tokenRefresh':
          console.log('🔄 Hub: Token refreshed');
          setTimeout(() => {
            checkAuthState();
          }, 500);
          break;
        default:
          console.log('ℹ️ Hub: Other auth event:', payload.event);
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
      console.error('Error signing out:', error);
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
        return '/table-status';  // Estado de Mesas
      case ROLES.COOK:
        return '/kitchen';  // Cocina
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