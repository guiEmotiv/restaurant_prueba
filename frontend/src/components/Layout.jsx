import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  History
} from 'lucide-react';

const Layout = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { 
      name: 'Configuración', 
      icon: Settings,
      children: [
        { name: 'Categorías', href: '/categories', icon: Tag },
        { name: 'Unidades', href: '/units', icon: Ruler },
        { name: 'Zonas', href: '/zones', icon: MapPin },
        { name: 'Mesas', href: '/tables', icon: Table },
      ]
    },
    { 
      name: 'Inventario', 
      icon: Package,
      children: [
        { name: 'Grupos', href: '/groups', icon: Layers },
        { name: 'Ingredientes', href: '/ingredients', icon: Apple },
        { name: 'Recetas', href: '/recipes', icon: ChefHat },
      ]
    },
    { name: 'Órdenes', href: '/orders', icon: ShoppingCart },
    { name: 'Cocina', href: '/kitchen', icon: Utensils },
    { name: 'Pagos', href: '/payments', icon: CreditCard },
    { name: 'Historial', href: '/payment-history', icon: History },
  ];

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