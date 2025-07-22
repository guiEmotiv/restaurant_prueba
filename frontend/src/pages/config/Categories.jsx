import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Button from '../../components/common/Button';
import CategoryModal from '../../components/config/CategoryModal';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Categories = () => {
  const { showSuccess, showError } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

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


  const handleOpenModal = (category = null) => {
    setSelectedCategory(category);
    setShowCategoryModal(true);
  };

  const handleCloseModal = () => {
    setShowCategoryModal(false);
    setSelectedCategory(null);
  };

  const handleModalSave = () => {
    loadCategories();
  };

  const handleAdd = () => {
    handleOpenModal();
  };

  const handleEdit = (category) => {
    handleOpenModal(category);
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
          onClick={handleAdd}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nueva Categoría
        </Button>
      </div>

      <CrudTable
        title="Categorías"
        data={categories}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        hideTitle={true}
        hideAddButton={true}
      />

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={handleCloseModal}
        category={selectedCategory}
        onSave={handleModalSave}
      />
    </div>
  );
};

export default Categories;