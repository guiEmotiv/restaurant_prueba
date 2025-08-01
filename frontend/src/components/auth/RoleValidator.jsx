import { useAuth } from '../../contexts/SimpleAuthContext';
import NoRoleError from './NoRoleError';

const RoleValidator = ({ children }) => {
  const { userRole, loading, isAuthenticated } = useAuth();

  // Show loading while checking role
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show error if authenticated but no role
  if (isAuthenticated && !userRole) {
    return <NoRoleError />;
  }

  // Show content if role is assigned
  return children;
};

export default RoleValidator;