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
          <div className="animate-spin rounded h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-base text-gray-600">Cargando menú...</p>
        </div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-base font-medium text-gray-900 mb-2">Mesa no encontrada</h2>
          <button 
            onClick={() => navigate('/table-status')}
            className="text-blue-600 hover:text-blue-800 text-base"
          >
            Volver al estado de mesas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col h-full">
      {/* Header fijo estandarizado */}
      <div className="bg-white border-b border-gray-200">
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={() => navigate('/table-status')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              
              <div className="text-center flex-1">
                <h1 className="text-base font-medium text-gray-900">
                  Mesa {table.table_number}
                </h1>
                <p className="text-sm text-gray-500">{table.zone_name}</p>
              </div>
            </div>

            {/* Carrito estandarizado */}
            <button
              onClick={() => setShowCart(!showCart)}
              className="relative bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 text-base"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="hidden sm:inline font-medium">{formatCurrency(calculateCartTotal())}</span>
              {getCartItemsCount() > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded w-5 h-5 flex items-center justify-center text-sm font-medium">
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
          {/* Filtros estandarizados */}
          <div className="bg-white border-b border-gray-200 p-3">
            <div className="space-y-3">
              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar platos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Filtro por grupo */}
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

          {/* Grid de recetas estandarizado */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredRecipes.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-base font-medium text-gray-900 mb-2">No se encontraron platos</h3>
                  <p className="text-sm text-gray-500">
                    {searchTerm ? 'Intenta con otros términos' : 'No hay platos disponibles'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredRecipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="bg-white rounded border border-gray-200 overflow-hidden hover:bg-gray-50 transition-colors"
                  >
                    <div className="p-3">
                      {/* Header del item */}
                      <div className="mb-3">
                        <h3 className="font-medium text-gray-900 text-sm line-clamp-2">
                          {recipe.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {recipe.group_name || 'Sin grupo'}
                        </p>
                      </div>

                      {/* Precio y tiempo */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-base font-medium text-gray-900">
                          {formatCurrency(recipe.base_price)}
                        </span>
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {recipe.preparation_time}min
                        </span>
                      </div>

                      {/* Botones de acción estandarizados */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleQuickAdd(recipe)}
                          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus className="h-4 w-4" />
                          Agregar
                        </button>
                        <button
                          onClick={() => openItemModal(recipe)}
                          className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm"
                          title="Personalizar"
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

        {/* Panel del carrito estandarizado */}
        {showCart && (
          <div className="fixed right-0 top-0 h-full w-full sm:w-80 bg-white border-l border-gray-200 z-50 pt-16 sm:pt-0">
            <div className="flex flex-col h-full">
              {/* Header del carrito */}
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-medium text-gray-900">Tu Pedido</h2>
                  <button
                    onClick={() => setShowCart(false)}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-gray-600">
                    {getCartItemsCount()} items
                  </p>
                  <p className="text-base font-medium text-blue-600">
                    {formatCurrency(calculateCartTotal())}
                  </p>
                </div>
              </div>

              {/* Items del carrito */}
              <div className="flex-1 overflow-y-auto p-3">
                {cart.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-base font-medium text-gray-900 mb-2">Carrito vacío</h3>
                      <p className="text-sm text-gray-500">Agrega algunos platos</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.id} className="bg-gray-50 rounded border border-gray-200 p-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <h4 className="font-medium text-gray-900 text-sm line-clamp-1">
                                {item.recipe.name}
                              </h4>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="text-red-500 hover:text-red-700 p-1 ml-2"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between text-sm mt-2">
                              <span className="text-gray-600">
                                {item.quantity}x {formatCurrency(item.unit_price)}
                              </span>
                              <span className="font-medium text-gray-900">
                                {formatCurrency(item.unit_price * item.quantity)}
                              </span>
                            </div>

                            {item.notes && (
                              <p className="text-sm text-gray-600 mt-2 bg-yellow-50 px-2 py-1 rounded">
                                {item.notes}
                              </p>
                            )}

                            <div className="flex gap-2 mt-2">
                              {item.is_takeaway && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm">
                                  <Package className="h-4 w-4" />
                                  Para llevar
                                </span>
                              )}
                              {item.has_taper && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                                  <Check className="h-4 w-4" />
                                  Envase
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
                <div className="border-t border-gray-200 p-3 bg-gray-50">
                  <div className="mb-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700 text-base">Total:</span>
                      <span className="font-medium text-xl text-gray-900">{formatCurrency(calculateCartTotal())}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleCreateOrder}
                    disabled={creatingOrder}
                    className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700 disabled:opacity-50 font-medium text-base flex items-center justify-center gap-2"
                  >
                    {creatingOrder ? (
                      <>
                        <div className="animate-spin rounded h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Creando...
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

      {/* Modal estandarizado para agregar item */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header del modal */}
            <div className="relative p-3 bg-gray-50 border-b border-gray-200">
              <button
                onClick={() => setSelectedRecipe(null)}
                className="absolute top-3 right-3 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              
              <div className="pr-12">
                <h3 className="text-base font-medium text-gray-900 mb-1">
                  {selectedRecipe.name}
                </h3>
                <p className="text-sm text-blue-600">
                  {selectedRecipe.group_name || 'Sin grupo'}
                </p>
              </div>
            </div>

            <div className="p-3 space-y-4">
              {/* Precio destacado */}
              <div className="text-center py-3 bg-gray-50 rounded">
                <div className="text-xl font-medium text-gray-900">
                  {formatCurrency(selectedRecipe.base_price)}
                </div>
                <p className="text-sm text-gray-500 mt-1">Precio base</p>
              </div>

              {/* Descripción si existe */}
              {selectedRecipe.description && (
                <div className="p-3 bg-blue-50 rounded">
                  <p className="text-sm text-gray-700">
                    {selectedRecipe.description}
                  </p>
                </div>
              )}

              {/* Notas especiales */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas especiales (opcional)
                </label>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Ej: Sin cebolla, término medio, extra salsa..."
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                  rows={3}
                />
              </div>

              {/* Opciones de entrega */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Opciones de entrega</h4>
                
                <div className="space-y-2">
                  <label className="flex items-start gap-2 p-2 border border-gray-200 rounded hover:border-orange-300 hover:bg-orange-50 transition-colors cursor-pointer">
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
                      <p className="text-xs text-gray-500 mt-1">El pedido será preparado para llevar</p>
                    </div>
                  </label>

                  {itemTakeaway && (
                    <label className="flex items-start gap-2 p-2 ml-4 border border-gray-200 rounded hover:border-green-300 hover:bg-green-50 transition-colors cursor-pointer">
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
                        <p className="text-xs text-gray-500 mt-1">Se agregará un envase apropiado</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Footer del modal */}
            <div className="p-3 bg-gray-50 border-t border-gray-200">
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-100 transition-colors text-base"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    addToCart(selectedRecipe, itemNotes, itemTakeaway, itemTaper);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium flex items-center justify-center gap-2 transition-colors text-base"
                >
                  <Plus className="h-5 w-5" />
                  Agregar
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