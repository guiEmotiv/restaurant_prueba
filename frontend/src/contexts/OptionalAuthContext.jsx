import React from 'react';
import { AuthProvider } from './AuthContext';

// Mock Auth Context for when Cognito is not configured
const MockAuthContext = React.createContext();

const MockAuthProvider = ({ children }) => {
  const mockValue = {
    user: { username: 'Admin' },
    userRole: 'administradores',
    loading: false,
    isAuthenticated: true,
    isAdmin: () => true,
    isWaiter: () => false,
    hasPermission: () => true, // Allow all permissions when auth is disabled
    logout: () => window.location.reload(),
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
  const userPoolId = import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID;
  const appClientId = import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID;
  
  const isCognitoConfigured = userPoolId && 
                             appClientId && 
                             userPoolId !== 'us-east-1_XXXXXXXXX' && 
                             appClientId !== 'xxxxxxxxxxxxxxxxxxxxxxxxxx' &&
                             userPoolId.length > 10 &&
                             appClientId.length > 10;
  
  if (!isCognitoConfigured) {
    return <MockAuthProvider>{children}</MockAuthProvider>;
  }
  
  return <AuthProvider>{children}</AuthProvider>;
};

// Hook that works with both real and mock auth
export const useOptionalAuth = () => {
  const userPoolId = import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID;
  const appClientId = import.meta.env.VITE_AWS_COGNITO_APP_CLIENT_ID;
  
  const isCognitoConfigured = userPoolId && 
                             appClientId && 
                             userPoolId !== 'us-east-1_XXXXXXXXX' && 
                             appClientId !== 'xxxxxxxxxxxxxxxxxxxxxxxxxx' &&
                             userPoolId.length > 10 &&
                             appClientId.length > 10;
  
  if (!isCognitoConfigured) {
    const context = React.useContext(MockAuthContext);
    if (context === undefined) {
      throw new Error('useOptionalAuth must be used within an OptionalAuthProvider');
    }
    return context;
  }
  
  // Use the real auth hook when Cognito is configured
  const { useAuth } = require('./AuthContext');
  return useAuth();
};