import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Package, 
  StickyNote, 
  Check,
  AlertCircle,
  Filter,
  Search,
  Users,
  Clock,
  Star,
  Heart,
  Utensils,
  Coffee,
  X
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const TableOrderEcommerce = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  
  // Estados principales
  const [table, setTable] = useState(null);
  const [groups, setGroups] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  
  // Estados de filtros y UI
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCart, setShowCart] = useState(false);
  
  // Estados para modal de item
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [itemNotes, setItemNotes] = useState('');
  const [itemTakeaway, setItemTakeaway] = useState(false);
  const [itemTaper, setItemTaper] = useState(false);

  useEffect(() => {
    loadData();
  }, [tableId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Primero verificar horario operativo
      const operationalInfo = await apiService.restaurantConfig.getOperationalInfo();
      
      if (operationalInfo && operationalInfo.has_config && !operationalInfo.is_currently_open) {
        showError(`El restaurante está cerrado. Horario de atención: ${operationalInfo.business_hours}`);
        navigate('/table-status');
        return;
      }
      
      const [tableData, groupsData, recipesData] = await Promise.all([
        apiService.tables.getById(tableId),
        apiService.groups.getAll(),
        apiService.recipes.getAll()
      ]);
      
      setTable(tableData);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      // Solo recetas activas con stock
      const availableRecipes = recipesData.filter(recipe => recipe.is_active && recipe.available !== false);
      setRecipes(availableRecipes);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar los datos');
      navigate('/table-status');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (recipe, notes = '', isTakeaway = false, hasTaper = false) => {
    const existingItem = cart.find(item => 
      item.recipe.id === recipe.id && 
      item.notes === notes && 
      item.is_takeaway === isTakeaway &&
      item.has_taper === hasTaper
    );

    if (existingItem) {
      setCart(cart.map(item => 
        item === existingItem 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      const newItem = {
        id: Date.now() + Math.random(), // ID único temporal
        recipe,
        quantity: 1,
        notes: notes || '',
        is_takeaway: isTakeaway,
        has_taper: hasTaper,
        unit_price: parseFloat(recipe.base_price || 0)
      };
      setCart([...cart, newItem]);
    }
    
    // Cerrar modal si está abierto
    setSelectedRecipe(null);
    resetItemModal();
  };

  const removeFromCart = (itemId) => {
    const item = cart.find(i => i.id === itemId);
    if (item && item.quantity > 1) {
      setCart(cart.map(i => 
        i.id === itemId 
          ? { ...i, quantity: i.quantity - 1 }
          : i
      ));
    } else {
      setCart(cart.filter(i => i.id !== itemId));
    }
  };

  const resetItemModal = () => {
    setItemNotes('');
    setItemTakeaway(false);
    setItemTaper(false);
  };

  const openItemModal = (recipe) => {
    setSelectedRecipe(recipe);
    resetItemModal();
  };

  const handleQuickAdd = (recipe) => {
    addToCart(recipe);
    showSuccess('Agregado al carrito');
  };

  const calculateCartTotal = () => {
    return cart.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
  };

  const getCartItemsCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesGroup = selectedGroup === 'all' || recipe.group === parseInt(selectedGroup);
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (recipe.description && recipe.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesGroup && matchesSearch;
  });

  const handleCreateOrder = async () => {
    if (cart.length === 0) {
      showError('El carrito está vacío');
      return;
    }

    try {
      setCreatingOrder(true);
      
      // Verificar horario operativo antes de crear pedido
      const operationalInfo = await apiService.restaurantConfig.getOperationalInfo();
      
      if (operationalInfo && operationalInfo.has_config && !operationalInfo.is_currently_open) {
        showError(`No se puede crear pedido. El restaurante está cerrado. Horario: ${operationalInfo.business_hours}`);
        return;
      }
      
      // Convertir items del carrito al formato del backend
      const itemsArray = [];
      cart.forEach(cartItem => {
        for (let i = 0; i < cartItem.quantity; i++) {
          itemsArray.push({
            recipe: cartItem.recipe.id,
            notes: cartItem.notes || '',
            is_takeaway: cartItem.is_takeaway || false,
            has_taper: cartItem.has_taper || false
          });
        }
      });

      const orderData = {
        table: parseInt(tableId),
        waiter: user?.username || 'Sistema',
        items: itemsArray
      };

      await apiService.orders.create(orderData);
      showSuccess('¡Pedido creado exitosamente!');
      navigate('/table-status');
    } catch (error) {
      console.error('Error creating order:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message;
      showError('Error al crear el pedido: ' + errorMessage);
    } finally {
      setCreatingOrder(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-200 border-t-blue-600"></div>
          </div>
          <p className="text-gray-600 font-medium">Cargando menú...</p>
        </div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Mesa no encontrada</h2>
          <button 
            onClick={() => navigate('/table-status')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Volver al estado de mesas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header Moderno */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white sticky top-0 z-40 shadow-lg">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => navigate('/table-status')}
                className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-blue-200" />
                  <h1 className="font-bold">Mesa {table.table_number}</h1>
                </div>
                <p className="text-blue-100 text-sm">{table.zone_name}</p>
              </div>
            </div>

            {/* Carrito Button */}
            <button
              onClick={() => setShowCart(!showCart)}
              className="relative bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-xl hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="font-bold">{formatCurrency(calculateCartTotal())}</span>
              {getCartItemsCount() > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {getCartItemsCount()}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="space-y-3">
          {/* Búsqueda */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar platos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filtro por grupo */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todos los grupos</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className={`flex-1 transition-all duration-300 ${showCart ? 'pb-96' : ''}`}>
        <div className="px-4 py-6">
          {filteredRecipes.length === 0 ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="text-center bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No se encontraron platos</h3>
                <p className="text-gray-500">
                  {searchTerm ? 'Intenta con otros términos de búsqueda' : 'No hay platos disponibles'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden group hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]"
                >
                  {/* Product Image Placeholder */}
                  <div className="relative h-40 sm:h-48 bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                      <Coffee className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500" />
                    </div>
                    
                    {/* Quick Add Button */}
                    <button
                      onClick={() => handleQuickAdd(recipe)}
                      className="absolute top-3 right-3 w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-colors transform hover:scale-110"
                    >
                      <Plus className="h-5 w-5" />
                    </button>

                    {/* Badge de tiempo */}
                    <div className="absolute bottom-3 left-3 bg-black/20 backdrop-blur-sm text-white px-3 py-1 rounded-xl text-sm flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {recipe.preparation_time}min
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-6">
                    <div className="mb-3">
                      <h3 className="font-bold text-gray-900 text-lg mb-1 line-clamp-2">
                        {recipe.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {recipe.group_name || 'Sin grupo'}
                      </p>
                    </div>

                    {/* Precio */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-xl sm:text-2xl font-bold text-emerald-600">
                        {formatCurrency(recipe.base_price)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-gray-600">4.5</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleQuickAdd(recipe)}
                        className="flex-1 bg-emerald-500 text-white py-2 sm:py-3 rounded-xl text-sm sm:text-base font-semibold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Agregar
                      </button>
                      <button
                        onClick={() => openItemModal(recipe)}
                        className="w-12 h-12 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center"
                        title="Personalizar"
                      >
                        <StickyNote className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Carrito */}
      {showCart && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowCart(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white z-50 max-h-[80vh] overflow-hidden rounded-t-3xl shadow-2xl border border-gray-200">
            {/* Header del carrito */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Tu Pedido</h2>
                  <p className="text-blue-100">
                    {getCartItemsCount()} items • {formatCurrency(calculateCartTotal())}
                  </p>
                </div>
                <button
                  onClick={() => setShowCart(false)}
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Items del carrito */}
            <div className="flex-1 overflow-y-auto px-6 py-4 max-h-60">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Carrito vacío</h3>
                  <p className="text-gray-500">Agrega algunos platos para comenzar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-red-100 rounded-xl flex items-center justify-center">
                        <Coffee className="h-6 w-6 text-orange-500" />
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{item.recipe.name}</h4>
                        <p className="text-sm text-gray-600">
                          {item.quantity}x {formatCurrency(item.unit_price)}
                        </p>
                        {item.notes && (
                          <p className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-lg mt-1">
                            {item.notes}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          {item.is_takeaway && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs">
                              <Package className="h-3 w-3" />
                              Para llevar
                            </span>
                          )}
                          {item.has_taper && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">
                              <Check className="h-3 w-3" />
                              Envase
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold text-gray-900">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer del carrito */}
            {cart.length > 0 && (
              <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-semibold text-gray-700">Total:</span>
                  <span className="text-2xl font-bold text-gray-900">{formatCurrency(calculateCartTotal())}</span>
                </div>
                <button
                  onClick={handleCreateOrder}
                  disabled={creatingOrder}
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {creatingOrder ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Creando pedido...
                    </>
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      Confirmar Pedido
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal para personalizar item */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-100 to-red-100 p-6 relative">
              <button
                onClick={() => setSelectedRecipe(null)}
                className="absolute top-4 right-4 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4">
                  <Coffee className="h-8 w-8 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedRecipe.name}
                </h3>
                <div className="text-2xl font-bold text-emerald-600 mt-2">
                  {formatCurrency(selectedRecipe.base_price)}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Notas */}
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Notas especiales (opcional)
                </label>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Ej: Sin cebolla, término medio..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Opciones */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemTakeaway}
                    onChange={(e) => {
                      setItemTakeaway(e.target.checked);
                      if (e.target.checked) {
                        setItemTaper(true);
                      }
                    }}
                    className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <Package className="h-5 w-5 text-orange-600" />
                  <span className="font-semibold text-gray-900">Para llevar</span>
                </label>

                {itemTakeaway && (
                  <label className="flex items-center gap-3 p-4 ml-6 border-2 border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemTaper}
                      onChange={(e) => setItemTaper(e.target.checked)}
                      className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                    />
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-gray-900">Incluir envase</span>
                  </label>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="flex-1 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    addToCart(selectedRecipe, itemNotes, itemTakeaway, itemTaper);
                    showSuccess(`${selectedRecipe.name} agregado al carrito`);
                  }}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Agregar al carrito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableOrderEcommerce;