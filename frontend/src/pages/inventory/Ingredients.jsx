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
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);

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
      render: (value) => value ? 'Sí' : 'No'
    }
  ];

  useEffect(() => {
    loadIngredients();
    loadUnits();
  }, []);

  const loadIngredients = async () => {
    try {
      setLoading(true);
      // Agregar parámetro para mostrar todos los ingredientes (incluyendo inactivos) en vista de administración
      const data = await apiService.ingredients.getAll({ show_all: true });
      // Ordenar por ID para mantener consistencia con backend
      const sortedData = Array.isArray(data) ? data.sort((a, b) => a.id - b.id) : [];
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

      <CrudTable
        title="Ingredientes"
        data={ingredients}
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