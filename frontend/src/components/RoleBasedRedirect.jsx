import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RoleBasedRedirect = () => {
  const navigate = useNavigate();
  const { userRole, loading, isAuthenticated, user } = useAuth();

  console.log('🔍 RoleBasedRedirect - Current state:', {
    userRole,
    loading,
    isAuthenticated,
    user: user?.username
  });

  useEffect(() => {
    console.log('🔍 RoleBasedRedirect useEffect triggered:', {
      loading,
      userRole,
      userRoleType: typeof userRole,
      isAuthenticated
    });

    if (!loading) {
      console.log('🔍 Loading complete, checking role...');
      
      // Redirect based on user role
      if (userRole === 'administradores') {
        console.log('✅ User is administrador, redirecting to dashboard');
        navigate('/', { replace: true });
      } else if (userRole === 'meseros') {
        console.log('✅ User is mesero, redirecting to dashboard');
        navigate('/', { replace: true });
      } else if (userRole === 'cocineros') {
        console.log('✅ User is cocinero, redirecting to kitchen');
        navigate('/kitchen', { replace: true });
      } else {
        console.log('⚠️ User has no role or unrecognized role:', userRole);
        navigate('/', { replace: true });
      }
    } else {
      console.log('⏳ Still loading...');
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