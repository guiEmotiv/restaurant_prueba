import { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Categories = () => {
  const { showSuccess, showError } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const crudTableRef = useRef();

  const columns = [
    { key: 'id', title: 'ID' },
    { key: 'name', title: 'Nombre', required: true },
    { 
      key: 'created_at', 
      title: 'Fecha de Creación',
      render: (value) => new Date(value).toLocaleDateString('es-PE')
    }
  ];

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await apiService.categories.getAll();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading categories:', error);
      showError('Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  };


  const handleAdd = async (formData) => {
    try {
      await apiService.categories.create(formData);
      await loadCategories();
      showSuccess('Categoría creada exitosamente');
    } catch (error) {
      console.error('Error creating category:', error);
      showError('Error al crear la categoría');
    }
  };

  const handleEdit = async (id, formData) => {
    try {
      await apiService.categories.update(id, formData);
      await loadCategories();
      showSuccess('Categoría actualizada exitosamente');
    } catch (error) {
      console.error('Error updating category:', error);
      showError('Error al actualizar la categoría');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.categories.delete(id);
      await loadCategories();
      showSuccess('Categoría eliminada exitosamente');
    } catch (error) {
      console.error('Error deleting category:', error);
      if (error.response?.status === 400) {
        showError('No se puede eliminar esta categoría porque tiene ingredientes asociados');
      } else {
        showError('Error al eliminar la categoría');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-600">Gestiona las categorías de ingredientes</p>
        </div>
        <Button 
          onClick={() => crudTableRef.current?.handleAdd()}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Agregar Categoría
        </Button>
      </div>

      <CrudTable
        ref={crudTableRef}
        title="Categorías"
        data={categories}
        columns={columns}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        addButtonText="Agregar Categoría"
        hideTitle={true}
        hideAddButton={true}
      />
    </div>
  );
};

export default Categories;