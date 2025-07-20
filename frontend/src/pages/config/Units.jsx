import { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Units = () => {
  const { showSuccess, showError } = useToast();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
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
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const data = await apiService.units.getAll();
      setUnits(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading units:', error);
      showError('Error al cargar las unidades');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (formData) => {
    try {
      await apiService.units.create(formData);
      await loadUnits();
      showSuccess('Unidad creada exitosamente');
    } catch (error) {
      console.error('Error creating unit:', error);
      showError('Error al crear la unidad');
    }
  };

  const handleEdit = async (id, formData) => {
    try {
      await apiService.units.update(id, formData);
      await loadUnits();
      showSuccess('Unidad actualizada exitosamente');
    } catch (error) {
      console.error('Error updating unit:', error);
      showError('Error al actualizar la unidad');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.units.delete(id);
      await loadUnits();
      showSuccess('Unidad eliminada exitosamente');
    } catch (error) {
      console.error('Error deleting unit:', error);
      if (error.response?.status === 400) {
        showError('No se puede eliminar esta unidad porque tiene ingredientes asociados');
      } else {
        showError('Error al eliminar la unidad');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unidades</h1>
          <p className="text-gray-600">Gestiona las unidades de medida</p>
        </div>
        <Button 
          onClick={() => crudTableRef.current?.handleAdd()}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Agregar Unidad
        </Button>
      </div>

      <CrudTable
        ref={crudTableRef}
        title="Unidades"
        data={units}
        columns={columns}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        addButtonText="Agregar Unidad"
        hideTitle={true}
        hideAddButton={true}
      />
    </div>
  );
};

export default Units;