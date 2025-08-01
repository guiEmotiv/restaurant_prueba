import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RoleBasedRedirect = () => {
  const navigate = useNavigate();
  const { userRole, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      // Redirect based on user role
      if (userRole === 'administradores') {
        // Administradores: Dashboard con acceso completo
        navigate('/', { replace: true });
      } else if (userRole === 'meseros') {
        // Meseros: Estado de mesas (vista principal)
        navigate('/table-status', { replace: true });
      } else if (userRole === 'cocineros') {
        // Cocineros: Vista de cocina (única vista)
        navigate('/kitchen', { replace: true });
      } else {
        // Default fallback para usuarios sin rol
        navigate('/', { replace: true });
      }
    }
  }, [userRole, loading, navigate]);

  // Show loading while determining route
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return null;
};

export default RoleBasedRedirect;