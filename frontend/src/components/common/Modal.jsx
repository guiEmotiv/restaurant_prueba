import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

const Modal = ({ isOpen, onClose, onSubmit, title, initialData = null, columns }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      // Initialize form with empty values based on columns
      const emptyData = {};
      if (columns && Array.isArray(columns)) {
        columns.forEach(column => {
          if (column.key !== 'id' && column.key !== 'created_at' && column.key !== 'updated_at') {
            emptyData[column.key] = '';
          }
        });
      }
      setFormData(emptyData);
    }
  }, [initialData, columns]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 -m-2 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {columns && Array.isArray(columns) ? columns.map((column) => {
            // Skip non-editable fields
            if (column.key === 'id' || column.key === 'created_at' || column.key === 'updated_at') {
              return null;
            }

            return (
              <div key={column.key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {column.title}
                </label>
                {column.type === 'select' ? (
                  <select
                    value={formData[column.key] || ''}
                    onChange={(e) => handleChange(column.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    required={column.required}
                  >
                    <option value="">Seleccionar...</option>
                    {column.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : column.type === 'textarea' ? (
                  <textarea
                    value={formData[column.key] || ''}
                    onChange={(e) => handleChange(column.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    required={column.required}
                  />
                ) : column.type === 'number' ? (
                  <input
                    type="number"
                    step={column.step || '0.01'}
                    min={column.min || '0'}
                    value={formData[column.key] || ''}
                    onChange={(e) => handleChange(column.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    required={column.required}
                  />
                ) : column.type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    checked={formData[column.key] || false}
                    onChange={(e) => handleChange(column.key, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                ) : (
                  <input
                    type={column.type || 'text'}
                    value={formData[column.key] || ''}
                    onChange={(e) => handleChange(column.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    required={column.required}
                  />
                )}
              </div>
            );
          }) : <div className="text-center text-gray-500">No hay columnas definidas</div>}

        </form>
        
        {/* Footer - Sticky on mobile */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" onClick={handleSubmit} className="w-full sm:w-auto">
            {initialData ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Modal;