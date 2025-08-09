import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { 
  ArrowLeft,
  Search,
  ShoppingCart,
  X,
  Trash2,
  Filter
} from 'lucide-react';
import { apiService } from '../../services/api';

const OrderCreate = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  const [table, setTable] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [containers, setContainers] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemNotes, setItemNotes] = useState('');
  const [isForTakeaway, setIsForTakeaway] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, [tableId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tableData, recipesData, groupsData, containersData] = await Promise.all([
        apiService.tables.getById(tableId),
        apiService.recipes.getAll(),
        apiService.groups.getAll(),
        apiService.containers.getAll()
      ]);
      setTable(tableData);
      setRecipes(Array.isArray(recipesData) ? recipesData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setContainers(Array.isArray(containersData) ? containersData : []);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = !selectedGroup || recipe.group === parseInt(selectedGroup);
    return matchesSearch && matchesGroup;
  });

  const addToCart = (recipe) => {
    setSelectedItem(recipe);
    setItemNotes('');
    setIsForTakeaway(false);
    setShowNotesModal(true);
  };

  const confirmAddToCart = () => {
    if (!selectedItem) return;
    
    const containerPrice = isForTakeaway ? (containers[0]?.price || 0) : 0;
    const totalPrice = parseFloat(selectedItem.price || 0) + containerPrice;
    
    const cartItem = {
      recipe: selectedItem,
      quantity: 1,
      notes: itemNotes,
      isForTakeaway,
      containerPrice,
      unitPrice: totalPrice
    };
    
    const existingItemIndex = cart.findIndex(item => 
      item.recipe.id === selectedItem.id && 
      item.notes === itemNotes && 
      item.isForTakeaway === isForTakeaway
    );
    
    if (existingItemIndex >= 0) {
      const updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, cartItem]);
    }
    
    setShowNotesModal(false);
    setSelectedItem(null);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.unitPrice * item.quantity), 0);
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
      
      // Preparar items para la orden
      const orderItems = cart.map(item => ({
        recipe: item.recipe.id,
        quantity: parseInt(item.quantity),
        unit_price: parseFloat((item.unitPrice || 0).toFixed(2)),
        total_price: parseFloat((item.unitPrice * item.quantity || 0).toFixed(2)),
        notes: item.notes || ''
      }));

      // Datos de la orden con items incluidos
      const orderData = {
        table: parseInt(tableId),
        total_amount: parseFloat(getCartTotal().toFixed(2)),
        items: orderItems
      };

      console.log('Creating order with data:', orderData);
      const result = await apiService.orders.create(orderData);
      console.log('Order created:', result);

      showSuccess('Pedido creado exitosamente');
      navigate(`/operations/table/${tableId}/manage`);
    } catch (error) {
      console.error('Error creating order:', error);
      console.error('Error details:', error.response?.data);
      
      // Mostrar detalles específicos del error de validación
      if (error.response?.data?.items) {
        const validationErrors = error.response.data.items;
        console.error('Validation errors:', validationErrors);
        showError('Error de validación: ' + JSON.stringify(validationErrors));
      } else {
        const errorMessage = error.response?.data?.detail || 
                             error.response?.data?.error || 
                             error.response?.data?.message ||
                             'Error al crear el pedido';
        showError(errorMessage);
      }
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
          <button
            onClick={() => navigate('/operations')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          
          <h1 className="text-lg font-bold text-gray-900">Nueva Cuenta</h1>
          
          <button
            onClick={() => navigate('/operations')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="pt-20 px-3">
        {/* Filtros */}
        <div className="mb-4 space-y-3">
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
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
            >
              <option value="">Todos los grupos</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de recetas */}
        <div className="space-y-3">
          {filteredRecipes.map((recipe) => (
            <div key={recipe.id} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{recipe.name || 'Sin nombre'}</h3>
                  <p className="text-lg font-bold text-green-600 mt-2">
                    {formatCurrency(parseFloat(recipe.price) || 0)}
                  </p>
                </div>
                
                <div className="ml-4 space-y-2">
                  <button
                    onClick={() => {
                      const totalPrice = parseFloat(recipe.price) || 0;
                      
                      if (totalPrice === 0) {
                        showError('Esta receta no tiene precio configurado');
                        return;
                      }
                      
                      const cartItem = {
                        recipe,
                        quantity: 1,
                        notes: '',
                        isForTakeaway: false,
                        containerPrice: 0,
                        unitPrice: totalPrice
                      };
                      
                      const existingItemIndex = cart.findIndex(item => 
                        item.recipe.id === recipe.id && 
                        item.notes === '' && 
                        item.isForTakeaway === false
                      );
                      
                      if (existingItemIndex >= 0) {
                        const updatedCart = [...cart];
                        updatedCart[existingItemIndex].quantity += 1;
                        setCart(updatedCart);
                      } else {
                        setCart([...cart, cartItem]);
                      }
                    }}
                    className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                  >
                    Agregar
                  </button>
                  <button
                    onClick={() => addToCart(recipe)}
                    className="w-full px-3 py-1.5 bg-gray-600 text-white rounded text-xs font-medium hover:bg-gray-700 transition-colors"
                  >
                    + Nota
                  </button>
                </div>
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

      {/* Botón carrito flotante */}
      <button
        onClick={() => setShowCart(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
      >
        <ShoppingCart className="h-6 w-6" />
        {getCartItemsCount() > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
            {getCartItemsCount()}
          </div>
        )}
      </button>

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
                  {cart.map((item, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{item.recipe.name}</h3>
                          <p className="text-sm text-gray-600">{formatCurrency(item.unitPrice)} × {item.quantity}</p>
                          {item.notes && (
                            <p className="text-xs text-blue-600 mt-1">📝 {item.notes}</p>
                          )}
                          {item.isForTakeaway && (
                            <p className="text-xs text-orange-600 mt-1">📦 Para llevar (+{formatCurrency(item.containerPrice)})</p>
                          )}
                        </div>
                        
                        <button
                          onClick={() => removeFromCart(index)}
                          className="p-2 hover:bg-red-100 rounded text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-lg font-bold text-green-600">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </span>
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

      {/* Modal de notas */}
      {showNotesModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Agregar Item</h2>
              <button
                onClick={() => setShowNotesModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900 mb-1">{selectedItem.name}</h3>
                <p className="text-sm text-gray-600">{selectedItem.description}</p>
                <p className="text-lg font-bold text-green-600 mt-2">
                  {formatCurrency(selectedItem.price || 0)}
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notas especiales
                  </label>
                  <textarea
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder="Ej: Sin cebolla, extra queso..."
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="3"
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">Para llevar</span>
                    {containers.length > 0 && (
                      <span className="text-sm text-gray-500">
                        (+{formatCurrency(containers[0]?.price || 0)})
                      </span>
                    )}
                  </div>
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isForTakeaway}
                      onChange={(e) => setIsForTakeaway(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                {isForTakeaway && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-800">
                      Se añadirá automáticamente el costo del envase al precio del item.
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-gray-900">Total:</span>
                <span className="text-lg font-bold text-green-600">
                  {formatCurrency((selectedItem.price || 0) + (isForTakeaway ? (containers[0]?.price || 0) : 0))}
                </span>
              </div>
              
              <button
                onClick={confirmAddToCart}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Agregar al Carrito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderCreate;