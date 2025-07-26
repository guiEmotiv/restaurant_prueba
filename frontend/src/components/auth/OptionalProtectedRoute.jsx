import React from 'react';
import ProtectedRoute from './ProtectedRoute';

const OptionalProtectedRoute = ({ children, requiredPermission }) => {
  // Check if Cognito is configured
  const isCognitoConfigured = import.meta.env.VITE_COGNITO_USER_POOL_ID || 
                             process.env.REACT_APP_COGNITO_USER_POOL_ID;
  
  // If Cognito is not configured, allow access to all routes
  if (!isCognitoConfigured) {
    return children;
  }
  
  // If Cognito is configured, use the normal ProtectedRoute
  return (
    <ProtectedRoute requiredPermission={requiredPermission}>
      {children}
    </ProtectedRoute>
  );
};

export default OptionalProtectedRoute;