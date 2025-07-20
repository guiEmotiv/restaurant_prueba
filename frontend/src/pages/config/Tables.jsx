import { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Tables = () => {
  const { showSuccess, showError } = useToast();
  const [tables, setTables] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const crudTableRef = useRef();

  const columns = [
    { key: 'id', title: 'ID' },
    { key: 'table_number', title: 'Número de Mesa', required: true },
    { 
      key: 'zone', 
      title: 'Zona', 
      type: 'select',
      required: true,
      options: zones.map(zone => ({ value: zone.id, label: zone.name })),
      render: (value, item) => item.zone_name || zones.find(z => z.id === value)?.name || value
    },
    { 
      key: 'created_at', 
      title: 'Fecha de Creación',
      render: (value) => new Date(value).toLocaleDateString('es-PE')
    }
  ];

  useEffect(() => {
    loadTables();
    loadZones();
  }, []);

  const loadTables = async () => {
    try {
      setLoading(true);
      const data = await apiService.tables.getAll();
      setTables(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading tables:', error);
      showError('Error al cargar las mesas');
    } finally {
      setLoading(false);
    }
  };

  const loadZones = async () => {
    try {
      const data = await apiService.zones.getAll();
      setZones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading zones:', error);
    }
  };

  const handleAdd = async (formData) => {
    try {
      await apiService.tables.create(formData);
      await loadTables();
      showSuccess('Mesa creada exitosamente');
    } catch (error) {
      console.error('Error creating table:', error);
      showError('Error al crear la mesa');
    }
  };

  const handleEdit = async (id, formData) => {
    try {
      await apiService.tables.update(id, formData);
      await loadTables();
      showSuccess('Mesa actualizada exitosamente');
    } catch (error) {
      console.error('Error updating table:', error);
      showError('Error al actualizar la mesa');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.tables.delete(id);
      await loadTables();
      showSuccess('Mesa eliminada exitosamente');
    } catch (error) {
      console.error('Error deleting table:', error);
      if (error.response?.status === 400) {
        showError('No se puede eliminar esta mesa porque tiene órdenes asociadas');
      } else {
        showError('Error al eliminar la mesa');
      }
    }
  };

  const columnsWithZones = columns.map(column => {
    if (column.key === 'zone') {
      return {
        ...column,
        options: zones.map(zone => ({ value: zone.id, label: zone.name }))
      };
    }
    return column;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mesas</h1>
          <p className="text-gray-600">Gestiona las mesas del restaurante</p>
        </div>
        <Button 
          onClick={() => crudTableRef.current?.handleAdd()}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Agregar Mesa
        </Button>
      </div>

      <CrudTable
        ref={crudTableRef}
        title="Mesas"
        data={tables}
        columns={columnsWithZones}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        addButtonText="Agregar Mesa"
        hideTitle={true}
        hideAddButton={true}
      />
    </div>
  );
};

export default Tables;