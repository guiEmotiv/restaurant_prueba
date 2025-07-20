import { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Zones = () => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showSuccess, showError } = useToast();
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
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      setLoading(true);
      const data = await apiService.zones.getAll();
      setZones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading zones:', error);
      showError('Error al cargar las zonas');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (formData) => {
    try {
      await apiService.zones.create(formData);
      await loadZones();
      showSuccess('Zona creada exitosamente');
    } catch (error) {
      console.error('Error creating zone:', error);
      showError('Error al crear la zona');
    }
  };

  const handleEdit = async (id, formData) => {
    try {
      await apiService.zones.update(id, formData);
      await loadZones();
      showSuccess('Zona actualizada exitosamente');
    } catch (error) {
      console.error('Error updating zone:', error);
      showError('Error al actualizar la zona');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.zones.delete(id);
      await loadZones();
      showSuccess('Zona eliminada exitosamente');
    } catch (error) {
      console.error('Error deleting zone:', error);
      if (error.response?.status === 400) {
        showError('No se puede eliminar esta zona porque tiene mesas asociadas');
      } else {
        showError('Error al eliminar la zona');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zonas</h1>
          <p className="text-gray-600">Gestiona las zonas del restaurante</p>
        </div>
        <Button 
          onClick={() => crudTableRef.current?.handleAdd()}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Agregar Zona
        </Button>
      </div>

      <CrudTable
        ref={crudTableRef}
        title="Zonas"
        data={zones}
        columns={columns}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        addButtonText="Agregar Zona"
        hideTitle={true}
        hideAddButton={true}
      />
    </div>
  );
};

export default Zones;