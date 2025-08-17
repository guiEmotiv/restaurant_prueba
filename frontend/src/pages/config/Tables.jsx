import { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet } from 'lucide-react';
import CrudTable from '../../components/common/CrudTable';
import Button from '../../components/common/Button';
import TableModal from '../../components/config/TableModal';
import GenericExcelImportModal from '../../components/common/GenericExcelImportModal';
import { EXCEL_IMPORT_CONFIGS } from '../../utils/excelImportConfigs';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Tables = () => {
  const { showSuccess, showError } = useToast();
  const [tables, setTables] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);

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
      const sortedData = Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [];
      setTables(sortedData);
    } catch (error) {
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
    }
  };

  const handleOpenModal = (table = null) => {
    setSelectedTable(table);
    setShowTableModal(true);
  };

  const handleCloseModal = () => {
    setShowTableModal(false);
    setSelectedTable(null);
  };

  const handleModalSave = () => {
    loadTables();
  };

  const handleAdd = () => {
    handleOpenModal();
  };

  const handleImportExcel = () => {
    setShowImportModal(true);
  };

  const handleImportSuccess = () => {
    loadTables();
    setShowImportModal(false);
  };

  const handleEdit = (table) => {
    handleOpenModal(table);
  };

  const handleDelete = async (id) => {
    try {
      await apiService.tables.delete(id);
      await loadTables();
      showSuccess('Mesa eliminada exitosamente');
    } catch (error) {
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
          Nueva Mesa
        </Button>
      </div>

      <CrudTable
        title="Mesas"
        data={tables}
        columns={columnsWithZones}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        hideTitle={true}
        hideAddButton={true}
        useCustomModals={true}
      />

      <TableModal
        isOpen={showTableModal}
        onClose={handleCloseModal}
        table={selectedTable}
        onSave={handleModalSave}
      />

      <GenericExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
        title="Importar Mesas desde Excel"
        apiImportFunction={apiService.tables.importExcel}
        templateConfig={EXCEL_IMPORT_CONFIGS.tables.templateConfig}
        formatDescription={EXCEL_IMPORT_CONFIGS.tables.formatDescription}
      />
    </div>
  );
};

export default Tables;