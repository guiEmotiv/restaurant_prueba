import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Menu, 
  X, 
  Home, 
  Settings, 
  Package, 
  ShoppingCart,
  Tag,
  Ruler,
  MapPin,
  Table,
  Apple,
  ChefHat,
  Utensils,
  CreditCard,
  Layers,
  History,
  LogOut,
  User
} from 'lucide-react';

const Layout = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { user, logout, canAccessView } = useAuth();

  // Define all possible navigation items
  const allNavigation = [
    { name: 'Dashboard', href: '/', icon: Home, viewName: 'dashboard' },
    { 
      name: 'Configuración', 
      icon: Settings,
      viewName: 'config',
      children: [
        { name: 'Categorías', href: '/categories', icon: Tag, viewName: 'categories' },
        { name: 'Unidades', href: '/units', icon: Ruler, viewName: 'units' },
        { name: 'Zonas', href: '/zones', icon: MapPin, viewName: 'zones' },
        { name: 'Mesas', href: '/tables', icon: Table, viewName: 'tables' },
      ]
    },
    { 
      name: 'Inventario', 
      icon: Package,
      viewName: 'inventory',
      children: [
        { name: 'Grupos', href: '/groups', icon: Layers, viewName: 'groups' },
        { name: 'Ingredientes', href: '/ingredients', icon: Apple, viewName: 'ingredients' },
        { name: 'Recetas', href: '/recipes', icon: ChefHat, viewName: 'recipes' },
      ]
    },
    { name: 'Órdenes', href: '/orders', icon: ShoppingCart, viewName: 'orders' },
    { name: 'Cocina', href: '/kitchen', icon: Utensils, viewName: 'kitchen' },
    { name: 'Pagos', href: '/payments', icon: CreditCard, viewName: 'payments' },
    { name: 'Historial', href: '/payment-history', icon: History, viewName: 'payment-history' },
  ];

  // Filter navigation based on user permissions
  const navigation = allNavigation.filter(item => {
    if (item.children) {
      // For parent items with children, check if any child is accessible
      const accessibleChildren = item.children.filter(child => 
        canAccessView(child.viewName)
      );
      return accessibleChildren.length > 0;
    }
    return canAccessView(item.viewName);
  }).map(item => {
    if (item.children) {
      // Filter children based on permissions
      return {
        ...item,
        children: item.children.filter(child => canAccessView(child.viewName))
      };
    }
    return item;
  });

  const handleLogout = async () => {
    await logout();
  };

  const isActive = (href) => location.pathname === href;

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <div className="min-h-screen bg-gray-50">
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
        } lg:block fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto w-64 bg-white shadow-lg min-h-screen lg:min-h-auto`}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 lg:justify-center">
              <h1 className="text-xl font-bold text-gray-900 lg:text-center">El Fogón de Don Soto</h1>
              {/* Close button for mobile */}
              <button
                onClick={() => setIsMenuOpen(false)}
                className="lg:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* User Info */}
            <div className="px-4 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <div className="bg-blue-100 rounded-full p-2">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user?.role}
                  </p>
                </div>
              </div>
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
                            onClick={() => setIsMenuOpen(false)}
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
                      onClick={() => setIsMenuOpen(false)}
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
            
            {/* Logout Button */}
            <div className="px-4 py-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 lg:ml-0 min-h-screen">
          <main className="p-4 lg:p-8 pt-20 lg:pt-8">
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