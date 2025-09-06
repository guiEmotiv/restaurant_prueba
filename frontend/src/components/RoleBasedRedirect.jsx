import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RoleBasedRedirect = () => {
  const navigate = useNavigate();
  const { userRole, loading, isAuthenticated, user } = useAuth();


  useEffect(() => {
    // Only redirect once when loading is complete and we have authentication info
    if (!loading && userRole) {
      // Add a small delay to prevent redirect loops and allow components to stabilize
      const redirectTimeout = setTimeout(() => {
        // All authenticated users go to welcome page
        navigate('/', { replace: true });
      }, 50); // Small delay to prevent redirect loops
      
      return () => clearTimeout(redirectTimeout);
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