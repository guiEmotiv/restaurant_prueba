import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Welcome = () => {
  const navigate = useNavigate();
  const { user, userRole, hasPermission } = useAuth();

  const getWelcomeMessage = () => {
    switch (userRole) {
      case 'administradores':
        return {
          title: '¡Bienvenido, Administrador!',
          subtitle: 'Tienes acceso completo al sistema de gestión del restaurante',
          description: 'Desde aquí puedes gestionar todas las operaciones, configuraciones, inventario y finanzas del restaurante.'
        };
      case 'meseros':
        return {
          title: '¡Bienvenido, Mesero!',
          subtitle: 'Gestiona las mesas y pedidos del restaurante',
          description: 'Tu área principal es la gestión de mesas donde puedes tomar pedidos, ver el estado de las mesas y servir a los clientes.'
        };
      case 'cocineros':
        return {
          title: '¡Bienvenido, Cocinero!',
          subtitle: 'Controla la cocina y prepara los pedidos',
          description: 'Desde la vista de cocina puedes ver todos los pedidos pendientes, marcar platos como listos y gestionar los tiempos de preparación.'
        };
      case 'cajeros':
        return {
          title: '¡Bienvenido, Cajero!',
          subtitle: 'Procesa los pagos y gestiona las transacciones',
          description: 'Tu función principal es procesar pagos, ver el historial de transacciones y gestionar el cobro de los pedidos.'
        };
      default:
        return {
          title: '¡Bienvenido al Sistema!',
          subtitle: 'Sistema de Gestión de Restaurante',
          description: 'Accede a las funciones disponibles según tu rol.'
        };
    }
  };

  const getQuickActions = () => {
    const actions = [];

    // Dashboard - Admins and Managers
    if (hasPermission('can_access_dashboard')) {
      actions.push({
        title: 'Dashboard Operativo',
        description: 'Ver resumen de operaciones',
        icon: '📊',
        path: '/dashboard-operativo',
        color: 'bg-blue-500 hover:bg-blue-600'
      });

      actions.push({
        title: 'Dashboard Financiero',
        description: 'Ver reportes financieros',
        icon: '💰',
        path: '/dashboard-financiero',
        color: 'bg-indigo-500 hover:bg-indigo-600'
      });
    }

    // Order Management - Admins, Managers, and Waiters
    if (hasPermission('can_create_orders')) {
      actions.push({
        title: 'Gestión de Pedidos',
        description: 'Administrar mesas y pedidos',
        icon: '🍽️',
        path: '/operations',
        color: 'bg-green-500 hover:bg-green-600'
      });
    }

    // Kitchen - Admins and Cooks
    if (hasPermission('can_manage_kitchen')) {
      actions.push({
        title: 'Consultar Pedidos',
        description: 'Ver estado de pedidos',
        icon: '👨‍🍳',
        path: '/order-tracker',
        color: 'bg-orange-500 hover:bg-orange-600'
      });
    }

    // Payment Processing - Admins and Cashiers
    if (hasPermission('can_process_payments')) {
      actions.push({
        title: 'Procesar Pagos',
        description: 'Gestionar pagos y cobros',
        icon: '💳',
        path: '/cashier-payment',
        color: 'bg-purple-500 hover:bg-purple-600'
      });
    }

    // Configuration - Admins only
    if (hasPermission('can_manage_users')) {
      actions.push({
        title: 'Configuración',
        description: 'Administrar sistema',
        icon: '⚙️',
        path: '/units',
        color: 'bg-gray-700 hover:bg-gray-800'
      });
    }

    return actions;
  };

  const welcomeInfo = getWelcomeMessage();
  const quickActions = getQuickActions();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Welcome Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <div className="text-6xl mb-4">🏪</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {welcomeInfo.title}
            </h1>
            <p className="text-xl text-gray-600 mb-2">
              {welcomeInfo.subtitle}
            </p>
            <p className="text-gray-500 max-w-2xl mx-auto">
              {welcomeInfo.description}
            </p>
          </div>
          
          {user && (
            <div className="bg-white rounded-lg p-4 inline-block shadow-sm border">
              <p className="text-sm text-gray-600">
                Conectado como: <span className="font-semibold text-gray-900">{user.username || user.name || 'Usuario'}</span>
              </p>
              <p className="text-xs text-gray-400">
                Rol: {userRole || 'Sin rol asignado'}
              </p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
              Acciones Rápidas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => navigate(action.path)}
                  className={`${action.color} text-white p-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200`}
                >
                  <div className="text-4xl mb-3">{action.icon}</div>
                  <h3 className="text-xl font-semibold mb-2">{action.title}</h3>
                  <p className="text-sm opacity-90">{action.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* System Status */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Estado del Sistema
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Sistema Operativo</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Base de Datos Conectada</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Autenticación Activa</span>
            </div>
          </div>
        </div>

        {/* Permission Debug Panel - Only for development */}
        {user && process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              🔧 Panel de Debug - Permisos
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Info */}
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-semibold text-gray-800 mb-3">Información del Usuario</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Usuario:</strong> {user.username}</div>
                  <div><strong>Email:</strong> {user.email || 'No especificado'}</div>
                  <div><strong>Nombre:</strong> {user.first_name} {user.last_name}</div>
                  <div><strong>Rol:</strong> {userRole || 'Sin rol'}</div>
                  <div><strong>Grupos:</strong> {user.groups?.join(', ') || 'Ninguno'}</div>
                  <div><strong>Es Staff:</strong> {user.is_staff ? '✅ Sí' : '❌ No'}</div>
                  <div><strong>Es Superuser:</strong> {user.is_superuser ? '✅ Sí' : '❌ No'}</div>
                </div>
              </div>

              {/* Permission Check */}
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-semibold text-gray-800 mb-3">Permisos Activos</h4>
                <div className="space-y-1 text-sm">
                  {[
                    'can_manage_users',
                    'can_view_admin',
                    'can_access_dashboard',
                    'can_create_orders',
                    'can_process_payments',
                    'can_manage_kitchen'
                  ].map(permission => (
                    <div key={permission} className="flex items-center justify-between">
                      <span className="font-mono text-xs">{permission}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        hasPermission(permission)
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {hasPermission(permission) ? '✅ Sí' : '❌ No'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Raw Permissions Object */}
            <div className="mt-4 bg-white p-4 rounded-lg border">
              <h4 className="font-semibold text-gray-800 mb-3">Objeto de Permisos (Raw)</h4>
              <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                {JSON.stringify(user.permissions || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Welcome;