import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import Button from '../common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const ContainerModal = ({ isOpen, onClose, container = null, onSave }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (container) {
        // Modo edición
        setFormData({
          name: container.name || '',
          price: container.price || '',
          stock: container.stock || ''
        });
      } else {
        // Modo creación
        resetForm();
      }
    }
  }, [isOpen, container]);

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      stock: ''
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
      newErrors.name = 'El nombre del envase es requerido';
    }

    if (!formData.price || formData.price === '') {
      newErrors.price = 'El precio es requerido';
    } else {
      const price = parseFloat(formData.price);
      if (isNaN(price) || price < 0) {
        newErrors.price = 'El precio debe ser un número válido mayor o igual a 0';
      }
    }

    if (!formData.stock || formData.stock === '') {
      newErrors.stock = 'El stock es requerido';
    } else {
      const stock = parseInt(formData.stock);
      if (isNaN(stock) || stock < 0) {
        newErrors.stock = 'El stock debe ser un número válido mayor o igual a 0';
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
      const containerData = {
        name: formData.name.trim(),
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock)
      };
      
      if (container?.id) {
        await apiService.containers.update(container.id, containerData);
        showSuccess('Envase actualizado exitosamente');
      } else {
        await apiService.containers.create(containerData);
        showSuccess('Envase creado exitosamente');
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving container:', error);
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
      
      showError('Error al guardar el envase: ' + errorMessage);
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
              {container ? `Editar Envase` : 'Nuevo Envase'}
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
                Nombre del Envase *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Ej: Taper Pequeño, Bolsa Plástica"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Precio *
              </label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="Ej: 1.50, 2.00"
                step="0.01"
                min="0"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  errors.price ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              />
              {errors.price && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.price}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stock *
              </label>
              <input
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleInputChange}
                placeholder="Ej: 50, 100"
                min="0"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  errors.stock ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              />
              {errors.stock && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.stock}
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
                {container ? 'Actualizar' : 'Crear'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ContainerModal;