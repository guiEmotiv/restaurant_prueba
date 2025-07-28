import React from 'react';
import ProtectedRoute from './ProtectedRoute';

const OptionalProtectedRoute = ({ children, requiredPermission }) => {
  // Authentication disabled - always allow access
  return children;
};

export default OptionalProtectedRoute;