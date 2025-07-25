import { useState, useEffect } from 'react';
import { LogIn, User, Key, AlertCircle, Eye, EyeOff, Shield, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../common/Button';
import apiService from '../../services/api';

const AWSLogin = () => {
  const [credentials, setCredentials] = useState({
    accessKey: '',
    secretKey: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const { login } = useAuth();

  // Load available users from AWS IAM
  useEffect(() => {
    loadAvailableUsers();
  }, []);

  const loadAvailableUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await apiService.auth.getPasswordResetInstructions();
      
      // Check if the response has user info
      if (response.simple_users && Array.isArray(response.simple_users)) {
        // Convert simple usernames to display format
        const formattedUsers = response.simple_users.map(username => ({
          username,
          role: extractRoleFromUsername(username),
          display_name: formatDisplayName(username),
          password: response.default_password || 'simple123'
        }));
        setAvailableUsers(formattedUsers);
      } else {
        // Fallback to showing that users will be detected automatically
        setAvailableUsers([]);
      }
    } catch (error) {
      console.error('Error loading available users:', error);
      // Don't show error to user, just use empty array
      setAvailableUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const extractRoleFromUsername = (username) => {
    if (username === 'admin') return 'admin';
    if (username.startsWith('cocinero')) return 'cocinero';
    if (username.startsWith('cajero')) return 'cajero';
    if (username.startsWith('mesero')) return 'mesero';
    return 'user';
  };

  const formatDisplayName = (username) => {
    const roleNames = {
      'admin': '👑 Administrador',
      'cocinero': '👨‍🍳 Cocinero',
      'cajero': '💰 Cajero',
      'mesero': '🍽️ Mesero'
    };
    
    const role = extractRoleFromUsername(username);
    const baseName = roleNames[role] || username;
    
    // Extract number from username if exists
    const match = username.match(/(\d+)$/);
    if (match) {
      return `${baseName} ${match[1]}`;
    }
    
    return baseName;
  };

  const groupUsersByRole = (users) => {
    const grouped = users.reduce((acc, user) => {
      const role = user.role;
      if (!acc[role]) acc[role] = [];
      acc[role].push(user);
      return acc;
    }, {});

    // Sort users within each role
    Object.keys(grouped).forEach(role => {
      grouped[role].sort((a, b) => a.username.localeCompare(b.username));
    });

    return grouped;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!credentials.accessKey || !credentials.secretKey) {
      setError('Por favor ingrese su Access Key ID y Secret Access Key');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // For AWS IAM auth, we pass access key as username and secret key as password
      const result = await login(credentials.accessKey, credentials.secretKey);
      
      if (!result.success) {
        setError(result.message);
      }
      // If successful, the AuthContext will handle the redirect
    } catch (error) {
      console.error('AWS Login error:', error);
      setError('Error de conexión con AWS. Verifique sus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const renderAvailableUsers = () => {
    if (loadingUsers) {
      return (
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-500 mr-2" />
          <span className="text-xs text-blue-600">Cargando usuarios desde AWS IAM...</span>
        </div>
      );
    }

    if (availableUsers.length === 0) {
      return (
        <div className="text-xs text-blue-700 space-y-1">
          <div>🔍 <strong>Detección Automática:</strong> Los usuarios se detectan dinámicamente desde AWS IAM</div>
          <div>👥 <strong>Grupos IAM:</strong> restaurant-administrators, restaurant-cocineros, restaurant-cajeros</div>
          <div>🔐 <strong>Credenciales:</strong> Use sus credenciales AWS o username/password configurados</div>
          <div className="mt-2">
            <button 
              onClick={loadAvailableUsers}
              className="text-xs text-blue-600 hover:text-blue-800 underline flex items-center"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Recargar usuarios disponibles
            </button>
          </div>
        </div>
      );
    }

    const groupedUsers = groupUsersByRole(availableUsers);
    
    return (
      <div className="text-xs text-blue-700 space-y-1">
        {Object.entries(groupedUsers).map(([role, users]) => (
          <div key={role}>
            <strong>{users[0].display_name.split(' ')[0]} {role === 'admin' ? '' : 's'}:</strong>{' '}
            {users.map(user => user.username).join(', ')} / {users[0].password}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            El Fogón de Don Soto
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Autenticación AWS IAM
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Sistema dinámico basado en grupos IAM
          </p>
        </div>

        {/* AWS Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Username Field */}
            <div>
              <label htmlFor="accessKey" className="block text-sm font-medium text-gray-700">
                Usuario (Username o AWS Access Key)
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="accessKey"
                  name="accessKey"
                  type="text"
                  required
                  value={credentials.accessKey}
                  onChange={handleChange}
                  className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="username o AWS Access Key ID"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="secretKey" className="block text-sm font-medium text-gray-700">
                Contraseña (Password o AWS Secret Key)
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="secretKey"
                  name="secretKey"
                  type={showSecretKey ? "text" : "password"}
                  required
                  value={credentials.secretKey}
                  onChange={handleChange}
                  className="appearance-none relative block w-full pl-10 pr-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="password o AWS Secret Access Key"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                >
                  {showSecretKey ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div>
            <Button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Autenticando con AWS...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  Iniciar Sesión
                </>
              )}
            </Button>
          </div>

          {/* Dynamic Users Info Section */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">👥 Usuarios AWS IAM:</h3>
            {renderAvailableUsers()}
            <div className="mt-3 text-xs text-blue-600">
              <p><strong>🔐 Seguridad:</strong> Los usuarios se detectan automáticamente desde AWS IAM.</p>
              <p><strong>🚀 Acceso directo:</strong> También puede usar sus credenciales AWS directamente.</p>
              <p><strong>🔄 Gestión:</strong> Para agregar usuarios, añádelos a los grupos IAM correspondientes.</p>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div className="flex">
              <Shield className="h-4 w-4 text-yellow-400 mt-0.5" />
              <div className="ml-2">
                <p className="text-xs text-yellow-800">
                  <strong>Sistema Dinámico:</strong> Los usuarios y roles se detectan automáticamente desde los grupos AWS IAM. 
                  No hay usuarios hardcodeados en la aplicación.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AWSLogin;