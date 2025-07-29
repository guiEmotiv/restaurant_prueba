import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, User, Phone } from 'lucide-react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Waiters = () => {
  const { showSuccess, showError } = useToast();
  const [waiters, setWaiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWaiter, setSelectedWaiter] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    is_active: true
  });

  useEffect(() => {
    loadWaiters();
  }, []);

  const loadWaiters = async () => {
    try {
      setLoading(true);
      const data = await apiService.waiters.getAll();
      setWaiters(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading waiters:', error);
      showError('Error al cargar los meseros');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedWaiter(null);
    setFormData({ name: '', phone: '', is_active: true });
    setIsModalOpen(true);
  };

  const handleEdit = (waiter) => {
    setSelectedWaiter(waiter);
    setFormData({
      name: waiter.name,
      phone: waiter.phone || '',
      is_active: waiter.is_active
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (waiter) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este mesero?')) {
      try {
        await apiService.waiters.delete(waiter.id);
        await loadWaiters();
        showSuccess('Mesero eliminado exitosamente');
      } catch (error) {
        console.error('Error deleting waiter:', error);
        showError('Error al eliminar el mesero');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedWaiter) {
        await apiService.waiters.update(selectedWaiter.id, formData);
        showSuccess('Mesero actualizado exitosamente');
      } else {
        await apiService.waiters.create(formData);
        showSuccess('Mesero creado exitosamente');
      }
      setIsModalOpen(false);
      await loadWaiters();
    } catch (error) {
      console.error('Error saving waiter:', error);
      showError('Error al guardar el mesero');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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
          <h1 className="text-2xl font-bold text-gray-900">Meseros</h1>
          <p className="text-gray-600">Gestiona el personal de meseros</p>
        </div>
        <Button onClick={handleAdd} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Mesero
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
                  Teléfono
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
              {waiters.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    No hay meseros registrados
                  </td>
                </tr>
              ) : (
                waiters.map((waiter) => (
                  <tr key={waiter.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{waiter.name}</div>
                          <div className="text-sm text-gray-500">ID: {waiter.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        {waiter.phone ? (
                          <>
                            <Phone className="h-4 w-4 text-gray-400 mr-2" />
                            {waiter.phone}
                          </>
                        ) : (
                          <span className="text-gray-400 italic">Sin teléfono</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        waiter.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {waiter.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(waiter)}
                          className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Editar mesero"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(waiter)}
                          className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Eliminar mesero"
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
          {waiters.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <div className="text-4xl mb-2">👨‍💼</div>
              <p className="text-lg font-medium">No hay meseros registrados</p>
              <p className="text-sm">Los nuevos meseros aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {waiters.map((waiter) => (
                <div key={waiter.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{waiter.name}</h3>
                          <p className="text-sm text-gray-600">ID: {waiter.id}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        waiter.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {waiter.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    
                    {waiter.phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-4 w-4 text-gray-400 mr-2" />
                        {waiter.phone}
                      </div>
                    )}
                    
                    <div className="flex gap-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => handleEdit(waiter)}
                        className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center flex items-center justify-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(waiter)}
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
        title={selectedWaiter ? 'Editar Mesero' : 'Nuevo Mesero'}
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Opcional"
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
              Mesero activo
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
              {selectedWaiter ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Waiters;