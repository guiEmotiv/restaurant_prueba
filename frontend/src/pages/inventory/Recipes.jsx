import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ChefHat, Package, Search, FileSpreadsheet, Calculator } from 'lucide-react';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import RecipeModal from '../../components/recipe/RecipeModalOptimized';
import GenericExcelImportModal from '../../components/common/GenericExcelImportModal';
import { EXCEL_IMPORT_CONFIGS } from '../../utils/excelImportConfigs';
import { useToast } from '../../contexts/ToastContext';

const Recipes = () => {
  const { showSuccess, showError } = useToast();
  const [recipes, setRecipes] = useState([]);
  const [filteredRecipes, setFilteredRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [groups, setGroups] = useState([]);
  const [nameFilter, setNameFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [availableFilter, setAvailableFilter] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    loadGroups();
    loadRecipes();
  }, []);

  useEffect(() => {
    // Filtrar recetas cuando cambian los filtros
    let filtered = recipes;
    
    if (nameFilter) {
      filtered = filtered.filter(recipe => 
        recipe.name.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }
    
    if (groupFilter) {
      filtered = filtered.filter(recipe => {
        const groupId = recipe.group_id || recipe.group?.id;
        const filterGroupId = parseInt(groupFilter);
        
        // Comparar tanto como number como string para mayor compatibilidad
        return groupId === filterGroupId || groupId === groupFilter || String(groupId) === String(filterGroupId);
      });
    }
    
    if (availableFilter !== '') {
      const isAvailable = availableFilter === 'true';
      filtered = filtered.filter(recipe => 
        recipe.is_available_calculated === isAvailable
      );
    }
    
    setFilteredRecipes(filtered);
  }, [recipes, nameFilter, groupFilter, availableFilter]);

  const loadGroups = async () => {
    try {
      const data = await apiService.groups.getAll();
      setGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };


  const loadRecipes = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      
      const params = { show_all: true };
      
      const data = await apiService.recipes.getAll(params);
      // Ordenar por ID descendente para mostrar las más recientes primero
      const sortedData = Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [];
      
      // Optimización: solo actualizar si hay cambios reales
      if (JSON.stringify(sortedData) !== JSON.stringify(recipes)) {
        setRecipes(sortedData);
      }
      
    } catch (error) {
      if (!silent) {
        showError('Error al cargar las recetas');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleAdd = () => {
    setSelectedRecipe(null);
    setIsModalOpen(true);
  };

  const handleEdit = async (recipe) => {
    try {
      // Cargar la receta completa con ingredientes desde el API
      const fullRecipe = await apiService.recipes.getById(recipe.id);
      setSelectedRecipe(fullRecipe);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error loading full recipe:', error);
      showError('Error al cargar la receta');
    }
  };


  const handleModalSave = () => {
    loadRecipes();
  };

  const handleImportExcel = () => {
    setShowImportModal(true);
  };

  const handleImportSuccess = () => {
    // Use silent reload to avoid showing loading state unnecessarily
    loadRecipes(false); // Force full reload after import
    setShowImportModal(false);
  };

  // ❌ REMOVED: Manual availability toggle - now purely informational based on stock

  const handleToggleActive = async (recipe) => {
    try {
      const newActiveStatus = !recipe.is_active;
      
      // ⚠️ WARNING: Activating this version will deactivate other versions of the same recipe
      if (newActiveStatus) {
        const confirmMessage = `¿Activar "${recipe.name} v${recipe.version}"?\n\nEsto desactivará automáticamente otras versiones activas del mismo plato.`;
        if (!window.confirm(confirmMessage)) {
          return;
        }
      }
      
      const updatedData = {
        name: recipe.name,
        version: recipe.version,
        group: recipe.group,
        base_price: recipe.base_price,
        profit_percentage: recipe.profit_percentage,
        preparation_time: recipe.preparation_time,
        is_available: recipe.is_available,
        is_active: newActiveStatus
      };
      
      await apiService.recipes.update(recipe.id, updatedData);
      await loadRecipes();
      
      showSuccess(
        newActiveStatus 
          ? `✅ Versión ${recipe.version} de "${recipe.name}" activada. Otras versiones desactivadas automáticamente.`
          : `❌ Versión ${recipe.version} de "${recipe.name}" desactivada`
      );
    } catch (error) {
      showError('Error al actualizar el estado de la versión');
    }
  };

  const handleRecalculatePrice = async (recipe) => {
    if (!window.confirm(`¿Recalcular el precio de "${recipe.name}" basado en el costo actual de ingredientes?`)) {
      return;
    }

    try {
      setLoading(true);
      // Use the dedicated update_price endpoint
      await apiService.recipes.updatePrice(recipe.id);

      await loadRecipes();
      showSuccess(`✅ Precio recalculado para "${recipe.name}"`);
    } catch (error) {
      showError('Error al recalcular el precio');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recipe) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta receta?')) {
      try {
        await apiService.recipes.delete(recipe.id);
        await loadRecipes();
        showSuccess('Receta eliminada exitosamente');
      } catch (error) {
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recipes - Gestión de Recetas</h1>
        <p className="text-sm text-gray-600 mt-1">Administra las recetas y sus precios</p>
      </div>
      <div className="flex items-center justify-end gap-3">
        <Button 
          variant="outline"
          onClick={handleImportExcel}
          className="flex items-center gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Importar Excel
        </Button>
        <Button onClick={handleAdd} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nueva Receta
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
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
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Todos ({recipes.length})</option>
              {groups.map((group) => {
                const count = recipes.filter(r => {
                  const groupId = r.group_id || r.group?.id;
                  return groupId === group.id || groupId === String(group.id) || String(groupId) === String(group.id);
                }).length;
                
                return (
                  <option key={group.id} value={group.id}>
                    {group.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por disponibilidad
            </label>
            <select
              value={availableFilter}
              onChange={(e) => setAvailableFilter(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Todas ({recipes.length})</option>
              <option value="true">Con stock ({recipes.filter(r => r.is_available_calculated).length})</option>
              <option value="false">Sin stock ({recipes.filter(r => !r.is_available_calculated).length})</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setNameFilter('');
                setGroupFilter('');
                setAvailableFilter('');
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Limpiar filtros
            </button>
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
                  ID
                </th>
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
                  Envase
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Impresora
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio Base
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % Ganancia
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tiempo Prep.
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ingredientes
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Disponible
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recipes.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-4 text-center text-gray-500">
                    No hay recetas disponibles
                  </td>
                </tr>
              ) : (
                filteredRecipes.map((recipe) => (
                  <tr key={recipe.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {recipe.id}
                    </td>
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
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        recipe.is_active 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-500'
                      }`}>
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
                      {recipe.container_name ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                          {recipe.container_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Sin envase</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {recipe.printer_name ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-800">
                          {recipe.printer_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Sin impresora</span>
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
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                        {recipe.preparation_time || 0} min
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
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          <span className="w-2 h-2 bg-green-600 rounded-full mr-1"></span>
                          Stock OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          <span className="w-2 h-2 bg-red-600 rounded-full mr-1"></span>
                          Sin Stock
                        </span>
                      )}
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
                          onClick={() => handleRecalculatePrice(recipe)}
                          className="text-green-600 hover:text-green-900 p-2 rounded-lg hover:bg-green-50 transition-colors"
                          title="Recalcular precio basado en ingredientes actuales"
                          disabled={loading}
                        >
                          <Calculator className="h-4 w-4" />
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
              {filteredRecipes.map((recipe) => (
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
                        <span className={`w-2 h-2 rounded-full mr-1 ${
                          recipe.is_available_calculated ? 'bg-green-600' : 'bg-red-600'
                        }`}></span>
                        {recipe.is_available_calculated ? 'Stock OK' : 'Sin Stock'}
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
                        <dt className="font-medium text-gray-500">Envase</dt>
                        <dd className="text-base font-semibold text-gray-900">
                          {recipe.container_name ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                              {recipe.container_name}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Sin envase</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-500">Tiempo Prep.</dt>
                        <dd className="text-base font-semibold text-gray-900">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                            {recipe.preparation_time || 0} min
                          </span>
                        </dd>
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
                    <div className="flex gap-2 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => handleEdit(recipe)}
                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center flex items-center justify-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </button>

                      <button
                        onClick={() => handleRecalculatePrice(recipe)}
                        className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors text-center flex items-center justify-center gap-2"
                        disabled={loading}
                      >
                        <Calculator className="h-4 w-4" />
                        Recalcular
                      </button>

                      <button
                        onClick={() => handleDelete(recipe)}
                        className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors text-center flex items-center justify-center gap-2"
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

      <GenericExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
        title="Importar Recetas desde Excel"
        apiImportFunction={apiService.recipes.importExcel}
        templateConfig={EXCEL_IMPORT_CONFIGS.recipes.templateConfig}
        formatDescription={EXCEL_IMPORT_CONFIGS.recipes.formatDescription}
      />
    </div>
  );
};

export default Recipes;