import React from 'react';
import { AuthProvider } from './AuthContext';

// Mock Auth Context for when Cognito is not configured
const MockAuthContext = React.createContext();

const MockAuthProvider = ({ children }) => {
  const mockValue = {
    user: { username: 'Usuario' },
    userRole: 'administradores',
    loading: false,
    isAuthenticated: true,
    isAdmin: () => true,
    isWaiter: () => false,
    hasPermission: () => true, // Allow all permissions when auth is disabled
    logout: () => console.log('Logout deshabilitado - Sin autenticación'),
    refreshAuth: () => Promise.resolve(),
    ROLES: {
      ADMIN: 'administradores',
      WAITER: 'meseros'
    },
    PERMISSIONS: {}
  };

  return (
    <MockAuthContext.Provider value={mockValue}>
      {children}
    </MockAuthContext.Provider>
  );
};

// Optional Auth Provider that uses real auth if configured, mock otherwise
export const OptionalAuthProvider = ({ children }) => {
  // Always use mock provider - authentication disabled
  const isCognitoConfigured = false;
  
  return <MockAuthProvider>{children}</MockAuthProvider>;
};

// Hook that works with both real and mock auth
export const useOptionalAuth = () => {
  // Always use mock context - authentication disabled
  const isCognitoConfigured = false;
  
  const context = React.useContext(MockAuthContext);
  if (context === undefined) {
    throw new Error('useOptionalAuth must be used within an OptionalAuthProvider');
  }
  return context;
};