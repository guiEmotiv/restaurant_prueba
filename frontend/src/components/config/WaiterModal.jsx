import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import Button from '../common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const WaiterModal = ({ isOpen, onClose, waiter = null, onSave }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (waiter) {
        // Modo edición
        setFormData({
          name: waiter.name || ''
        });
      } else {
        // Modo creación
        resetForm();
      }
    }
  }, [isOpen, waiter]);

  const resetForm = () => {
    setFormData({
      name: ''
    });
    setErrors({});
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
    
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'El nombre del mesero es requerido';
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
      const waiterData = {
        name: formData.name.trim()
      };
      
      if (waiter?.id) {
        await apiService.waiters.update(waiter.id, waiterData);
        showSuccess('Mesero actualizado exitosamente');
      } else {
        await apiService.waiters.create(waiterData);
        showSuccess('Mesero creado exitosamente');
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving waiter:', error);
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
      
      showError('Error al guardar el mesero: ' + errorMessage);
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
              {waiter ? `Editar Mesero` : 'Nuevo Mesero'}
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
                Nombre del Mesero *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Ej: Juan Pérez, María García"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.name}
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
                {waiter ? 'Actualizar' : 'Crear'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WaiterModal;