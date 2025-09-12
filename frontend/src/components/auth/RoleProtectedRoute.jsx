import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const RoleProtectedRoute = ({ children, requiredPermission }) => {
  const navigate = useNavigate();
  const { hasPermission, getDefaultRoute, loading, isAuthenticated } = useAuth();
  
  // 🔍 DEBUG: Log estado del auth
  console.log('🔐 [DEBUG] RoleProtectedRoute render:', {
    requiredPermission,
    loading,
    isAuthenticated,
    hasPermission: hasPermission ? hasPermission(requiredPermission) : null,
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    if (!loading && isAuthenticated) {
      // Check if user has the required permission
      if (requiredPermission && !hasPermission(requiredPermission)) {
        // Add delay to prevent redirect loops with RoleBasedRedirect
        const redirectTimeout = setTimeout(() => {
          const defaultRoute = getDefaultRoute();
          navigate(defaultRoute, { replace: true });
        }, 100); // Slightly longer delay than RoleBasedRedirect
        
        return () => clearTimeout(redirectTimeout);
      }
    }
  }, [hasPermission, requiredPermission, getDefaultRoute, navigate, loading, isAuthenticated]);

  // Show loading while checking permissions
  if (loading) {
    console.log('⏳ [DEBUG] RoleProtectedRoute - mostrando loading');
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If user doesn't have permission, show nothing (redirect is in progress)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    console.log('🚫 [DEBUG] RoleProtectedRoute - sin permisos, redirigiendo');
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-600">Redirigiendo...</div>
      </div>
    );
  }

  // User has permission, render the component
  console.log('✅ [DEBUG] RoleProtectedRoute - renderizando children');
  return children;
};

export default RoleProtectedRoute;