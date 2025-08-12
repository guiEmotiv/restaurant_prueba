import { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Button from '../../components/common/Button';
import UnitModal from '../../components/config/UnitModal';
import GenericExcelImportModal from '../../components/common/GenericExcelImportModal';
import { EXCEL_IMPORT_CONFIGS } from '../../utils/excelImportConfigs';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Units = () => {
  const { showSuccess, showError } = useToast();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);

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
      const sortedData = Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [];
      setUnits(sortedData);
    } catch (error) {
      console.error('Error loading units:', error);
      showError('Error al cargar las unidades');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (unit = null) => {
    setSelectedUnit(unit);
    setShowUnitModal(true);
  };

  const handleCloseModal = () => {
    setShowUnitModal(false);
    setSelectedUnit(null);
  };

  const handleModalSave = () => {
    loadUnits();
  };

  const handleAdd = () => {
    handleOpenModal();
  };

  const handleImportExcel = () => {
    setShowImportModal(true);
  };

  const handleImportSuccess = () => {
    loadUnits();
    setShowImportModal(false);
  };

  const handleEdit = (unit) => {
    handleOpenModal(unit);
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
          Nueva Unidad
        </Button>
      </div>

      <CrudTable
        title="Unidades"
        data={units}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        hideTitle={true}
        hideAddButton={true}
        useCustomModals={true}
      />

      <UnitModal
        isOpen={showUnitModal}
        onClose={handleCloseModal}
        unit={selectedUnit}
        onSave={handleModalSave}
      />

      <GenericExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
        title="Importar Unidades desde Excel"
        apiImportFunction={apiService.units.importExcel}
        templateConfig={EXCEL_IMPORT_CONFIGS.units.templateConfig}
        formatDescription={EXCEL_IMPORT_CONFIGS.units.formatDescription}
      />
    </div>
  );
};

export default Units;