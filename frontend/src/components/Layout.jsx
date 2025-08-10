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
  Eye
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Layout = ({ children }) => {
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const location = useLocation();

  // Hook para detectar tamaño de pantalla
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mediaQuery.matches);
    
    const handleChange = (e) => {
      setIsDesktop(e.matches);
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
  const { user, userRole, logout, hasPermission } = authContext;

  // Define navigation items with permissions
  const allNavigation = [
    { name: 'Dashboard Operativo', href: '/', icon: Activity, permission: 'canViewDashboard' },
    { name: 'Dashboard Financiero', href: '/dashboard-financiero', icon: DollarSign, permission: 'canViewDashboard' },
    { 
      name: 'Configuración', 
      icon: Settings,
      permission: 'canManageConfig',
      children: [
        { name: 'Unidades', href: '/units', icon: Ruler, permission: 'canManageConfig' },
        { name: 'Zonas', href: '/zones', icon: MapPin, permission: 'canManageConfig' },
        { name: 'Mesas', href: '/tables', icon: Table, permission: 'canManageConfig' },
        { name: 'Envases', href: '/containers', icon: Package, permission: 'canManageConfig' },
      ]
    },
    { 
      name: 'Inventario', 
      icon: Package,
      permission: 'canManageInventory',
      children: [
        { name: 'Grupos', href: '/groups', icon: Layers, permission: 'canManageInventory' },
        { name: 'Ingredientes', href: '/ingredients', icon: Apple, permission: 'canManageInventory' },
        { name: 'Recetas', href: '/recipes', icon: ChefHat, permission: 'canManageInventory' },
      ]
    },
    { 
      name: 'Operaciones', 
      icon: ShoppingCart,
      permission: 'canViewKitchen',
      children: [
        { name: 'Tomar Pedido', href: '/table-order', icon: ShoppingCart, permission: 'canViewKitchen' },
        { name: 'Estado de Mesas', href: '/table-status', icon: Eye, permission: 'canViewKitchen' },
        { name: 'Cocina', href: '/kitchen', icon: Utensils, permission: 'canViewKitchen' },
      ]
    },
    { name: 'Historial', href: '/payment-history', icon: History, permission: 'canViewHistory' },
  ];

  // Filter navigation based on user permissions
  const navigation = allNavigation
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
    .filter(item => item !== null);

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

      {/* Menu Toggle Button - Top Left - Optimizado */}
      <button
        onClick={handleToggle}
        className="fixed top-4 left-4 z-[60] inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white text-gray-700 shadow-lg border border-gray-200 hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 hover:scale-105"
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

      {/* Sidebar Navigation - Responsive */}
      <div className={`${
        isMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed inset-y-0 left-0 z-50 w-80 lg:w-64 bg-white shadow-xl transition-transform duration-300 ease-in-out`}>
        <div className="flex flex-col h-full">
          {/* Header with integrated toggle space */}
          <div className="flex items-center justify-between px-6 py-6 border-b border-gray-200">
            <div className="ml-12 lg:ml-0"> {/* Space for toggle button */}
              <h1 className="text-xl font-bold text-gray-900">
                El Fogón de Don Soto
              </h1>
            </div>
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
                     userRole === 'cocineros' ? 'Cocinero' : 'Sin rol'}
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
        <main className="p-4 lg:p-8 pt-20 lg:pt-8">
          {children}
        </main>
      </div>
      
    </div>
  );
};

export default Layout;