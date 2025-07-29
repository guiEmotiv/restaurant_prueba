import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Waiters = () => {
  const { showSuccess, showError } = useToast();
  const [waiters, setWaiters] = useState([]);
  const [loading, setLoading] = useState(true);

  const columns = [
    { key: 'id', title: 'ID' },
    { 
      key: 'name', 
      title: 'Nombre', 
      required: true,
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
    },
    { 
      key: 'phone', 
      title: 'Teléfono',
      render: (value) => value || 'Sin teléfono'
    },
    { 
      key: 'is_active', 
      title: 'Estado', 
      type: 'checkbox',
      render: (value) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value ? 'Activo' : 'Inactivo'}
        </span>
      )
    }
  ];

  useEffect(() => {
    loadWaiters();
  }, []);

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

  const handleSave = async (formData, isEdit) => {
    try {
      if (isEdit) {
        await apiService.waiters.update(formData.id, formData);
        showSuccess('Mesero actualizado exitosamente');
      } else {
        await apiService.waiters.create(formData);
        showSuccess('Mesero creado exitosamente');
      }
      await loadWaiters();
    } catch (error) {
      console.error('Error saving waiter:', error);
      showError('Error al guardar el mesero');
    }
  };

  const handleDelete = async (id) => {
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meseros</h1>
        <p className="text-gray-600">Gestiona el personal de meseros</p>
      </div>

      <CrudTable
        data={waiters}
        columns={columns}
        onSave={handleSave}
        onDelete={handleDelete}
        title="Mesero"
        addButtonText="Nuevo Mesero"
      />
    </div>
  );
};

export default Waiters;