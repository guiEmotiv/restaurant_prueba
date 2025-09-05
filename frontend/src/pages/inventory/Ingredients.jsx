import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, FileSpreadsheet } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import IngredientModal from '../../components/inventory/IngredientModal';
import GenericExcelImportModal from '../../components/common/GenericExcelImportModal';
import { EXCEL_IMPORT_CONFIGS } from '../../utils/excelImportConfigs';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Ingredients = () => {
  const { showSuccess, showError } = useToast();
  const [ingredients, setIngredients] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [nameFilter, setNameFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const columns = [
    { key: 'id', title: 'ID' },
    { key: 'name', title: 'Nombre', required: true },
    { 
      key: 'unit_price', 
      title: 'Precio Unitario', 
      type: 'number',
      step: '0.01',
      min: '0.01',
      required: true,
      render: (value) => `S/ ${parseFloat(value).toFixed(2)}`
    },
    { 
      key: 'unit', 
      title: 'Unidad', 
      type: 'select',
      required: true,
      options: units.map(unit => ({ value: unit.id, label: unit.name })),
      render: (value, item) => item.unit_name || units.find(u => u.id === value)?.name || value
    },
    { 
      key: 'current_stock', 
      title: 'Stock Actual', 
      type: 'number',
      step: '0.01',
      min: '0',
      required: true,
      render: (value, item) => (
        <span className={`${parseFloat(value) <= 5 ? 'text-red-600 font-semibold' : ''}`}>
          {parseFloat(value).toFixed(2)}
        </span>
      )
    },
    { 
      key: 'is_active', 
      title: 'Estado', 
      type: 'checkbox',
      render: (value, item) => {
        // Estado automático basado en stock
        const hasStock = parseFloat(item.current_stock) > 0;
        return hasStock ? 
          <span className="text-green-600 font-medium">Activo</span> : 
          <span className="text-red-600 font-medium">Sin Stock</span>;
      }
    }
  ];

  // Carga optimizada de ingredientes usando apiService
  const loadIngredients = useCallback(async () => {
    try {
      setLoading(true);
      
      // Usar apiService para manejar autenticación correctamente
      const data = await apiService.ingredients.getAll();
      
      // Ordenar por ID descendente
      const sortedData = Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [];
      setIngredients(sortedData);
    } catch (error) {
      console.error('Error loading ingredients:', error);
      showError('Error al cargar los ingredientes');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadUnits = useCallback(async () => {
    try {
      const data = await apiService.units.getAll();
      setUnits(Array.isArray(data) ? data : []);
    } catch (error) {
      // Error silencioso para units
    }
  }, []);

  useEffect(() => {
    loadIngredients();
    loadUnits();
  }, [loadIngredients, loadUnits]);

  // Filtrado optimizado
  const filteredIngredients = useMemo(() => {
    if (!nameFilter && activeFilter === '') {
      return ingredients; // Retorno temprano si no hay filtros
    }
    
    return ingredients.filter(ingredient => {
      // Filtro por nombre
      if (nameFilter && !ingredient.name.toLowerCase().includes(nameFilter.toLowerCase())) {
        return false;
      }
      
      // Filtro por estado
      if (activeFilter !== '') {
        const isActive = activeFilter === 'true';
        const hasStock = parseFloat(ingredient.current_stock) > 0;
        if (isActive !== hasStock) {
          return false;
        }
      }
      
      return true;
    });
  }, [ingredients, nameFilter, activeFilter]);

  // Contadores optimizados - una sola iteración
  const stockStats = useMemo(() => {
    const stats = { total: ingredients.length, withStock: 0, withoutStock: 0 };
    
    ingredients.forEach(ingredient => {
      if (parseFloat(ingredient.current_stock) > 0) {
        stats.withStock++;
      } else {
        stats.withoutStock++;
      }
    });
    
    return stats;
  }, [ingredients]);

  // Columnas con opciones memoizadas
  const columnsWithOptions = useMemo(() => 
    columns.map(column => 
      column.key === 'unit' 
        ? { ...column, options: units.map(unit => ({ value: unit.id, label: unit.name })) }
        : column
    ), [units]);

  // 🚀 OPTIMIZACIÓN: Handlers con useCallback para evitar re-renders
  const handleOpenIngredientModal = useCallback((ingredient = null) => {
    setSelectedIngredient(ingredient);
    setShowIngredientModal(true);
  }, []);

  const handleCloseIngredientModal = useCallback(() => {
    setShowIngredientModal(false);
    setSelectedIngredient(null);
  }, []);

  const handleIngredientModalSave = useCallback(() => {
    loadIngredients();
  }, [loadIngredients]);

  const handleImportExcel = useCallback(() => {
    setShowImportModal(true);
  }, []);

  const handleImportSuccess = useCallback(() => {
    loadIngredients();
    setShowImportModal(false);
  }, [loadIngredients]);

  const handleAdd = useCallback(() => {
    handleOpenIngredientModal();
  }, [handleOpenIngredientModal]);

  const handleEdit = useCallback((ingredient) => {
    handleOpenIngredientModal(ingredient);
  }, [handleOpenIngredientModal]);

  const handleDelete = useCallback(async (id) => {
    try {
      await apiService.ingredients.delete(id);
      await loadIngredients();
      showSuccess('Ingrediente eliminado exitosamente');
    } catch (error) {
      if (error.response?.status === 400) {
        showError('No se puede eliminar este ingrediente porque está siendo usado en recetas');
      } else {
        showError('Error al eliminar el ingrediente');
      }
    }
  }, [loadIngredients, showSuccess, showError]);

  // Limpiar filtros
  const clearFilters = useCallback(() => {
    setNameFilter('');
    setActiveFilter('');
  }, []);


  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ingredients - Gestión de Ingredientes</h1>
        <p className="text-sm text-gray-600 mt-1">Administra los ingredientes y sus costos</p>
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
        <Button 
          onClick={handleAdd} 
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nuevo Ingrediente
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por nombre
            </label>
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Buscar ingrediente..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por estado
            </label>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos ({stockStats.total})</option>
              <option value="true">Con Stock ({stockStats.withStock})</option>
              <option value="false">Sin Stock ({stockStats.withoutStock})</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      <CrudTable
        title="Ingredientes"
        data={filteredIngredients}
        columns={columnsWithOptions}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        hideAddButton={true}
        hideTitle={true}
        useCustomModals={true}
      />

      {/* Ingredient Modal */}
      <IngredientModal
        isOpen={showIngredientModal}
        onClose={handleCloseIngredientModal}
        ingredient={selectedIngredient}
        onSave={handleIngredientModalSave}
      />

      {/* Excel Import Modal */}
      <GenericExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
        title="Importar Ingredientes desde Excel"
        apiImportFunction={apiService.ingredients.importExcel}
        templateConfig={EXCEL_IMPORT_CONFIGS.ingredients.templateConfig}
        formatDescription={EXCEL_IMPORT_CONFIGS.ingredients.formatDescription}
      />

    </div>
  );
};

export default Ingredients;