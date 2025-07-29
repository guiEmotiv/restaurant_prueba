import { useState, useEffect } from 'react';
import { Package, DollarSign } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Containers = () => {
  const { showSuccess, showError } = useToast();
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);

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
      required: true,
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
      key: 'description', 
      title: 'Descripción',
      render: (value) => value || 'Sin descripción'
    },
    { 
      key: 'price', 
      title: 'Precio', 
      type: 'number',
      step: '0.01',
      min: '0.01',
      required: true,
      render: (value) => (
        <div className="flex items-center font-semibold text-gray-900">
          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
          {formatCurrency(value)}
        </div>
      )
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

  const handleSave = async (formData, isEdit) => {
    try {
      const submitData = {
        ...formData,
        price: parseFloat(formData.price)
      };

      if (isEdit) {
        await apiService.containers.update(formData.id, submitData);
        showSuccess('Envase actualizado exitosamente');
      } else {
        await apiService.containers.create(submitData);
        showSuccess('Envase creado exitosamente');
      }
      await loadContainers();
    } catch (error) {
      console.error('Error saving container:', error);
      showError('Error al guardar el envase');
    }
  };

  const handleDelete = async (id) => {
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
        <h1 className="text-2xl font-bold text-gray-900">Envases</h1>
        <p className="text-gray-600">Gestiona los envases para comida para llevar</p>
      </div>

      <CrudTable
        data={containers}
        columns={columns}
        onSave={handleSave}
        onDelete={handleDelete}
        title="Envase"
        addButtonText="Nuevo Envase"
      />
    </div>
  );
};

export default Containers;