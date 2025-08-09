import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Package, 
  Check,
  Search,
  X,
  Clock,
  Star,
  Filter,
  ChevronDown,
  Info,
  Sparkles
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
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  
  // Estados para modal de item
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [itemQuantity, setItemQuantity] = useState(1);
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

  const addToCart = (recipe, quantity = 1, notes = '', isTakeaway = false, hasTaper = false) => {
    const existingItem = cart.find(item => 
      item.recipe.id === recipe.id && 
      item.notes === notes && 
      item.is_takeaway === isTakeaway &&
      item.has_taper === hasTaper
    );

    if (existingItem) {
      setCart(cart.map(item => 
        item === existingItem 
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      const newItem = {
        id: Date.now() + Math.random(), // ID único temporal
        recipe,
        quantity,
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

  const updateCartItemQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      setCart(cart.filter(i => i.id !== itemId));
    } else {
      setCart(cart.map(i => 
        i.id === itemId 
          ? { ...i, quantity: newQuantity }
          : i
      ));
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(i => i.id !== itemId));
  };

  const resetItemModal = () => {
    setItemQuantity(1);
    setItemNotes('');
    setItemTakeaway(false);
    setItemTaper(false);
  };

  const openItemModal = (recipe) => {
    setSelectedRecipe(recipe);
    resetItemModal();
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

  const getSelectedGroupName = () => {
    if (selectedGroup === 'all') return 'Todo el menú';
    const group = groups.find(g => g.id === parseInt(selectedGroup));
    return group ? group.name : 'Todo el menú';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando menú...</p>
        </div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl p-8 shadow-lg">
          <Info className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Mesa no encontrada</h2>
          <button 
            onClick={() => navigate('/table-status')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Volver al estado de mesas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Fixed */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/table-status')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </button>
              <div>
                <h1 className="font-bold text-lg text-gray-900">Mesa {table.table_number}</h1>
                <p className="text-sm text-gray-600">{table.zone_name}</p>
              </div>
            </div>

            {/* Cart Button */}
            <button
              onClick={() => setShowCart(true)}
              className="relative bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <ShoppingCart className="h-5 w-5" />
              <span>{formatCurrency(calculateCartTotal())}</span>
              {getCartItemsCount() > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {getCartItemsCount()}
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="px-4 pb-3 border-t border-gray-100">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Buscar platos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
            <button
              onClick={() => setShowGroupSelector(!showGroupSelector)}
              className="px-4 py-2 bg-gray-100 rounded-lg flex items-center gap-2 hover:bg-gray-200 transition-colors"
            >
              <Filter className="h-5 w-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">{getSelectedGroupName()}</span>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          {/* Group Selector */}
          {showGroupSelector && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              <button
                onClick={() => {
                  setSelectedGroup('all');
                  setShowGroupSelector(false);
                }}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                  selectedGroup === 'all' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                }`}
              >
                Todo el menú
              </button>
              {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => {
                    setSelectedGroup(group.id.toString());
                    setShowGroupSelector(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-t border-gray-100 ${
                    selectedGroup === group.id.toString() ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  {group.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="px-4 py-4">
        {filteredRecipes.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron platos</h3>
            <p className="text-gray-600">Intenta con otros términos de búsqueda</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">{recipe.name}</h3>
                      {recipe.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{recipe.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1 text-gray-500">
                          <Clock className="h-4 w-4" />
                          <span>{recipe.preparation_time} min</span>
                        </div>
                        <div className="flex items-center gap-1 text-yellow-500">
                          <Star className="h-4 w-4 fill-current" />
                          <span className="text-gray-700 font-medium">4.8</span>
                        </div>
                        {recipe.is_new && (
                          <div className="flex items-center gap-1 text-green-600">
                            <Sparkles className="h-4 w-4" />
                            <span className="font-medium">Nuevo</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(recipe.base_price)}
                      </div>
                      <div className="text-xs text-gray-500">{recipe.group_name}</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        addToCart(recipe);
                        showSuccess('Agregado al carrito');
                      }}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="h-5 w-5" />
                      Agregar
                    </button>
                    <button
                      onClick={() => openItemModal(recipe)}
                      className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Info className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Modal */}
      {showCart && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50 transition-opacity"
            onClick={() => setShowCart(false)}
          />
          <div className="fixed inset-x-0 bottom-0 bg-white z-50 rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col animate-slide-up">
            {/* Cart Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Carrito de compras</h2>
                <p className="text-sm text-gray-600">{getCartItemsCount()} items</p>
              </div>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Tu carrito está vacío</h3>
                  <p className="text-gray-600">Agrega algunos platos para comenzar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{item.recipe.name}</h4>
                          <p className="text-sm text-gray-600">
                            {formatCurrency(item.unit_price)} c/u
                          </p>
                          {item.notes && (
                            <div className="mt-1 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                              {item.notes}
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            {item.is_takeaway && (
                              <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">
                                Para llevar
                              </span>
                            )}
                            {item.has_taper && (
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">
                                Con envase
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-bold text-lg text-gray-900 mb-2">
                            {formatCurrency(item.unit_price * item.quantity)}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 bg-white border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                            >
                              <Minus className="h-4 w-4 text-gray-600" />
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 bg-white border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                            >
                              <Plus className="h-4 w-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-medium text-gray-700">Total</span>
                  <span className="text-2xl font-bold text-gray-900">{formatCurrency(calculateCartTotal())}</span>
                </div>
                
                <button
                  onClick={handleCreateOrder}
                  disabled={creatingOrder}
                  className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {creatingOrder ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      Confirmar pedido
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Item Details Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto animate-slide-up">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{selectedRecipe.name}</h3>
                  <p className="text-lg font-bold text-blue-600 mt-1">{formatCurrency(selectedRecipe.base_price)}</p>
                </div>
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Description */}
              {selectedRecipe.description && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Descripción</h4>
                  <p className="text-gray-600">{selectedRecipe.description}</p>
                </div>
              )}

              {/* Quantity Selector */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Cantidad</h4>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                    className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Minus className="h-5 w-5 text-gray-600" />
                  </button>
                  <span className="text-xl font-bold text-gray-900 w-12 text-center">{itemQuantity}</span>
                  <button
                    onClick={() => setItemQuantity(itemQuantity + 1)}
                    className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Plus className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Special Instructions */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Instrucciones especiales</h4>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Ej: Sin cebolla, término medio..."
                  className="w-full px-4 py-3 bg-gray-100 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows="3"
                />
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-medium text-gray-900">Para llevar</p>
                      <p className="text-sm text-gray-600">Empaque especial para llevar</p>
                    </div>
                  </div>
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
                </label>

                {itemTakeaway && (
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors ml-8">
                    <div className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">Incluir envase</p>
                        <p className="text-sm text-gray-600">Envase biodegradable</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={itemTaper}
                      onChange={(e) => setItemTaper(e.target.checked)}
                      className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              <button
                onClick={() => {
                  addToCart(selectedRecipe, itemQuantity, itemNotes, itemTakeaway, itemTaper);
                  showSuccess(`${itemQuantity} ${selectedRecipe.name} agregado${itemQuantity > 1 ? 's' : ''}`);
                }}
                className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <ShoppingCart className="h-5 w-5" />
                Agregar al carrito • {formatCurrency(selectedRecipe.base_price * itemQuantity)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Safe Area */}
      <div className="h-20"></div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default TableOrderEcommerce;