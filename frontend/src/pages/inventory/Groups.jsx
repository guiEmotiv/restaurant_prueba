import { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Groups = () => {
  const { showSuccess, showError } = useToast();
  const [groups, setGroups] = useState([]);
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
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await apiService.groups.getAll();
      console.log('Groups data received:', data);
      setGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading groups:', error);
      showError('Error al cargar los grupos');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (formData) => {
    try {
      await apiService.groups.create(formData);
      await loadGroups();
      showSuccess('Grupo creado exitosamente');
    } catch (error) {
      console.error('Error creating group:', error);
      showError('Error al crear el grupo');
    }
  };

  const handleEdit = async (id, formData) => {
    try {
      await apiService.groups.update(id, formData);
      await loadGroups();
      showSuccess('Grupo actualizado exitosamente');
    } catch (error) {
      console.error('Error updating group:', error);
      showError('Error al actualizar el grupo');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.groups.delete(id);
      await loadGroups();
      showSuccess('Grupo eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting group:', error);
      if (error.response?.status === 400) {
        showError('No se puede eliminar un grupo que tiene recetas asociadas');
      } else {
        showError('Error al eliminar el grupo');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grupos de Recetas</h1>
          <p className="mt-2 text-gray-600">
            Gestiona los grupos para categorizar las recetas del menú
          </p>
        </div>
        <Button 
          onClick={() => crudTableRef.current?.handleAdd()}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Agregar Grupo
        </Button>
      </div>

      <CrudTable
        ref={crudTableRef}
        title="Grupos"
        data={groups}
        columns={columns}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        entityName="grupo"
        entityNamePlural="grupos"
        addButtonText="Agregar Grupo"
        hideTitle={true}
        hideAddButton={true}
      />
    </div>
  );
};

export default Groups;