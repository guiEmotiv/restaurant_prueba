import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { 
  ArrowLeft,
  Search,
  Plus,
  Minus,
  ShoppingCart,
  X,
  DollarSign
} from 'lucide-react';
import { apiService } from '../../services/api';

const OrderCreate = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const [table, setTable] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, [tableId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tableData, recipesData] = await Promise.all([
        apiService.tables.getById(tableId),
        apiService.recipes.getAll()
      ]);
      setTable(tableData);
      setRecipes(Array.isArray(recipesData) ? recipesData : []);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipes = recipes.filter(recipe =>
    recipe.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (recipe) => {
    const existingItem = cart.find(item => item.recipe.id === recipe.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.recipe.id === recipe.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { recipe, quantity: 1 }]);
    }
  };

  const updateQuantity = (recipeId, newQuantity) => {
    if (newQuantity <= 0) {
      setCart(cart.filter(item => item.recipe.id !== recipeId));
    } else {
      setCart(cart.map(item =>
        item.recipe.id === recipeId
          ? { ...item, quantity: newQuantity }
          : item
      ));
    }
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.recipe.price * item.quantity), 0);
  };

  const getCartItemsCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const handleCreateOrder = async () => {
    if (cart.length === 0) {
      showError('Agrega items al pedido');
      return;
    }

    try {
      setCreating(true);
      
      const orderData = {
        table: parseInt(tableId),
        total_amount: getCartTotal()
      };

      const order = await apiService.orders.create(orderData);

      for (const item of cart) {
        await apiService.orderItems.create({
          order: order.id,
          recipe: item.recipe.id,
          quantity: item.quantity,
          unit_price: item.recipe.price,
          total_price: item.recipe.price * item.quantity
        });
      }

      showSuccess('Pedido creado exitosamente');
      navigate(`/operations/table/${tableId}/manage`);
    } catch (error) {
      console.error('Error creating order:', error);
      showError('Error al crear el pedido');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-40 px-4 py-3 border-b">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="pt-20 px-3 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header fijo */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-40 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/operations')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Nueva Cuenta</h1>
              <p className="text-xs text-gray-500">Mesa {table?.number}</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowCart(true)}
            className="relative p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ShoppingCart className="h-5 w-5" />
            {getCartItemsCount() > 0 && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">
                {getCartItemsCount()}
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="pt-20 px-3">
        {/* Buscador */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar recetas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Lista de recetas */}
        <div className="space-y-3">
          {filteredRecipes.map((recipe) => (
            <div key={recipe.id} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{recipe.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{recipe.description}</p>
                  <p className="text-lg font-bold text-green-600 mt-2">
                    {formatCurrency(recipe.price)}
                  </p>
                </div>
                
                <button
                  onClick={() => addToCart(recipe)}
                  className="ml-4 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredRecipes.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No se encontraron recetas</p>
          </div>
        )}
      </div>

      {/* Modal del carrito */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white w-full max-h-[80vh] rounded-t-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Carrito</h2>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 max-h-96 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Carrito vacío</p>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.recipe.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{item.recipe.name}</h3>
                        <p className="text-sm text-gray-600">{formatCurrency(item.recipe.price)}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.recipe.id, item.quantity - 1)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.recipe.id, item.quantity + 1)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {cart.length > 0 && (
              <div className="p-4 border-t bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-bold text-gray-900">Total:</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(getCartTotal())}
                  </span>
                </div>
                
                <button
                  onClick={handleCreateOrder}
                  disabled={creating}
                  className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creando...' : 'Crear Pedido'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderCreate;