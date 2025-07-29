import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Button from '../../components/common/Button';
import WaiterModal from '../../components/config/WaiterModal';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Waiters = () => {
  const { showSuccess, showError } = useToast();
  const [waiters, setWaiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [selectedWaiter, setSelectedWaiter] = useState(null);

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

  const handleOpenModal = (waiter = null) => {
    setSelectedWaiter(waiter);
    setShowWaiterModal(true);
  };

  const handleCloseModal = () => {
    setShowWaiterModal(false);
    setSelectedWaiter(null);
  };

  const handleModalSave = () => {
    loadWaiters();
  };

  const handleAdd = () => {
    handleOpenModal();
  };

  const handleEdit = (waiter) => {
    handleOpenModal(waiter);
  };

  const handleDelete = async (id) => {
    try {
      await apiService.waiters.delete(id);
      await loadWaiters();
      showSuccess('Mesero eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting waiter:', error);
      if (error.response?.status === 400) {
        showError('No se puede eliminar este mesero porque tiene órdenes asociadas');
      } else {
        showError('Error al eliminar el mesero');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meseros</h1>
          <p className="text-gray-600">Gestiona los meseros del restaurante</p>
        </div>
        <Button 
          onClick={handleAdd}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nuevo Mesero
        </Button>
      </div>

      <CrudTable
        title="Meseros"
        data={waiters}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        hideTitle={true}
        hideAddButton={true}
        useCustomModals={true}
      />

      <WaiterModal
        isOpen={showWaiterModal}
        onClose={handleCloseModal}
        waiter={selectedWaiter}
        onSave={handleModalSave}
      />
    </div>
  );
};

export default Waiters;