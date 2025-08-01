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
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

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
        console.log('🔍 User groups from token:', groups);
        
        if (Array.isArray(groups)) {
          if (groups.includes(ROLES.ADMIN)) {
            console.log('✅ User is admin');
            setUserRole(ROLES.ADMIN);
          } else if (groups.includes(ROLES.WAITER)) {
            console.log('✅ User is waiter');
            setUserRole(ROLES.WAITER);
          } else {
            console.log('⚠️ User has no recognized groups, defaulting to admin');
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