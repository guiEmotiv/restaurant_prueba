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
    WAITER: 'meseros'
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
      canManageOrders: true,
      canViewKitchen: true,
      canViewTableStatus: true,
      canManagePayments: true,
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
      }
      return null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  };

  const checkAuthState = async () => {
    try {
      setLoading(true);
      
      // Add a small delay to ensure session is fully established
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const currentUser = await getCurrentUser();
      
      if (currentUser) {
        console.log('✅ Found authenticated user:', currentUser.username);
        setUser(currentUser);
        setIsAuthenticated(true);
        
        // Get user role from Cognito groups
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
      setUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only check auth state initially, don't do it automatically
    console.log('🔍 Initializing AuthContext...');
    
    // Listen for authentication events
    const hubListenerCancel = Hub.listen('auth', ({ payload }) => {
      console.log('🎯 Auth event received:', payload.event);
      switch (payload.event) {
        case 'signInWithRedirect':
        case 'signedIn':
          console.log('🔐 User signed in, refreshing auth state');
          // Add a delay to ensure Cognito session is fully established
          setTimeout(() => {
            checkAuthState();
          }, 1000);
          break;
        case 'signedOut':
          console.log('🔓 User signed out');
          setUser(null);
          setUserRole(null);
          setIsAuthenticated(false);
          setLoading(false);
          break;
        case 'tokenRefresh':
          console.log('🔄 Token refreshed');
          setTimeout(() => {
            checkAuthState();
          }, 500);
          break;
        default:
          console.log('ℹ️ Other auth event:', payload.event);
          break;
      }
    });

    return () => {
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

  const refreshAuth = async () => {
    await checkAuthState();
  };

  const value = {
    user,
    userRole,
    loading,
    isAuthenticated,
    isAdmin,
    isWaiter,
    hasPermission,
    logout,
    refreshAuth,
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