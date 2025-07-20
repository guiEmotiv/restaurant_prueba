import { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import Button from '../common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const StockUpdateModal = ({ isOpen, onClose, ingredient, onSuccess }) => {
  const { showSuccess, showError } = useToast();
  const [quantity, setQuantity] = useState('');
  const [operation, setOperation] = useState('add');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !ingredient) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!quantity || parseFloat(quantity) <= 0) {
      showError('Por favor ingrese una cantidad válida');
      return;
    }

    try {
      setLoading(true);
      await apiService.ingredients.updateStock(
        ingredient.id, 
        parseFloat(quantity), 
        operation
      );
      
      showSuccess('Stock actualizado correctamente');
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error updating stock:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message;
      showError('Error al actualizar el stock: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQuantity('');
    setOperation('add');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Actualizar Stock - {ingredient.name}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock Actual
            </label>
            <p className="text-lg font-semibold text-gray-900">
              {ingredient.current_stock} {ingredient.unit_name}
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Operación
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="add"
                  checked={operation === 'add'}
                  onChange={(e) => setOperation(e.target.value)}
                  className="mr-2"
                />
                <Plus className="h-4 w-4 text-green-600 mr-1" />
                Agregar
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="subtract"
                  checked={operation === 'subtract'}
                  onChange={(e) => setOperation(e.target.value)}
                  className="mr-2"
                />
                <Minus className="h-4 w-4 text-red-600 mr-1" />
                Restar
              </label>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad ({ingredient.unit_name})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ingrese la cantidad"
              required
            />
          </div>

          {quantity && (
            <div className="mb-6 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                Nuevo stock: {' '}
                <span className={`font-semibold ${
                  operation === 'add' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {operation === 'add' 
                    ? (parseFloat(ingredient.current_stock) + parseFloat(quantity)).toFixed(2)
                    : (parseFloat(ingredient.current_stock) - parseFloat(quantity)).toFixed(2)
                  } {ingredient.unit_name}
                </span>
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={handleClose}
              variant="secondary"
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !quantity}
              className="flex-1"
            >
              {loading ? 'Actualizando...' : 'Actualizar Stock'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockUpdateModal;