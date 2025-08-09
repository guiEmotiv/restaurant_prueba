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
  Clock
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
      showSuccess('Pedido creado exitosamente');
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando menú...</p>
        </div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Mesa no encontrada</h2>
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
    <div className="fixed inset-0 bg-gray-50 flex flex-col h-full">
      {/* Header fijo estilo moderno */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/table-status')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Mesa {table.table_number}
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>{table.zone_name}</span>
                  {table.capacity && (
                    <>
                      <span>•</span>
                      <Users className="h-4 w-4" />
                      <span>{table.capacity} personas</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Carrito con estilo mejorado */}
            <button
              onClick={() => setShowCart(!showCart)}
              className="relative bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-3 shadow-lg transition-all duration-200 transform hover:scale-105"
            >
              <ShoppingCart className="h-5 w-5" />
              <div className="flex flex-col items-start">
                <span className="font-semibold text-sm">Carrito</span>
                <span className="text-xs opacity-90">{formatCurrency(calculateCartTotal())}</span>
              </div>
              {getCartItemsCount() > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold animate-pulse">
                  {getCartItemsCount()}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Panel principal del menú */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${showCart ? 'hidden sm:flex sm:mr-80' : 'flex'}`}>
          {/* Filtros fijos */}
          <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
            <div className="space-y-3">
              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar platos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Filtro por grupo */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-600" />
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="flex-1 px-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
          </div>

          {/* Grid de recetas scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredRecipes.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron platos</h3>
                  <p className="text-gray-500">
                    {searchTerm ? 'Intenta con otros términos de búsqueda' : 'No hay platos disponibles en este momento'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                {filteredRecipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 group"
                  >
                    {/* Imagen placeholder con gradiente */}
                    <div className="h-32 bg-gradient-to-br from-blue-50 to-indigo-100 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                      <div className="absolute top-2 right-2">
                        <div className="bg-white/90 backdrop-blur-sm rounded-full p-1">
                          <Clock className="h-3 w-3 text-gray-600" />
                        </div>
                      </div>
                      <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1">
                        <span className="text-xs font-medium text-gray-700">{recipe.preparation_time}min</span>
                      </div>
                    </div>

                    <div className="p-4">
                      {/* Header del item */}
                      <div className="mb-3">
                        <h3 className="font-semibold text-gray-900 text-base line-clamp-2 group-hover:text-blue-600 transition-colors">
                          {recipe.name}
                        </h3>
                        <p className="text-xs text-blue-600 font-medium mt-1">
                          {recipe.group_name || 'Sin grupo'}
                        </p>
                      </div>

                      {/* Descripción */}
                      {recipe.description && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                          {recipe.description}
                        </p>
                      )}

                      {/* Precio destacado */}
                      <div className="mb-4">
                        <span className="text-2xl font-bold text-gray-900">
                          {formatCurrency(recipe.base_price)}
                        </span>
                      </div>

                      {/* Botones de acción mejorados */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleQuickAdd(recipe)}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg transform hover:scale-105"
                        >
                          <Plus className="h-4 w-4" />
                          Agregar
                        </button>
                        <button
                          onClick={() => openItemModal(recipe)}
                          className="px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 text-sm"
                          title="Personalizar pedido"
                        >
                          <StickyNote className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overlay para móviles */}
        {showCart && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
            onClick={() => setShowCart(false)}
          />
        )}

        {/* Panel del carrito (sidebar) mejorado */}
        {showCart && (
          <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white border-l border-gray-200 shadow-2xl z-50 pt-20 sm:pt-0">
            <div className="flex flex-col h-full">
              {/* Header del carrito */}
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-gray-900">Tu Pedido</h2>
                  <button
                    onClick={() => setShowCart(false)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white/50 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {getCartItemsCount()} {getCartItemsCount() === 1 ? 'producto' : 'productos'}
                  </p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(calculateCartTotal())}
                  </p>
                </div>
              </div>

              {/* Items del carrito */}
              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="bg-gray-100 rounded-full p-6 w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                        <ShoppingCart className="h-12 w-12 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Tu carrito está vacío</h3>
                      <p className="text-gray-500">Agrega algunos platos deliciosos</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3">
                          {/* Imagen placeholder */}
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 font-bold text-lg">
                              {item.recipe.name.charAt(0)}
                            </span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">
                                {item.recipe.name}
                              </h4>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-lg transition-colors ml-2"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between text-sm mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500">Cant:</span>
                                <span className="font-semibold bg-gray-100 px-2 py-1 rounded-md">{item.quantity}</span>
                              </div>
                              <span className="font-bold text-gray-900 text-base">
                                {formatCurrency(item.unit_price * item.quantity)}
                              </span>
                            </div>

                            {item.notes && (
                              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-xs text-yellow-800">
                                  <strong>Notas:</strong> {item.notes}
                                </p>
                              </div>
                            )}

                            <div className="flex gap-2 mt-2">
                              {item.is_takeaway && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                  <Package className="h-3 w-3" />
                                  Para llevar
                                </span>
                              )}
                              {item.has_taper && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                  <Check className="h-3 w-3" />
                                  Con envase
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer del carrito */}
              {cart.length > 0 && (
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                  <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                    <div className="flex items-center justify-between text-lg">
                      <span className="font-semibold text-gray-700">Total:</span>
                      <span className="font-bold text-2xl text-gray-900">{formatCurrency(calculateCartTotal())}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleCreateOrder}
                    disabled={creatingOrder}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-xl hover:from-green-700 hover:to-green-800 disabled:opacity-50 font-semibold flex items-center justify-center gap-2 shadow-lg transition-all duration-200 transform hover:scale-105"
                  >
                    {creatingOrder ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
          </div>
        )}
      </div>

      {/* Modal para agregar item con opciones mejorado */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header del modal */}
            <div className="relative p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
              <button
                onClick={() => setSelectedRecipe(null)}
                className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-white/50 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              
              <div className="pr-12">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {selectedRecipe.name}
                </h3>
                <p className="text-blue-600 text-sm font-medium">
                  {selectedRecipe.group_name || 'Sin grupo'}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Precio destacado */}
              <div className="text-center py-4 bg-gray-50 rounded-xl">
                <div className="text-3xl font-bold text-gray-900">
                  {formatCurrency(selectedRecipe.base_price)}
                </div>
                <p className="text-sm text-gray-600 mt-1">Precio base</p>
              </div>

              {/* Descripción si existe */}
              {selectedRecipe.description && (
                <div className="p-4 bg-blue-50 rounded-xl">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {selectedRecipe.description}
                  </p>
                </div>
              )}

              {/* Notas especiales */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Notas especiales (opcional)
                </label>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Ej: Sin cebolla, término medio, extra salsa..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                  rows={3}
                />
              </div>

              {/* Opciones de entrega */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700">Opciones de entrega</h4>
                
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemTakeaway}
                      onChange={(e) => {
                        setItemTakeaway(e.target.checked);
                        if (e.target.checked) {
                          setItemTaper(true);
                        }
                      }}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 mt-0.5"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <Package className="h-4 w-4 text-orange-600" />
                        Para llevar
                      </span>
                      <p className="text-xs text-gray-600 mt-1">El pedido será preparado para llevar</p>
                    </div>
                  </label>

                  {itemTakeaway && (
                    <label className="flex items-start gap-3 p-3 ml-6 border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={itemTaper}
                        onChange={(e) => setItemTaper(e.target.checked)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500 mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          Incluir envase
                        </span>
                        <p className="text-xs text-gray-600 mt-1">Se agregará un envase apropiado</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Footer del modal */}
            <div className="p-6 bg-gray-50 rounded-b-2xl">
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-100 hover:border-gray-400 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    addToCart(selectedRecipe, itemNotes, itemTakeaway, itemTaper);
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 font-semibold flex items-center justify-center gap-2 shadow-lg transition-all duration-200 transform hover:scale-105"
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