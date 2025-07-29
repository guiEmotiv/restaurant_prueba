import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, DollarSign } from 'lucide-react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Containers = () => {
  const { showSuccess, showError } = useToast();
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
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

  useEffect(() => {
    loadContainers();
  }, []);

  const loadContainers = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading containers...');
      const data = await apiService.containers.getAll();
      console.log('✅ Containers loaded:', data);
      setContainers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('❌ Error loading containers:', error);
      showError('Error al cargar los envases');
      setContainers([]); // Ensure it's always an array
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedContainer(null);
    setFormData({ name: '', price: '', stock: '' });
    setShowModal(true);
  };

  const handleEdit = (container) => {
    setSelectedContainer(container);
    setFormData({
      name: container.name,
      price: container.price,
      stock: container.stock || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      setShowModal(false);
      await loadContainers();
    } catch (error) {
      console.error('Error saving container:', error);
      showError('Error al guardar el envase');
    }
  };

  const handleDelete = async (container) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar ${container.name}?`)) {
      try {
        await apiService.containers.delete(container.id);
        await loadContainers();
        showSuccess('Envase eliminado exitosamente');
      } catch (error) {
        console.error('Error deleting container:', error);
        showError('Error al eliminar el envase');
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

      <div className="bg-white rounded-lg shadow">
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {containers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No hay envases registrados
                  </td>
                </tr>
              ) : (
                containers.map((container) => (
                  <tr key={container.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {container.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <Package className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="text-sm font-medium text-gray-900">{container.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm font-semibold text-gray-900">
                        <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                        {formatCurrency(container.price)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-semibold ${
                        (container.stock || 0) <= 5 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {container.stock || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(container)}
                          className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(container)}
                          className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50"
                          title="Eliminar"
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
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedContainer ? 'Editar Envase' : 'Nuevo Envase'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
              onClick={() => setShowModal(false)}
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