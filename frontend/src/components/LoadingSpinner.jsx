import { AlertCircle } from 'lucide-react';

const LoadingSpinner = ({ 
  loading = false, 
  error = null, 
  onRetry = null,
  loadingText = "Cargando...",
  noDataText = "No hay datos disponibles",
  showNoData = false 
}) => {
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">{loadingText}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          {onRetry && (
            <button 
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (showNoData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-600">{noDataText}</p>
        </div>
      </div>
    );
  }

  return null;
};

export default LoadingSpinner;