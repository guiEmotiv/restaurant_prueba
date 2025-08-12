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
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(false); // ✅ Start as false, LoginForm will handle loading
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
      canManagePayments: false,   // SOLO administradores pueden procesar pagos
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
    }
  };

  const getUserRole = async (user) => {
    try {
      console.log('🔍 Getting user role for:', user.username);
      const session = await fetchAuthSession();
      console.log('📋 Full session:', session);
      console.log('🎫 Access Token EXISTS:', !!session.tokens?.accessToken);
      console.log('🎫 ID Token EXISTS:', !!session.tokens?.idToken);
      
      // Try to get groups from access token
      const accessTokenPayload = session.tokens?.accessToken?.payload;
      console.log('📦 Access Token Payload:', accessTokenPayload);
      
      // Also check ID token for groups
      const idTokenPayload = session.tokens?.idToken?.payload;
      console.log('📦 ID Token Payload:', idTokenPayload);
      
      // Try both tokens for groups
      const groups = accessTokenPayload?.['cognito:groups'] || 
                    idTokenPayload?.['cognito:groups'] || 
                    [];
      
      console.log('👥 User groups FOUND:', groups);
      console.log('👥 Groups length:', groups.length);
      console.log('👥 Groups type:', typeof groups);
      console.log('👥 ROLES object:', ROLES);
      
      // Check which group the user belongs to
      if (groups.includes(ROLES.ADMIN)) {
        console.log('✅ User is ADMIN - returning ROLES.ADMIN:', ROLES.ADMIN);
        return ROLES.ADMIN;
      } else if (groups.includes(ROLES.WAITER)) {
        console.log('✅ User is WAITER - returning ROLES.WAITER:', ROLES.WAITER);
        return ROLES.WAITER;
      } else if (groups.includes(ROLES.COOK)) {
        console.log('✅ User is COOK - returning ROLES.COOK:', ROLES.COOK);
        return ROLES.COOK;
      }
      
      console.warn('⚠️ User has no recognized role!');
      console.warn('   Groups found:', groups);
      console.warn('   ROLES.ADMIN:', ROLES.ADMIN);
      console.warn('   groups.includes(ROLES.ADMIN):', groups.includes(ROLES.ADMIN));
      return null;
    } catch (error) {
      console.error('❌ Error getting user role:', error);
      console.error('Error details:', error.stack);
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
        
        // Debug: Test basic API connectivity
        console.log('🔍 Testing basic API connectivity...');
        try {
          const response = await fetch(`${API_BASE_URL}/health/`, {
            headers: {
              'Accept': 'application/json',
            }
          });
          if (response.ok) {
            console.log('✅ API Health Check OK');
          } else {
            console.error('❌ API Health Check failed: HTTP', response.status);
          }
        } catch (error) {
          console.error('❌ API Health Check failed:', error.message);
        }
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
    // ✅ NO ejecutar checkAuthState inmediatamente
    // Esperar a que LoginForm/Authenticator maneje la autenticación
    console.log('🔍 Initializing AuthContext... (waiting for auth events)');
    
    // Listen for custom authentication success event
    const handleAuthSuccess = (event) => {
      console.log('🎯 Custom auth success event received:', event.detail);
      setTimeout(() => {
        console.log('🔄 Executing checkAuthState from custom event...');
        checkAuthState();
      }, 500);
    };
    
    window.addEventListener('cognitoAuthSuccess', handleAuthSuccess);
    
    // EMERGENCY FIX: También ejecutar checkAuthState después de un delay
    // en caso de que el evento se pierda
    setTimeout(() => {
      console.log('🚨 Emergency auth check - verifying if user is already authenticated...');
      checkAuthState();
    }, 2000);
    
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
        return '/';  // Dashboard
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

// 🚫 Mock AuthProvider for development without authentication
export const MockAuthProvider = ({ children }) => {
  console.log('🚫 MockAuthProvider: Using mock authentication for development');
  
  const ROLES = {
    ADMIN: 'administradores',
    WAITER: 'meseros', 
    COOK: 'cocineros'
  };

  // Mock user with admin permissions for development
  const mockUser = {
    username: 'admin-dev',
    userId: 'mock-admin-id'
  };

  const mockValue = {
    user: mockUser,
    userRole: ROLES.ADMIN,
    loading: false,
    isAuthenticated: true,
    isAdmin: () => true,
    isWaiter: () => false,
    isCook: () => false,
    hasPermission: () => true, // ✅ All permissions in development
    logout: () => console.log('🚫 Mock logout'),
    refreshAuth: () => Promise.resolve(),
    getDefaultRoute: () => '/',
    ROLES,
    PERMISSIONS: {
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
      }
    }
  };

  return (
    <AuthContext.Provider value={mockValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;