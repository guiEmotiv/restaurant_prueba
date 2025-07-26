import { useState } from 'react';
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
  LogOut
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Layout = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, userRole, logout, hasPermission } = useAuth();

  // Define navigation items with permissions
  const allNavigation = [
    { name: 'Dashboard', href: '/', icon: Home, permission: 'canViewDashboard' },
    { 
      name: 'Configuración', 
      icon: Settings,
      permission: 'canManageConfig',
      children: [
        { name: 'Unidades', href: '/units', icon: Ruler, permission: 'canManageConfig' },
        { name: 'Zonas', href: '/zones', icon: MapPin, permission: 'canManageConfig' },
        { name: 'Mesas', href: '/tables', icon: Table, permission: 'canManageConfig' },
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
    { name: 'Pedidos', href: '/orders', icon: ShoppingCart, permission: 'canManageOrders' },
    { name: 'Cocina', href: '/kitchen', icon: Utensils, permission: 'canViewKitchen' },
    { name: 'Estado Mesas', href: '/table-status', icon: Table, permission: 'canViewTableStatus' },
    { name: 'Pagos', href: '/payments', icon: CreditCard, permission: 'canManagePayments' },
    { name: 'Historial', href: '/payment-history', icon: History, permission: 'canViewHistory' },
  ];

  // Filter navigation based on user permissions
  const navigation = allNavigation.filter(item => {
    if (!item.permission) return true; // No permission required
    if (!hasPermission(item.permission)) return false;
    
    // If item has children, filter them too
    if (item.children) {
      item.children = item.children.filter(child => 
        !child.permission || hasPermission(child.permission)
      );
      return item.children.length > 0; // Only show parent if it has visible children
    }
    
    return true;
  });

  const isActive = (href) => location.pathname === href;

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar toggle button */}
      {!isSidebarOpen && (
        <div className="hidden lg:fixed lg:top-4 lg:left-4 lg:z-50 lg:block">
          <button
            onClick={toggleSidebar}
            className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-white shadow-sm bg-white border border-gray-200"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Mobile menu button */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between bg-white px-4 py-3 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">El Fogón de Don Soto</h1>
          <button
            onClick={toggleMenu}
            className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <div className="lg:flex">
        {/* Sidebar */}
        <div className={`${
          isMenuOpen ? 'block' : 'hidden'
        } ${
          isSidebarOpen ? 'lg:block' : 'lg:hidden'
        } fixed lg:fixed inset-y-0 left-0 z-50 lg:z-50 w-64 bg-white shadow-lg min-h-screen lg:min-h-auto`}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 lg:justify-center">
              <h1 className="text-xl font-bold text-gray-900 lg:text-center">El Fogón de Don Soto</h1>
              {/* Close button for mobile and desktop */}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsSidebarOpen(false);
                }}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            
            <nav className="flex-1 px-4 py-6 space-y-2">
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
                            onClick={() => {
                              setIsMenuOpen(false);
                              setIsSidebarOpen(false);
                            }}
                            className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
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
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsSidebarOpen(false);
                      }}
                      className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
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
              <div className="flex items-center px-3 py-2 text-sm text-gray-700">
                <User className="mr-3 h-5 w-5" />
                <div className="flex-1">
                  <div className="font-medium">{user?.username || 'Usuario'}</div>
                  <div className="text-xs text-gray-500 capitalize">
                    {userRole === 'administradores' ? 'Administrador' : 
                     userRole === 'meseros' ? 'Mesero' : 'Sin rol'}
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Cerrar Sesión
              </button>
            </div>
            
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 lg:ml-0 min-h-screen">
          <main className={`p-4 lg:p-8 pt-20 lg:pt-16 transition-all duration-300 ${
            isSidebarOpen ? 'lg:ml-0' : 'lg:ml-0'
          }`}>
            {children}
          </main>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-40 transition-opacity duration-300"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
      
    </div>
  );
};

export default Layout;