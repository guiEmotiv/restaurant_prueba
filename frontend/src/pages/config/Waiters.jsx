import { useState, useEffect } from 'react';
import { Users, Plus } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Waiters = () => {
  const { showSuccess, showError } = useToast();
  const [waiters, setWaiters] = useState([]);
  const [filteredWaiters, setFilteredWaiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [selectedWaiter, setSelectedWaiter] = useState(null);
  const [formData, setFormData] = useState({
    name: ''
  });

  const columns = [
    { key: 'id', title: 'ID' },
    { 
      key: 'name', 
      title: 'Nombre',
      render: (value, item) => (
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{value}</div>
            <div className="text-sm text-gray-500">ID: {item.id}</div>
          </div>
        </div>
      )
    }
  ];

  useEffect(() => {
    loadWaiters();
  }, []);

  useEffect(() => {
    // Actualizar waiters filtrados cuando cambian los waiters
    setFilteredWaiters(Array.isArray(waiters) ? waiters : []);
  }, [waiters]);

  const loadWaiters = async () => {
    try {
      setLoading(true);
      const data = await apiService.waiters.getAll();
      const sortedData = Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [];
      setWaiters(sortedData);
    } catch (error) {
      console.error('Error loading waiters:', error);
      showError('Error al cargar los meseros');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedWaiter(null);
    setFormData({ name: '' });
    setShowWaiterModal(true);
  };

  const handleEdit = (waiter) => {
    setSelectedWaiter(waiter);
    setFormData({ name: waiter.name });
    setShowWaiterModal(true);
  };

  const handleCloseWaiterModal = () => {
    setShowWaiterModal(false);
    setSelectedWaiter(null);
  };

  const handleModalSave = async () => {
    try {
      if (selectedWaiter) {
        await apiService.waiters.update(selectedWaiter.id, formData);
        showSuccess('Mesero actualizado exitosamente');
      } else {
        await apiService.waiters.create(formData);
        showSuccess('Mesero creado exitosamente');
      }
      setShowWaiterModal(false);
      await loadWaiters();
    } catch (error) {
      console.error('Error saving waiter:', error);
      showError('Error al guardar el mesero');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este mesero?')) {
      try {
        await apiService.waiters.delete(id);
        await loadWaiters();
        showSuccess('Mesero eliminado exitosamente');
      } catch (error) {
        console.error('Error deleting waiter:', error);
        if (error.response?.status === 400) {
          showError('No se puede eliminar este mesero porque está siendo usado en pedidos');
        } else {
          showError('Error al eliminar el mesero');
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
          <h1 className="text-2xl font-bold text-gray-900">Meseros</h1>
          <p className="text-gray-600">Gestiona el personal de meseros</p>
        </div>
        <Button onClick={handleAdd} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Mesero
        </Button>
      </div>

      <CrudTable
        title="Meseros"
        data={filteredWaiters}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        hideAddButton={true}
        hideTitle={true}
        useCustomModals={true}
      />

      {/* Waiter Modal */}
      <Modal
        isOpen={showWaiterModal}
        onClose={handleCloseWaiterModal}
        title={selectedWaiter ? 'Editar Mesero' : 'Nuevo Mesero'}
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
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseWaiterModal}
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