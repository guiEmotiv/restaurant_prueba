import React, { createContext, useContext } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';

const SimpleAuthContext = createContext();

export const useAuth = () => {
  const context = useContext(SimpleAuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a SimpleAuthProvider');
  }
  return context;
};

export const SimpleAuthProvider = ({ children }) => {
  const { user, signOut } = useAuthenticator((context) => [context.user]);

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

  const getUserRole = () => {
    if (!user) return null;
    
    // Try to get groups from token
    try {
      const groups = user.signInDetails?.loginId || [];
      if (Array.isArray(groups)) {
        if (groups.includes(ROLES.ADMIN)) return ROLES.ADMIN;
        if (groups.includes(ROLES.WAITER)) return ROLES.WAITER;
      }
    } catch (error) {
      console.log('Could not get user groups:', error);
    }
    
    return null;
  };

  const userRole = getUserRole();
  const isAuthenticated = !!user;

  const hasPermission = (permission) => {
    if (!userRole || !PERMISSIONS[userRole]) {
      return false;
    }
    return PERMISSIONS[userRole][permission] || false;
  };

  const isAdmin = () => userRole === ROLES.ADMIN;
  const isWaiter = () => userRole === ROLES.WAITER;

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
    loading: false, // Authenticator handles loading
    isAuthenticated,
    isAdmin,
    isWaiter,
    hasPermission,
    logout,
    ROLES,
    PERMISSIONS
  };

  return (
    <SimpleAuthContext.Provider value={value}>
      {children}
    </SimpleAuthContext.Provider>
  );
};

export default SimpleAuthContext;