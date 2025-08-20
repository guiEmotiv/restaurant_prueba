import { useState, useEffect, useCallback } from 'react';
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
    { 
      key: 'stock', 
      title: 'Stock', 
      required: true,
      render: (value) => (
        <span className={`${parseInt(value) <= 5 ? 'text-red-600 font-semibold' : parseInt(value) <= 10 ? 'text-yellow-600 font-medium' : 'text-green-600'}`}>
          {value}
        </span>
      )
    },
    {
      key: 'is_active',
      title: 'Estado',
      render: (value, item) => {
        const hasStock = parseInt(item.stock) > 0;
        const isActive = value && hasStock;
        return isActive ? 
          <span className="text-green-600 font-medium">Disponible</span> : 
          hasStock ? 
            <span className="text-yellow-600 font-medium">Inactivo</span> :
            <span className="text-red-600 font-medium">Sin Stock</span>;
      }
    },
    { 
      key: 'created_at', 
      title: 'Fecha de Creación',
      render: (value) => new Date(value).toLocaleDateString('es-PE')
    },
    { 
      key: 'updated_at', 
      title: 'Última Actualización',
      render: (value) => new Date(value).toLocaleDateString('es-PE')
    }
  ];

  // 🚀 OPTIMIZACIÓN: loadContainers con useCallback y cache-busting optimizado
  const loadContainers = useCallback(async () => {
    try {
      setLoading(true);
      // Timestamp simple sin Math.random innecesario
      const data = await apiService.containers.getAll({ _t: Date.now() });
      const sortedData = Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [];
      setContainers(sortedData);
    } catch (error) {
      showError('Error al cargar los envases');
      console.error('Error cargando containers:', error);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadContainers();
  }, [loadContainers]);

  // 🚀 OPTIMIZACIÓN: Auto-refresh simplificado y eficiente
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadContainers();
      }
    };

    // Solo listener de visibilidad - más eficiente
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 🚀 OPTIMIZACIÓN: Intervalo más largo (60s) para reducir carga
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadContainers();
      }
    }, 60000); // 60 segundos en lugar de 30

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [loadContainers]);

  // 🚀 OPTIMIZACIÓN: Handlers con useCallback para evitar re-renders
  const handleOpenModal = useCallback((container = null) => {
    setSelectedContainer(container);
    setShowContainerModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowContainerModal(false);
    setSelectedContainer(null);
  }, []);

  const handleModalSave = useCallback(() => {
    loadContainers();
  }, [loadContainers]);

  const handleAdd = useCallback(() => {
    handleOpenModal();
  }, [handleOpenModal]);

  const handleImportExcel = useCallback(() => {
    setShowImportModal(true);
  }, []);

  const handleImportSuccess = useCallback(() => {
    loadContainers();
    setShowImportModal(false);
  }, [loadContainers]);

  const handleEdit = useCallback((container) => {
    handleOpenModal(container);
  }, [handleOpenModal]);

  const handleDelete = useCallback(async (id) => {
    try {
      await apiService.containers.delete(id);
      await loadContainers();
      showSuccess('Envase eliminado exitosamente');
    } catch (error) {
      if (error.response?.status === 400) {
        showError('No se puede eliminar este envase porque está siendo usado');
      } else {
        showError('Error al eliminar el envase');
      }
    }
  }, [loadContainers, showSuccess, showError]);

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