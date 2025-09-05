import { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Button from '../../components/common/Button';
import ZoneModal from '../../components/config/ZoneModal';
import GenericExcelImportModal from '../../components/common/GenericExcelImportModal';
import { EXCEL_IMPORT_CONFIGS } from '../../utils/excelImportConfigs';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Zones = () => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showSuccess, showError } = useToast();
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);

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
      const sortedData = Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [];
      setZones(sortedData);
    } catch (error) {
      showError('Error al cargar las zonas');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (zone = null) => {
    setSelectedZone(zone);
    setShowZoneModal(true);
  };

  const handleCloseModal = () => {
    setShowZoneModal(false);
    setSelectedZone(null);
  };

  const handleModalSave = () => {
    loadZones();
  };

  const handleAdd = () => {
    handleOpenModal();
  };

  const handleImportExcel = () => {
    setShowImportModal(true);
  };

  const handleImportSuccess = () => {
    loadZones();
    setShowImportModal(false);
  };

  const handleEdit = (zone) => {
    handleOpenModal(zone);
  };

  const handleDelete = async (id) => {
    try {
      await apiService.zones.delete(id);
      await loadZones();
      showSuccess('Zona eliminada exitosamente');
    } catch (error) {
      if (error.response?.status === 400) {
        showError('No se puede eliminar esta zona porque tiene mesas asociadas');
      } else {
        showError('Error al eliminar la zona');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Zones - Configuración de Zonas</h1>
        <p className="text-sm text-gray-600 mt-1">Gestiona las zonas del restaurante</p>
      </div>
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
          Nueva Zona
        </Button>
      </div>

      <CrudTable
        title="Zonas"
        data={zones}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        hideTitle={true}
        hideAddButton={true}
        useCustomModals={true}
      />

      <ZoneModal
        isOpen={showZoneModal}
        onClose={handleCloseModal}
        zone={selectedZone}
        onSave={handleModalSave}
      />

      <GenericExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
        title="Importar Zonas desde Excel"
        apiImportFunction={apiService.zones.importExcel}
        templateConfig={EXCEL_IMPORT_CONFIGS.zones.templateConfig}
        formatDescription={EXCEL_IMPORT_CONFIGS.zones.formatDescription}
      />
    </div>
  );
};

export default Zones;