import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, requiredRole = null, requiredView = null }) => {
  const { isAuthenticated, user, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access
  if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600 mb-4">
            No tiene permisos para acceder a esta sección.
          </p>
          <p className="text-sm text-gray-500">
            Rol requerido: {requiredRole}. Su rol: {user?.role}
          </p>
        </div>
      </div>
    );
  }

  // Check view-based access
  if (requiredView && !user?.allowed_views?.includes(requiredView) && user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600 mb-4">
            No tiene permisos para acceder a esta vista.
          </p>
          <p className="text-sm text-gray-500">
            Vista requerida: {requiredView}. Sus vistas permitidas: {user?.allowed_views?.join(', ')}
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;