import { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Button from '../../components/common/Button';
import GroupModal from '../../components/inventory/GroupModal';
import GenericExcelImportModal from '../../components/common/GenericExcelImportModal';
import { EXCEL_IMPORT_CONFIGS } from '../../utils/excelImportConfigs';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Groups = () => {
  const { showSuccess, showError } = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

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
      const sortedData = Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [];
      setGroups(sortedData);
    } catch (error) {
      showError('Error al cargar los grupos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (group = null) => {
    setSelectedGroup(group);
    setShowGroupModal(true);
  };

  const handleCloseModal = () => {
    setShowGroupModal(false);
    setSelectedGroup(null);
  };

  const handleModalSave = () => {
    loadGroups();
  };

  const handleAdd = () => {
    handleOpenModal();
  };

  const handleImportExcel = () => {
    setShowImportModal(true);
  };

  const handleImportSuccess = () => {
    loadGroups();
    setShowImportModal(false);
  };

  const handleEdit = (group) => {
    handleOpenModal(group);
  };

  const handleDelete = async (id) => {
    try {
      await apiService.groups.delete(id);
      await loadGroups();
      showSuccess('Grupo eliminado exitosamente');
    } catch (error) {
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
      <div className="flex items-center justify-end gap-3">
        <Button 
          variant="outline"
          onClick={handleImportExcel}
          className="flex items-center gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Importar Excel
        </Button>
        <Button 
          onClick={handleAdd}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nuevo Grupo
        </Button>
      </div>

      <CrudTable
        title="Grupos"
        data={groups}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        entityName="grupo"
        entityNamePlural="grupos"
        hideTitle={true}
        hideAddButton={true}
        useCustomModals={true}
      />

      <GroupModal
        isOpen={showGroupModal}
        onClose={handleCloseModal}
        group={selectedGroup}
        onSave={handleModalSave}
      />

      <GenericExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
        title="Importar Grupos desde Excel"
        apiImportFunction={apiService.groups.importExcel}
        templateConfig={EXCEL_IMPORT_CONFIGS.groups.templateConfig}
        formatDescription={EXCEL_IMPORT_CONFIGS.groups.formatDescription}
      />
    </div>
  );
};

export default Groups;