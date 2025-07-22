import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import Button from '../common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const TableModal = ({ isOpen, onClose, table = null, onSave }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    table_number: '',
    zone: ''
  });
  const [availableZones, setAvailableZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadAvailableData();
      if (table) {
        // Modo edición
        setFormData({
          table_number: table.table_number || '',
          zone: table.zone?.id || table.zone || ''
        });
      } else {
        // Modo creación
        resetForm();
      }
    }
  }, [isOpen, table]);

  const resetForm = () => {
    setFormData({
      table_number: '',
      zone: ''
    });
    setErrors({});
  };

  const loadAvailableData = async () => {
    try {
      const zonesData = await apiService.zones.getAll();
      setAvailableZones(Array.isArray(zonesData) ? zonesData : []);
    } catch (error) {
      console.error('Error loading available data:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.table_number || formData.table_number.trim() === '') {
      newErrors.table_number = 'El número de mesa es requerido';
    }

    if (!formData.zone || formData.zone === '') {
      newErrors.zone = 'La zona es requerida';
    } else {
      const zoneId = parseInt(formData.zone);
      if (isNaN(zoneId) || zoneId <= 0) {
        newErrors.zone = 'Debe seleccionar una zona válida';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    try {
      const tableData = {
        table_number: formData.table_number.trim(),
        zone: parseInt(formData.zone)
      };
      
      if (table?.id) {
        await apiService.tables.update(table.id, tableData);
        showSuccess('Mesa actualizada exitosamente');
      } else {
        await apiService.tables.create(tableData);
        showSuccess('Mesa creada exitosamente');
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving table:', error);
      let errorMessage = 'Error desconocido';
      
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else {
          const errors = [];
          for (const [field, fieldErrors] of Object.entries(error.response.data)) {
            if (Array.isArray(fieldErrors)) {
              errors.push(`${field}: ${fieldErrors.join(', ')}`);
            } else {
              errors.push(`${field}: ${fieldErrors}`);
            }
          }
          errorMessage = errors.length > 0 ? errors.join('; ') : JSON.stringify(error.response.data);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showError('Error al guardar la mesa: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {table ? `Editar Mesa` : 'Nueva Mesa'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 -m-2"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Mesa *
              </label>
              <input
                type="text"
                name="table_number"
                value={formData.table_number}
                onChange={handleInputChange}
                placeholder="Ej: 1, 2, 3, A1, B2"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  errors.table_number ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              />
              {errors.table_number && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.table_number}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zona *
              </label>
              <select
                name="zone"
                value={formData.zone}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  errors.zone ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              >
                <option value="">Seleccionar zona...</option>
                {availableZones.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
              {errors.zone && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.zone}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 sm:p-6 border-t border-gray-200 flex-shrink-0">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {table ? 'Actualizar' : 'Crear'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TableModal;