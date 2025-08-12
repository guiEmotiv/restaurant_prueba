import { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Button from '../../components/common/Button';
import ContainerModal from '../../components/config/ContainerModal';
import GenericExcelImportModal from '../../components/common/GenericExcelImportModal';
import { EXCEL_IMPORT_CONFIGS } from '../../utils/excelImportConfigs';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Containers = () => {
  const { showSuccess, showError } = useToast();
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState(null);

  const columns = [
    { key: 'id', title: 'ID' },
    { key: 'name', title: 'Nombre', required: true },
    { 
      key: 'price', 
      title: 'Precio', 
      required: true,
      render: (value) => `S/ ${parseFloat(value || 0).toFixed(2)}`
    },
    { key: 'stock', title: 'Stock', required: true },
    { 
      key: 'created_at', 
      title: 'Fecha de Creación',
      render: (value) => new Date(value).toLocaleDateString('es-PE')
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

  const handleOpenModal = (container = null) => {
    setSelectedContainer(container);
    setShowContainerModal(true);
  };

  const handleCloseModal = () => {
    setShowContainerModal(false);
    setSelectedContainer(null);
  };

  const handleModalSave = () => {
    loadContainers();
  };

  const handleAdd = () => {
    handleOpenModal();
  };

  const handleImportExcel = () => {
    setShowImportModal(true);
  };

  const handleImportSuccess = () => {
    loadContainers();
    setShowImportModal(false);
  };

  const handleEdit = (container) => {
    handleOpenModal(container);
  };

  const handleDelete = async (id) => {
    try {
      await apiService.containers.delete(id);
      await loadContainers();
      showSuccess('Envase eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting container:', error);
      if (error.response?.status === 400) {
        showError('No se puede eliminar este envase porque está siendo usado');
      } else {
        showError('Error al eliminar el envase');
      }
    }
  };

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
          Nuevo Envase
        </Button>
      </div>

      <CrudTable
        title="Envases"
        data={containers}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        hideTitle={true}
        hideAddButton={true}
        useCustomModals={true}
      />

      <ContainerModal
        isOpen={showContainerModal}
        onClose={handleCloseModal}
        container={selectedContainer}
        onSave={handleModalSave}
      />

      <GenericExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
        title="Importar Envases desde Excel"
        apiImportFunction={apiService.containers.importExcel}
        templateConfig={EXCEL_IMPORT_CONFIGS.containers.templateConfig}
        formatDescription={EXCEL_IMPORT_CONFIGS.containers.formatDescription}
      />
    </div>
  );
};

export default Containers;