/**
 * Badge minimalista para mostrar estado de cola de impresión
 * Diseñado para ser discreto y no interferir con la UI existente
 */
import usePrintQueue from '../hooks/usePrintQueue';

const PrintQueueBadge = ({ orderId = null, className = '' }) => {
  const { pending, failed, hasIssues, isEmpty, loading, retryFailed } = usePrintQueue(orderId);

  // No mostrar nada si está vacío y sin problemas
  if (isEmpty && !loading) {
    return null;
  }

  // Badge muy sutil para trabajos pendientes
  if (pending > 0 && failed === 0) {
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 ${className}`}>
        <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1 animate-pulse"></div>
        {pending} imprimiendo
      </div>
    );
  }

  // Badge sutil para trabajos fallidos
  if (failed > 0) {
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-700 border border-red-200 ${className}`}>
        <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
        {failed} falló{failed > 1 ? 'aron' : ''}
        <button 
          onClick={retryFailed}
          className="ml-1 text-red-600 hover:text-red-800 underline"
          title="Reintentar impresión"
        >
          reintentar
        </button>
      </div>
    );
  }

  // Estado de carga (muy discreto)
  if (loading) {
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-500 ${className}`}>
        <div className="w-2 h-2 border border-gray-400 border-t-transparent rounded-full animate-spin mr-1"></div>
        verificando...
      </div>
    );
  }

  return null;
};

export default PrintQueueBadge;