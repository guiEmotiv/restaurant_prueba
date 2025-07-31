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
      
      // Since authentication is disabled, set a default admin user
      console.log('ℹ️ Authentication disabled - setting default admin access');
      
      const defaultUser = {
        username: 'admin',
        userId: 'admin-no-auth'
      };
      
      setUser(defaultUser);
      setIsAuthenticated(true);
      setUserRole(ROLES.ADMIN); // Grant admin access by default
      
      console.log('✅ Auth state set (no authentication):', {
        username: defaultUser.username,
        role: ROLES.ADMIN
      });
    } catch (error) {
      console.log('Error setting default auth state:', error);
      setUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthState();
    // Note: AWS Amplify event listeners removed since authentication is disabled
  }, []);

  const logout = async () => {
    try {
      console.log('ℹ️ Logout called (authentication disabled - no action needed)');
      // Since authentication is disabled, no actual logout is needed
      // But we can still clear the state if desired
      setUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
      window.location.reload(); // Force page reload to clear any cached data
    } catch (error) {
      console.error('Error during logout:', error);
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