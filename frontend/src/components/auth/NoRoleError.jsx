import { useEffect, useState } from 'react';
import { AlertTriangle, LogOut, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const NoRoleError = () => {
  const { logout, user } = useAuth();
  const [countdown, setCountdown] = useState(3);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // Countdown timer for auto logout
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsLoggingOut(true);
          logout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [logout]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  if (isLoggingOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cerrando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Acceso Denegado
          </h2>
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">
              Su cuenta (<strong>{user?.username}</strong>) no tiene un rol asignado en el sistema.
            </p>
            <p className="text-sm text-red-600 mt-2">
              <strong>No se permite el acceso sin rol asignado.</strong>
            </p>
            <p className="text-sm text-red-600 mt-1">
              Contacte al administrador para asignar un grupo (administradores, meseros, o cocineros).
            </p>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center justify-center">
              <Clock className="h-4 w-4 text-yellow-600 mr-2" />
              <p className="text-sm text-yellow-700">
                Cerrando sesión automáticamente en <strong>{countdown}</strong> segundo{countdown !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div className="mt-6">
            <button
              onClick={handleLogout}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión Ahora
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