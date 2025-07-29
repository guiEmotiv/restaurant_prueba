import { useState, useEffect } from 'react';
import { Package, DollarSign, Plus } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Containers = () => {
  const { showSuccess, showError } = useToast();
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: ''
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount || 0);
  };

  const columns = [
    { key: 'id', title: 'ID' },
    { 
      key: 'name', 
      title: 'Nombre',
      render: (value, item) => (
        <div className="flex items-center">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
            <Package className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{value}</div>
            <div className="text-sm text-gray-500">ID: {item.id}</div>
          </div>
        </div>
      )
    },
    { 
      key: 'price', 
      title: 'Precio',
      render: (value) => (
        <div className="flex items-center font-semibold text-gray-900">
          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
          {formatCurrency(value)}
        </div>
      )
    },
    { 
      key: 'stock', 
      title: 'Stock',
      render: (value) => (
        <span className={`font-semibold ${
          (value || 0) <= 5 ? 'text-red-600' : 'text-gray-900'
        }`}>
          {value || 0}
        </span>
      )
    }
  ];

  useEffect(() => {
    loadContainers();
  }, []);

  const loadContainers = async () => {
    try {
      setLoading(true);
      const data = await apiService.containers.getAll();
      const sortedData = Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [];
      setContainers(sortedData);
    } catch (error) {
      console.error('Error loading containers:', error);
      showError('Error al cargar los envases');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedContainer(null);
    setFormData({ name: '', price: '', stock: '' });
    setShowContainerModal(true);
  };

  const handleEdit = (container) => {
    setSelectedContainer(container);
    setFormData({
      name: container.name,
      price: container.price,
      stock: container.stock || ''
    });
    setShowContainerModal(true);
  };

  const handleCloseContainerModal = () => {
    setShowContainerModal(false);
    setSelectedContainer(null);
  };

  const handleModalSave = async () => {
    try {
      const submitData = {
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock) || 0
      };

      if (selectedContainer) {
        await apiService.containers.update(selectedContainer.id, submitData);
        showSuccess('Envase actualizado exitosamente');
      } else {
        await apiService.containers.create(submitData);
        showSuccess('Envase creado exitosamente');
      }
      setShowContainerModal(false);
      await loadContainers();
    } catch (error) {
      console.error('Error saving container:', error);
      showError('Error al guardar el envase');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este envase?')) {
      try {
        await apiService.containers.delete(id);
        await loadContainers();
        showSuccess('Envase eliminado exitosamente');
      } catch (error) {
        console.error('Error deleting container:', error);
        if (error.response?.status === 400) {
          showError('No se puede eliminar este envase porque está siendo usado en pedidos');
        } else {
          showError('Error al eliminar el envase');
        }
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
          <h1 className="text-2xl font-bold text-gray-900">Envases</h1>
          <p className="text-gray-600">Gestiona los envases para comida para llevar</p>
        </div>
        <Button onClick={handleAdd} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Envase
        </Button>
      </div>

      <CrudTable
        title="Envases"
        data={containers}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        hideAddButton={true}
        hideTitle={true}
        useCustomModals={true}
      />

      {/* Container Modal */}
      <Modal
        isOpen={showContainerModal}
        onClose={handleCloseContainerModal}
        title={selectedContainer ? 'Editar Envase' : 'Nuevo Envase'}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleModalSave(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              placeholder="Ej: Taper pequeño"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio *
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock *
            </label>
            <input
              type="number"
              name="stock"
              value={formData.stock}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              min="0"
              required
              placeholder="0"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseContainerModal}
            >
              Cancelar
            </Button>
            <Button type="submit">
              {selectedContainer ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Containers;