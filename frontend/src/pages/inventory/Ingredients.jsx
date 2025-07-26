import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import IngredientModal from '../../components/inventory/IngredientModal';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Ingredients = () => {
  const { showSuccess, showError } = useToast();
  const [ingredients, setIngredients] = useState([]);
  const [filteredIngredients, setFilteredIngredients] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
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
      title: 'Activo', 
      type: 'checkbox',
      render: (value, item) => {
        // Basado en stock: si stock > 0 = Sí, si stock = 0 = No
        return parseFloat(item.current_stock) > 0 ? 'Sí' : 'No';
      }
    }
  ];

  useEffect(() => {
    loadIngredients();
    loadUnits();
  }, []);

  useEffect(() => {
    // Filtrar ingredientes cuando cambian los filtros
    let filtered = ingredients;
    
    if (nameFilter) {
      filtered = filtered.filter(ingredient => 
        ingredient.name.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }
    
    if (activeFilter !== '') {
      const isActive = activeFilter === 'true';
      filtered = filtered.filter(ingredient => 
        isActive ? parseFloat(ingredient.current_stock) > 0 : parseFloat(ingredient.current_stock) === 0
      );
    }
    
    setFilteredIngredients(filtered);
  }, [ingredients, nameFilter, activeFilter]);

  const loadIngredients = async () => {
    try {
      setLoading(true);
      // Agregar parámetro para mostrar todos los ingredientes (incluyendo inactivos) en vista de administración
      const data = await apiService.ingredients.getAll({ show_all: true });
      // Ordenar por ID descendente
      const sortedData = Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [];
      setIngredients(sortedData);
    } catch (error) {
      console.error('Error loading ingredients:', error);
      showError('Error al cargar los ingredientes');
    } finally {
      setLoading(false);
    }
  };


  const loadUnits = async () => {
    try {
      const data = await apiService.units.getAll();
      setUnits(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading units:', error);
    }
  };

  const handleOpenIngredientModal = (ingredient = null) => {
    setSelectedIngredient(ingredient);
    setShowIngredientModal(true);
  };

  const handleCloseIngredientModal = () => {
    setShowIngredientModal(false);
    setSelectedIngredient(null);
  };

  const handleIngredientModalSave = () => {
    loadIngredients();
  };

  const handleAdd = () => {
    handleOpenIngredientModal();
  };

  const handleEdit = (ingredient) => {
    handleOpenIngredientModal(ingredient);
  };


  const handleDelete = async (id) => {
    try {
      await apiService.ingredients.delete(id);
      await loadIngredients();
      showSuccess('Ingrediente eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting ingredient:', error);
      if (error.response?.status === 400) {
        showError('No se puede eliminar este ingrediente porque está siendo usado en recetas');
      } else {
        showError('Error al eliminar el ingrediente');
      }
    }
  };


  const columnsWithOptions = columns.map(column => {
    if (column.key === 'unit') {
      return {
        ...column,
        options: units.map(unit => ({ value: unit.id, label: unit.name }))
      };
    }
    return column;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingredientes</h1>
          <p className="text-gray-600">Gestiona el inventario de ingredientes</p>
        </div>
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
              <option value="">Todos ({ingredients.length})</option>
              <option value="true">Activos ({ingredients.filter(i => parseFloat(i.current_stock) > 0).length})</option>
              <option value="false">Inactivos ({ingredients.filter(i => parseFloat(i.current_stock) === 0).length})</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setNameFilter('');
                setActiveFilter('');
              }}
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

    </div>
  );
};

export default Ingredients;