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
  Info
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
      
      // Verificar horario operativo
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
        id: Date.now() + Math.random(),
        recipe,
        quantity,
        notes: notes || '',
        is_takeaway: isTakeaway,
        has_taper: hasTaper,
        unit_price: parseFloat(recipe.base_price || 0)
      };
      setCart([...cart, newItem]);
    }
    
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
      
      const operationalInfo = await apiService.restaurantConfig.getOperationalInfo();
      
      if (operationalInfo && operationalInfo.has_config && !operationalInfo.is_currently_open) {
        showError(`No se puede crear pedido. El restaurante está cerrado. Horario: ${operationalInfo.business_hours}`);
        return;
      }
      
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Mesa no encontrada</h2>
          <button 
            onClick={() => navigate('/table-status')}
            className="text-blue-600 hover:text-blue-800"
          >
            Volver al estado de mesas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/table-status')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="font-bold text-lg text-gray-900">Mesa {table.table_number}</h1>
                <p className="text-sm text-gray-600">{table.zone_name}</p>
              </div>
            </div>

            <button
              onClick={() => setShowCart(true)}
              className={`relative px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                getCartItemsCount() > 0 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}
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

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar platos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Group Filter */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="all">Todo el menú</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Menu Items */}
      <div className="px-4 py-4">
        {filteredRecipes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-500 mb-2">No se encontraron platos</div>
            <div className="text-sm text-gray-400">Intenta con otros términos</div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecipes.map((recipe) => (
              <div key={recipe.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">{recipe.name}</h3>
                    {recipe.description && (
                      <p className="text-sm text-gray-600 mb-2">{recipe.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="h-4 w-4" />
                      <span>{recipe.preparation_time} min</span>
                      <span>•</span>
                      <span>{recipe.group_name || 'Sin categoría'}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-xl font-bold text-gray-900">
                      {formatCurrency(recipe.base_price)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      addToCart(recipe);
                      showSuccess('Agregado al carrito');
                    }}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar
                  </button>
                  <button
                    onClick={() => openItemModal(recipe)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          {/* Cart Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Mi Pedido</h2>
                <p className="text-sm text-gray-600">Mesa {table.table_number}</p>
              </div>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {cart.length === 0 ? (
              <div className="text-center py-20">
                <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Tu carrito está vacío</h3>
                <p className="text-gray-600">Agrega algunos platos para comenzar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{item.recipe.name}</h4>
                        <p className="text-sm text-gray-600">
                          {formatCurrency(item.unit_price)} c/u
                        </p>
                        {item.notes && (
                          <div className="mt-1 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {item.notes}
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          {item.is_takeaway && (
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">
                              Para llevar
                            </span>
                          )}
                          {item.has_taper && (
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
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
                            className="w-8 h-8 bg-white border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-100"
                          >
                            <Minus className="h-4 w-4 text-gray-600" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 bg-white border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-100"
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
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-medium text-gray-700">Total</span>
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(calculateCartTotal())}</span>
              </div>
              
              <button
                onClick={handleCreateOrder}
                disabled={creatingOrder}
                className="w-full bg-green-600 text-white py-4 rounded-lg text-lg font-bold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {creatingOrder ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Procesando...
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
      )}

      {/* Item Details Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{selectedRecipe.name}</h3>
                  <p className="text-lg font-bold text-blue-600 mt-1">{formatCurrency(selectedRecipe.base_price)}</p>
                </div>
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
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

              {/* Quantity */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Cantidad</h4>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                    className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200"
                  >
                    <Minus className="h-5 w-5 text-gray-600" />
                  </button>
                  <span className="text-xl font-bold text-gray-900 w-12 text-center">{itemQuantity}</span>
                  <button
                    onClick={() => setItemQuantity(itemQuantity + 1)}
                    className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200"
                  >
                    <Plus className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Instrucciones especiales</h4>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Ej: Sin cebolla, término medio..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                  rows="3"
                />
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-medium text-gray-900">Para llevar</p>
                      <p className="text-sm text-gray-600">Empaque especial</p>
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
                  <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 ml-8">
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
                className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <ShoppingCart className="h-5 w-5" />
                Agregar al carrito • {formatCurrency(selectedRecipe.base_price * itemQuantity)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableOrderEcommerce;