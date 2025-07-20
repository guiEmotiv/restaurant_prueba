import { useState, useEffect } from 'react';
import { Package, Plus } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import StockUpdateModal from '../../components/inventory/StockUpdateModal';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Ingredients = () => {
  const { showSuccess, showError } = useToast();
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);

  const columns = [
    { key: 'id', title: 'ID' },
    { key: 'name', title: 'Nombre', required: true },
    { 
      key: 'category', 
      title: 'Categoría', 
      type: 'select',
      required: true,
      options: categories.map(cat => ({ value: cat.id, label: cat.name })),
      render: (value, item) => item.category_name || categories.find(c => c.id === value)?.name || value
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
      key: 'unit_price', 
      title: 'Precio Unitario', 
      type: 'number',
      step: '0.01',
      min: '0.01',
      required: true,
      render: (value) => `S/ ${parseFloat(value).toFixed(2)}`
    },
    { 
      key: 'current_stock', 
      title: 'Stock Actual', 
      type: 'number',
      step: '0.01',
      min: '0',
      required: true,
      render: (value, item) => (
        <div className="flex items-center justify-between">
          <span className={`${parseFloat(value) <= 5 ? 'text-red-600 font-semibold' : ''}`}>
            {parseFloat(value).toFixed(2)} {item.unit_name || ''}
          </span>
          <Button
            onClick={() => handleStockUpdate(item)}
            size="sm"
            variant="secondary"
            className="ml-2 flex items-center gap-1"
          >
            <Package className="h-3 w-3" />
            Stock
          </Button>
        </div>
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
    loadCategories();
    loadUnits();
  }, []);

  const loadIngredients = async () => {
    try {
      setLoading(true);
      const data = await apiService.ingredients.getAll();
      setIngredients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading ingredients:', error);
      showError('Error al cargar los ingredientes');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await apiService.categories.getAll();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading categories:', error);
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

  const handleAdd = () => {
    setEditingIngredient(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (ingredient) => {
    setEditingIngredient(ingredient);
    setIsModalOpen(true);
  };

  const handleEditFromTable = async (id, formData) => {
    try {
      await apiService.ingredients.update(id, formData);
      await loadIngredients();
      showSuccess('Ingrediente actualizado exitosamente');
    } catch (error) {
      console.error('Error updating ingredient:', error);
      showError('Error al actualizar el ingrediente');
    }
  };

  const handleModalSubmit = async (formData) => {
    try {
      if (editingIngredient) {
        await apiService.ingredients.update(editingIngredient.id, formData);
        showSuccess('Ingrediente actualizado exitosamente');
      } else {
        await apiService.ingredients.create(formData);
        showSuccess('Ingrediente creado exitosamente');
      }
      await loadIngredients();
      setIsModalOpen(false);
      setEditingIngredient(null);
    } catch (error) {
      console.error('Error saving ingredient:', error);
      showError('Error al guardar el ingrediente');
    }
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

  const handleStockUpdate = (ingredient) => {
    setSelectedIngredient(ingredient);
    setShowStockModal(true);
  };

  const handleStockUpdated = () => {
    loadIngredients();
    setShowStockModal(false);
    setSelectedIngredient(null);
  };

  const columnsWithOptions = columns.map(column => {
    if (column.key === 'category') {
      return {
        ...column,
        options: categories.map(cat => ({ value: cat.id, label: cat.name }))
      };
    }
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
        <Button onClick={handleAdd} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Agregar Ingrediente
        </Button>
      </div>

      <CrudTable
        title="Ingredientes"
        data={ingredients}
        columns={columnsWithOptions}
        onAdd={handleModalSubmit}
        onEdit={handleEditFromTable}
        onDelete={handleDelete}
        loading={loading}
        hideAddButton={true}
        hideTitle={true}
      />

      {/* Stock Update Modal */}
      <StockUpdateModal
        isOpen={showStockModal}
        onClose={() => setShowStockModal(false)}
        ingredient={selectedIngredient}
        onSuccess={handleStockUpdated}
      />
    </div>
  );
};

export default Ingredients;