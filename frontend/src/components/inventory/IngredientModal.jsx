import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import Button from '../common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const IngredientModal = ({ isOpen, onClose, ingredient = null, onSave }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    unit_price: '',
    current_stock: '',
    is_active: true
  });
  const [availableUnits, setAvailableUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadAvailableData();
      if (ingredient) {
        // Modo edición
        setFormData({
          name: ingredient.name || '',
          unit: ingredient.unit?.id || ingredient.unit || '',
          unit_price: ingredient.unit_price || '',
          current_stock: ingredient.current_stock || '',
          is_active: ingredient.is_active !== undefined ? ingredient.is_active : true
        });
      } else {
        // Modo creación
        resetForm();
      }
    }
  }, [isOpen, ingredient]);

  const resetForm = () => {
    setFormData({
      name: '',
      unit: '',
      unit_price: '',
      current_stock: '',
      is_active: true
    });
    setErrors({});
  };

  const loadAvailableData = async () => {
    try {
      const unitsData = await apiService.units.getAll();
      setAvailableUnits(Array.isArray(unitsData) ? unitsData : []);
    } catch (error) {
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'El nombre es requerido';
    }


    if (!formData.unit || formData.unit === '') {
      newErrors.unit = 'La unidad es requerida';
    } else {
      const unitId = parseInt(formData.unit);
      if (isNaN(unitId) || unitId <= 0) {
        newErrors.unit = 'Debe seleccionar una unidad válida';
      }
    }

    if (!formData.unit_price || formData.unit_price === '') {
      newErrors.unit_price = 'El precio unitario es requerido';
    } else {
      const price = parseFloat(formData.unit_price);
      if (isNaN(price) || price < 0) {
        newErrors.unit_price = 'El precio debe ser un número válido mayor o igual a 0';
      }
    }

    if (!formData.current_stock || formData.current_stock === '') {
      newErrors.current_stock = 'El stock actual es requerido';
    } else {
      const stock = parseFloat(formData.current_stock);
      if (isNaN(stock) || stock < 0) {
        newErrors.current_stock = 'El stock debe ser un número válido mayor o igual a 0';
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
      const ingredientData = {
        name: formData.name.trim(),
        unit: parseInt(formData.unit),
        unit_price: parseFloat(formData.unit_price),
        current_stock: parseFloat(formData.current_stock),
        is_active: formData.is_active
      };
      
      if (ingredient?.id) {
        await apiService.ingredients.update(ingredient.id, ingredientData);
        showSuccess('Ingrediente actualizado exitosamente');
      } else {
        await apiService.ingredients.create(ingredientData);
        showSuccess('Ingrediente creado exitosamente');
      }
      
      onSave();
      onClose();
    } catch (error) {
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
      
      showError('Error al guardar el ingrediente: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {ingredient ? `Editar Ingrediente` : 'Nuevo Ingrediente'}
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
                Nombre *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Ej: Tomate, Cebolla, Aceite de oliva"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unidad *
                </label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.unit ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loading}
                >
                  <option value="">Seleccionar unidad...</option>
                  {availableUnits.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
                {errors.unit && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.unit}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precio Unitario (PEN) *
                </label>
                <input
                  type="number"
                  name="unit_price"
                  value={formData.unit_price}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.unit_price ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loading}
                />
                {errors.unit_price && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.unit_price}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Actual *
                </label>
                <input
                  type="number"
                  name="current_stock"
                  value={formData.current_stock}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    errors.current_stock ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loading}
                />
                {errors.current_stock && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.current_stock}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_active"
                id="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={loading}
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                Ingrediente activo
              </label>
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
                {ingredient ? 'Actualizar' : 'Crear'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IngredientModal;