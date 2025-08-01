import { AlertTriangle, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/SimpleAuthContext';

const NoRoleError = () => {
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sin Permisos Asignados
          </h2>
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">
              Su cuenta (<strong>{user?.username}</strong>) no tiene un rol asignado en el sistema.
            </p>
            <p className="text-sm text-red-600 mt-2">
              Por favor contacte al administrador para que le asigne un grupo (administradores, meseros, o cocineros).
            </p>
          </div>
          
          <div className="mt-6">
            <button
              onClick={handleLogout}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </button>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            <p><strong>Para administradores:</strong></p>
            <p>Verificar grupos en AWS Cognito:</p>
            <ul className="text-left mt-2 ml-4 list-disc">
              <li>administradores</li>
              <li>meseros</li>
              <li>cocineros</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoRoleError;