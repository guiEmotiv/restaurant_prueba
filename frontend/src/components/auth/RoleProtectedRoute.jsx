import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const RoleProtectedRoute = ({ children, requiredPermission }) => {
  const navigate = useNavigate();
  const { hasPermission, getDefaultRoute, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      // Check if user has the required permission
      if (requiredPermission && !hasPermission(requiredPermission)) {
        // User doesn't have permission, redirect to their default route
        const defaultRoute = getDefaultRoute();
        navigate(defaultRoute, { replace: true });
      }
    }
  }, [hasPermission, requiredPermission, getDefaultRoute, navigate, loading, isAuthenticated]);

  // Show loading while checking permissions
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If user doesn't have permission, show nothing (redirect is in progress)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-600">Redirigiendo...</div>
      </div>
    );
  }

  // User has permission, render the component
  return children;
};

export default RoleProtectedRoute;