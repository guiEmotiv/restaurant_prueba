import { useAuth } from '../../contexts/AuthContext';

const RoleValidator = ({ children }) => {
  console.log('🔍 RoleValidator rendering...');
  
  try {
    const authData = useAuth();
    console.log('🔍 Auth data:', authData);
    
    const { userRole, loading, isAuthenticated } = authData;

    // Show loading while checking role
    if (loading) {
      console.log('🔍 RoleValidator: showing loading...');
      return (
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    // For debugging - always show content without role validation
    console.log('🔍 RoleValidator: showing children...', { userRole, isAuthenticated });
    return children;
    
  } catch (error) {
    console.error('🔍 RoleValidator error:', error);
    return <div>Error in RoleValidator: {error.message}</div>;
  }
};

export default RoleValidator;