import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, Lock } from 'lucide-react';

const ProtectedRoute = ({ children, requiredPermission, fallback = null }) => {
  const { hasPermission, loading, isAuthenticated, userRole } = useAuth();
  
  console.log('🔍 ProtectedRoute check:', {
    isAuthenticated,
    userRole,
    loading,
    requiredPermission,
    hasPermission: requiredPermission ? hasPermission(requiredPermission) : 'N/A'
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback || (
      <div className="min-h-64 flex items-center justify-center">
        <div className="text-center">
          <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Acceso Restringido</h3>
          <p className="text-gray-600">Debes iniciar sesión para acceder a esta página</p>
        </div>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return fallback || (
      <div className="min-h-64 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sin Permisos</h3>
          <p className="text-gray-600">
            No tienes permisos para acceder a esta página.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Tu rol actual: <span className="font-medium">{userRole || 'Sin rol'}</span>
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;