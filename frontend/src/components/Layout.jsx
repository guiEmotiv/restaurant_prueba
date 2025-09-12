import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Menu, 
  X, 
  Home, 
  Settings, 
  Package, 
  ShoppingCart,
  Ruler,
  Bell,
  MapPin,
  Table,
  Apple,
  ChefHat,
  Utensils,
  CreditCard,
  Layers,
  History,
  User,
  Users,
  LogOut,
  Activity,
  DollarSign,
  Eye,
  Printer
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
// PrintQueueBadge movido al panel lateral

const Layout = ({ children }) => {
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  // Hook para detectar tamaño de pantalla y cerrar menú en desktop
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    
    const handleChange = (e) => {
      // En desktop, cerrar menú móvil si está abierto
      if (e.matches) {
        setIsMenuOpen(false);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Cerrar menú al cambiar de página
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);
  
  const authContext = useAuth();
  const { user, userRole, logout, hasPermission, loading } = authContext;

  // Define navigation items with permissions using backend permission names
  const allNavigation = [
    { name: 'Inicio', href: '/', icon: Home },
    { name: 'Dashboard Operativo', href: '/dashboard-operativo', icon: Activity, permission: 'can_access_dashboard' },
    { name: 'Dashboard Financiero', href: '/dashboard-financiero', icon: DollarSign, permission: 'can_access_dashboard' },
    {
      name: 'Configuración',
      icon: Settings,
      permission: 'can_manage_users', // Only admins
      children: [
        { name: 'Usuarios', href: '/user-management', icon: Users, permission: 'can_manage_users' },
        { name: 'Unidades', href: '/units', icon: Ruler, permission: 'can_manage_users' },
        { name: 'Zonas', href: '/zones', icon: MapPin, permission: 'can_manage_users' },
        { name: 'Mesas', href: '/tables', icon: Table, permission: 'can_manage_users' },
        { name: 'Envases', href: '/containers', icon: Package, permission: 'can_manage_users' },
        { name: 'Impresoras', href: '/printer-management', icon: Printer, permission: 'can_manage_users' },
      ]
    },
    {
      name: 'Inventario',
      icon: Package,
      permission: 'can_access_dashboard', // Admins and Managers
      children: [
        { name: 'Grupos', href: '/groups', icon: Layers, permission: 'can_access_dashboard' },
        { name: 'Ingredientes', href: '/ingredients', icon: Apple, permission: 'can_access_dashboard' },
        { name: 'Recetas', href: '/recipes', icon: ChefHat, permission: 'can_access_dashboard' },
      ]
    },
    {
      name: 'Operaciones',
      icon: ShoppingCart,
      permission: null, // Se filtrará por sus hijos
      children: [
        { name: 'Gestión de Pedidos', href: '/operations', icon: Table, permission: 'can_create_orders' },
      ]
    },
    {
      name: 'Pagos',
      icon: CreditCard,
      permission: null, // Se filtrará por sus hijos
      children: [
        { name: 'Procesar Pagos', href: '/cashier-payment', icon: CreditCard, permission: 'can_process_payments' },
        { name: 'Historial', href: '/payment-history', icon: History, permission: 'can_access_dashboard' },
        { name: 'Consultar Pedido', href: '/order-tracker', icon: Eye, permission: 'can_manage_kitchen' },
      ]
    },
  ];

  // Filter navigation based on user permissions - wait for auth to complete
  const navigation = !loading && user ? allNavigation
    .filter(item => {
      if (!item.permission) return true; // No permission required
      return hasPermission ? hasPermission(item.permission) : false;
    })
    .map(item => {
      // If item has children, filter them too
      if (item.children) {
        const filteredChildren = item.children.filter(child =>
          !child.permission || (hasPermission && hasPermission(child.permission))
        );
        return filteredChildren.length > 0 ? { ...item, children: filteredChildren } : null;
      }
      return item;
    })
    .filter(item => item !== null) : [];

  // Show loading state if auth is still loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isActive = (href) => location.pathname === href;

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleNavClick = () => {
    // Cerrar menú al navegar
    setIsMenuOpen(false);
  };

  const handleToggle = () => {
    toggleMenu();
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">

      {/* Mobile Overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={handleNavClick}
        />
      )}

      {/* Menu Toggle Button - Top Left - Márgenes mínimos */}
      <button
        onClick={handleToggle}
        className="fixed top-1 left-1 z-[60] inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 hover:scale-105"
        aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        <div className={`transform transition-transform duration-200 ${isMenuOpen ? 'rotate-90' : 'rotate-0'}`}>
          {isMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </div>
      </button>

      {/* PrintQueueBadge movido al panel lateral */}

      {/* Sidebar Navigation - Responsive */}
      <div className={`${
        isMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed inset-y-0 left-0 z-50 w-80 lg:w-64 bg-white shadow-xl transition-transform duration-300 ease-in-out`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-center px-6 py-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">
              El Fogón de Don Soto
            </h1>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.children ? (
                  <div className="space-y-1">
                    <div className="flex items-center px-3 py-2 text-sm font-medium text-gray-700">
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </div>
                    <div className="ml-6 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.name}
                          to={child.href}
                          onClick={handleNavClick}
                          className={`group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors ${
                            isActive(child.href)
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          <child.icon className="mr-3 h-4 w-4" />
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    to={item.href}
                    onClick={handleNavClick}
                    className={`group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
          </nav>
          
          {/* User info and logout */}
          <div className="px-4 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between px-3 py-3 text-sm text-gray-700">
              <div className="flex items-center flex-1">
                <User className="mr-3 h-5 w-5" />
                <div className="flex-1">
                  <div className="font-medium">{user?.username || 'Usuario'}</div>
                  <div className="text-xs text-gray-500">
                    {userRole === 'administradores' ? 'Administrador' : 
                     userRole === 'meseros' ? 'Mesero' : 
                     userRole === 'cocineros' ? 'Cocinero' : 
                     userRole === 'cajeros' ? 'Cajero' : 'Sin rol'}
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="min-h-screen">
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
      
    </div>
  );
};

export default Layout;