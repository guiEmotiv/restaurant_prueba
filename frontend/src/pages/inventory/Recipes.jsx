import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ChefHat, Package, Search } from 'lucide-react';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import RecipeModal from '../../components/recipe/RecipeModalFixed';
import { useToast } from '../../contexts/ToastContext';

const Recipes = () => {
  const { showSuccess, showError } = useToast();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [groups, setGroups] = useState([]);
  const [filters, setFilters] = useState({
    name: '',
    group: ''
  });

  useEffect(() => {
    loadGroups();
    loadRecipes();
  }, []);

  useEffect(() => {
    loadRecipes();
  }, [filters]);

  const loadGroups = async () => {
    try {
      const data = await apiService.groups.getAll();
      setGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const params = { show_all: true };
      
      // Add filters to params
      if (filters.name) {
        params.search = filters.name;
      }
      if (filters.group) {
        params.group = filters.group;
      }
      
      const data = await apiService.recipes.getAll(params);
      setRecipes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading recipes:', error);
      showError('Error al cargar las recetas');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedRecipe(null);
    setIsModalOpen(true);
  };

  const handleEdit = (recipe) => {
    setSelectedRecipe(recipe);
    setIsModalOpen(true);
  };


  const handleModalSave = () => {
    loadRecipes();
  };

  const handleToggleAvailability = async (recipe) => {
    try {
      const updatedRecipe = {
        ...recipe,
        is_available: !recipe.is_available
      };
      await apiService.recipes.update(recipe.id, updatedRecipe);
      await loadRecipes();
      showSuccess(`Receta ${updatedRecipe.is_available ? 'habilitada' : 'deshabilitada'} exitosamente`);
    } catch (error) {
      console.error('Error updating recipe availability:', error);
      showError('Error al actualizar la disponibilidad de la receta');
    }
  };

  const handleToggleActive = async (recipe) => {
    try {
      // Solo enviar los campos necesarios para evitar efectos secundarios
      const updatedData = {
        name: recipe.name,
        version: recipe.version,
        group: recipe.group,
        base_price: recipe.base_price,
        profit_percentage: recipe.profit_percentage,
        preparation_time: recipe.preparation_time,
        is_available: recipe.is_available, // Mantener el valor actual
        is_active: !recipe.is_active // Solo cambiar este campo
      };
      await apiService.recipes.update(recipe.id, updatedData);
      await loadRecipes();
      showSuccess(`Receta ${updatedData.is_active ? 'activada' : 'desactivada'} exitosamente`);
    } catch (error) {
      console.error('Error updating recipe active status:', error);
      showError('Error al actualizar el estado activo de la receta');
    }
  };

  const handleDelete = async (recipe) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta receta?')) {
      try {
        await apiService.recipes.delete(recipe.id);
        await loadRecipes();
        showSuccess('Receta eliminada exitosamente');
      } catch (error) {
        console.error('Error deleting recipe:', error);
        if (error.response?.status === 400) {
          showError('No se puede eliminar esta receta porque está siendo usada en órdenes');
        } else {
          showError('Error al eliminar la receta');
        }
      }
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
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
          <p className="text-gray-600">Gestiona las recetas del menú</p>
        </div>
        <Button onClick={handleAdd} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nueva Receta
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar por nombre
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={filters.name}
                onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                placeholder="Buscar receta..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por grupo
            </label>
            <select
              value={filters.group}
              onChange={(e) => setFilters({ ...filters, group: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Todos los grupos</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Versión
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grupo
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio Base
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % Ganancia
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ingredientes
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activa
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recipes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    No hay recetas disponibles
                  </td>
                </tr>
              ) : (
                recipes.map((recipe) => (
                  <tr key={recipe.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                          <ChefHat className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{recipe.name}</div>
                          <div className="text-sm text-gray-500">Receta #{recipe.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        v{recipe.version}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {recipe.group_name ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {recipe.group_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Sin grupo</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      <div className="font-semibold">{formatCurrency(recipe.base_price)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {recipe.profit_percentage}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      <div className="flex items-center justify-center">
                        <Package className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-gray-600">{recipe.ingredients_count || 0} ingredientes</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {recipe.is_available_calculated ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Disponible
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Falta de stock
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleToggleActive(recipe)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          recipe.is_active 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        } transition-colors cursor-pointer`}
                        title={`Click para ${recipe.is_active ? 'desactivar' : 'activar'}`}
                      >
                        {recipe.is_active ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(recipe)}
                          className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Editar receta e ingredientes"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(recipe)}
                          className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Eliminar receta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden">
          {recipes.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <div className="text-4xl mb-2">🍳</div>
              <p className="text-lg font-medium">No hay recetas disponibles</p>
              <p className="text-sm">Las nuevas recetas aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {recipes.map((recipe) => (
                <div key={recipe.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="space-y-3">
                    {/* Recipe header */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                          <ChefHat className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{recipe.name}</h3>
                          <p className="text-sm text-gray-600">Receta #{recipe.id}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        recipe.is_available_calculated 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {recipe.is_available_calculated ? 'Disponible' : 'Falta de stock'}
                      </span>
                    </div>
                    
                    {/* Recipe details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="font-medium text-gray-500">Grupo</dt>
                        <dd className="text-base font-semibold text-gray-900">
                          {recipe.group_name ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {recipe.group_name}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Sin grupo</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-500">Precio</dt>
                        <dd className="text-base font-bold text-gray-900">{formatCurrency(recipe.base_price)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-500">Ganancia</dt>
                        <dd className="text-base font-semibold text-gray-900">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {recipe.profit_percentage}%
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-500">Tiempo</dt>
                        <dd className="text-base font-semibold text-gray-900">{recipe.preparation_time} min</dd>
                      </div>
                    </div>
                    
                    {/* Ingredients count */}
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Ingredientes</dt>
                      <dd className="text-sm text-gray-900 flex items-center">
                        <Package className="h-4 w-4 text-gray-400 mr-1" />
                        <span>{recipe.ingredients_count || 0} ingredientes</span>
                      </dd>
                    </div>
                    
                    {/* Date */}
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Fecha de creación</dt>
                      <dd className="text-sm text-gray-900">{new Date(recipe.created_at).toLocaleDateString('es-PE')}</dd>
                    </div>
                    
                    {/* Action buttons for mobile */}
                    <div className="flex gap-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => handleEdit(recipe)}
                        className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center flex items-center justify-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </button>
                      
                      <button
                        onClick={() => handleDelete(recipe)}
                        className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors text-center flex items-center justify-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Modales */}
      <RecipeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        recipe={selectedRecipe}
        onSave={handleModalSave}
      />
    </div>
  );
};

export default Recipes;