import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RoleBasedRedirect = () => {
  const navigate = useNavigate();
  const { userRole, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      // Redirect based on user role
      if (userRole === 'meseros') {
        // Waiters go to table status view
        navigate('/table-status', { replace: true });
      } else if (userRole === 'administradores') {
        // Admins go to dashboard
        navigate('/', { replace: true });
      } else {
        // Default fallback
        navigate('/table-status', { replace: true });
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