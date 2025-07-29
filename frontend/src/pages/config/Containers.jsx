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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    is_active: true
  });

  useEffect(() => {
    loadContainers();
  }, []);

  const loadContainers = async () => {
    try {
      setLoading(true);
      const data = await apiService.containers.getAll();
      setContainers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading containers:', error);
      showError('Error al cargar los envases');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedContainer(null);
    setFormData({ name: '', description: '', price: '', is_active: true });
    setIsModalOpen(true);
  };

  const handleEdit = (container) => {
    setSelectedContainer(container);
    setFormData({
      name: container.name,
      description: container.description || '',
      price: container.price,
      is_active: container.is_active
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (container) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este envase?')) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        price: parseFloat(formData.price)
      };

      if (selectedContainer) {
        await apiService.containers.update(selectedContainer.id, submitData);
        showSuccess('Envase actualizado exitosamente');
      } else {
        await apiService.containers.create(submitData);
        showSuccess('Envase creado exitosamente');
      }
      setIsModalOpen(false);
      await loadContainers();
    } catch (error) {
      console.error('Error saving container:', error);
      showError('Error al guardar el envase');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount || 0);
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
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <Package className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{container.name}</div>
                          <div className="text-sm text-gray-500">ID: {container.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {container.description || 'Sin descripción'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center text-sm font-semibold text-gray-900">
                        <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                        {formatCurrency(container.price)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        container.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {container.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(container)}
                          className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Editar envase"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(container)}
                          className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Eliminar envase"
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
          {containers.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <div className="text-4xl mb-2">📦</div>
              <p className="text-lg font-medium">No hay envases registrados</p>
              <p className="text-sm">Los nuevos envases aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {containers.map((container) => (
                <div key={container.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <Package className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{container.name}</h3>
                          <p className="text-sm text-gray-600">ID: {container.id}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        container.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {container.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    
                    {container.description && (
                      <div className="text-sm text-gray-600">
                        {container.description}
                      </div>
                    )}
                    
                    <div className="flex items-center text-lg font-semibold text-gray-900">
                      <DollarSign className="h-5 w-5 text-gray-400 mr-1" />
                      {formatCurrency(container.price)}
                    </div>
                    
                    <div className="flex gap-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => handleEdit(container)}
                        className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center flex items-center justify-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(container)}
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

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
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
              Descripción
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              placeholder="Descripción opcional del envase"
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

          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleInputChange}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label className="ml-2 text-sm text-gray-700">
              Envase activo
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
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