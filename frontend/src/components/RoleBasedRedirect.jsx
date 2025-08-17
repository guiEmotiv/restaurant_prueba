import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RoleBasedRedirect = () => {
  const navigate = useNavigate();
  const { userRole, loading, isAuthenticated, user } = useAuth();


  useEffect(() => {

    if (!loading) {
      
      // Redirect based on user role
      if (userRole === 'administradores') {
        navigate('/', { replace: true });
      } else if (userRole === 'meseros') {
        navigate('/', { replace: true });
      } else if (userRole === 'cocineros') {
        navigate('/kitchen', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } else {
    }
  }, [userRole, loading, navigate, isAuthenticated]);

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