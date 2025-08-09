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
        navigate('/');
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
      navigate('/');
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
    
    // Auto-open cart when adding first item
    if (cart.length === 0) {
      setShowCart(true);
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
      navigate('/');
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
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-800"
          >
            Volver al estado de mesas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
        <div className="px-3 py-3 pl-16">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-gray-600" />
              </button>
              <div>
                <h1 className="text-base font-medium text-gray-900">Mesa {table.table_number}</h1>
                <p className="text-xs text-gray-500">{table.zone_name}</p>
              </div>
            </div>

            <button
              onClick={() => setShowCart(true)}
              className="relative px-3 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm"
            >
              <ShoppingCart className="h-3 w-3" />
              {getCartItemsCount() > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">
                  {getCartItemsCount()}
                </div>
              )}
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Group Filter */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="all">Todo el menú</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Menu Items */}
      <div className="px-3 py-3" style={{paddingTop: '140px'}}>
        {filteredRecipes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-sm">No se encontraron platos</div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRecipes.map((recipe) => (
              <div key={recipe.id} className="bg-white rounded border border-gray-200 p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-sm text-gray-900 mb-1">{recipe.name}</h3>
                    {recipe.description && (
                      <p className="text-xs text-gray-600 mb-1">{recipe.description}</p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>{recipe.preparation_time} min</span>
                      <span>•</span>
                      <span>{recipe.group_name || 'Sin categoría'}</span>
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <div className="text-base font-semibold text-gray-900">
                      {formatCurrency(recipe.base_price)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => addToCart(recipe)}
                    className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 text-sm"
                  >
                    <Plus className="h-3 w-3" />
                    Agregar
                  </button>
                  <button
                    onClick={() => openItemModal(recipe)}
                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-3 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900">Carrito</h2>
              <button
                onClick={() => setShowCart(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-600">Carrito vacío</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{item.recipe.name}</h4>
                        <p className="text-xs text-gray-600">{formatCurrency(item.unit_price)} x {item.quantity}</p>
                        {item.notes && (
                          <p className="text-xs text-blue-600 mt-1">{item.notes}</p>
                        )}
                        <div className="flex gap-1 mt-1">
                          {item.is_takeaway && (
                            <span className="bg-orange-100 text-orange-700 px-1 py-0.5 rounded text-xs">Para llevar</span>
                          )}
                          {item.has_taper && (
                            <span className="bg-green-100 text-green-700 px-1 py-0.5 rounded text-xs">Con envase</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </span>
                        <button
                          onClick={() => updateCartItemQuantity(item.id, 0)}
                          className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {cart.length > 0 && (
            <div className="bg-white border-t border-gray-200 p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900">Total</span>
                <span className="text-base font-semibold text-gray-900">{formatCurrency(calculateCartTotal())}</span>
              </div>
              
              <button
                onClick={handleCreateOrder}
                disabled={creatingOrder}
                className="w-full bg-green-600 text-white py-3 rounded font-medium text-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {creatingOrder ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirmar Pedido
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Item Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t w-full max-h-[70vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">{selectedRecipe.name}</h3>
                  <p className="text-xs text-blue-600">{formatCurrency(selectedRecipe.base_price)}</p>
                </div>
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-3">
              {selectedRecipe.description && (
                <div>
                  <p className="text-xs text-gray-600">{selectedRecipe.description}</p>
                </div>
              )}

              <div>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Notas especiales..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500 resize-none"
                  rows="2"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center justify-between p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-orange-600" />
                    <span className="text-xs text-gray-900">Para llevar</span>
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
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                </label>

                {itemTakeaway && (
                  <label className="flex items-center justify-between p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-gray-900">Con envase</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={itemTaper}
                      onChange={(e) => setItemTaper(e.target.checked)}
                      className="w-4 h-4 text-green-600 rounded"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="bg-white border-t border-gray-200 p-3">
              <button
                onClick={() => {
                  addToCart(selectedRecipe, itemQuantity, itemNotes, itemTakeaway, itemTaper);
                }}
                className="w-full bg-blue-600 text-white py-3 rounded font-medium text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Agregar • {formatCurrency(selectedRecipe.base_price)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableOrderEcommerce;