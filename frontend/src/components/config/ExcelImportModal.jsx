import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Download } from 'lucide-react';
import Button from '../common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const ExcelImportModal = ({ isOpen, onClose, onImportSuccess, title = "Importar desde Excel" }) => {
  const { showSuccess, showError, showInfo } = useToast();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
      setResults(null);
    } else {
      showError('Por favor selecciona un archivo Excel (.xlsx o .xls)');
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResults(null);
    }
  };

  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async () => {
    if (!file) {
      showError('Por favor selecciona un archivo');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiService.units.importExcel(formData);
      setResults(response);

      if (response.errors === 0) {
        showSuccess(`✅ ${response.message}`);
        if (onImportSuccess) {
          onImportSuccess();
        }
      } else {
        showInfo(`⚠️ ${response.message}`);
      }

    } catch (error) {
      console.error('Error importing Excel:', error);
      
      const errorMessage = error.response?.data?.error || 
                          (error.response?.status === 400 ? 'Error en el formato del archivo. Verifique que contenga una columna llamada "name".' :
                           error.response?.status === 401 ? 'Error de autenticación. Recargue la página e intente nuevamente.' :
                           !error.response ? 'Error de conexión. Verifique que el servidor esté funcionando.' :
                           'Error al importar el archivo Excel');
      
      showError(errorMessage);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResults(null);
    setDragActive(false);
    onClose();
  };

  const downloadTemplate = () => {
    // Crear un Excel simple como plantilla
    const templateData = [
      ['name'],
      ['kg'],
      ['litros'],
      ['unidades'],
      ['metros'],
      ['piezas']
    ];
    
    // Crear CSV simple como plantilla (más fácil que Excel)
    const csvContent = templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_unidades.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-2 -m-2 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
        {/* Área de descarga de plantilla */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-900">Plantilla Excel</h4>
              <p className="text-sm text-blue-700 mb-3">
                Descarga la plantilla para asegurar el formato correcto
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="text-blue-700 border-blue-300 hover:bg-blue-100"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar Plantilla
              </Button>
            </div>
          </div>
        </div>

        {/* Área de carga de archivo */}
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
            ${dragActive 
              ? 'border-blue-400 bg-blue-50' 
              : file 
                ? 'border-green-400 bg-green-50' 
                : 'border-gray-300 hover:border-gray-400'
            }
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />

          {file ? (
            <div className="space-y-3">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <p className="font-medium text-green-700">{file.name}</p>
                <p className="text-sm text-green-600">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFile(null)}
                className="text-gray-600"
              >
                <X className="h-4 w-4 mr-2" />
                Cambiar archivo
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {dragActive ? (
                <>
                  <Upload className="h-12 w-12 text-blue-500 mx-auto animate-bounce" />
                  <p className="font-medium text-blue-700">Suelta el archivo aquí</p>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="font-medium text-gray-700">
                      Arrastra tu archivo Excel aquí
                    </p>
                    <p className="text-sm text-gray-500">o</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleBrowseFiles}
                    className="mt-2"
                  >
                    Seleccionar archivo
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Formato esperado y advertencia */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Formato esperado:</h4>
          <div className="text-sm text-gray-600">
            <p>• El archivo debe tener una columna llamada <code className="bg-gray-200 px-1 rounded">name</code></p>
            <p>• Cada fila debe contener el nombre de una unidad</p>
            <p>• Se omitirán las filas vacías</p>
          </div>
        </div>
        
        {/* Advertencia importante */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-900 mb-2">⚠️ Advertencia importante:</h4>
          <div className="text-sm text-red-700">
            <p>• <strong>Todos los datos existentes serán eliminados</strong></p>
            <p>• Los IDs de las unidades se reiniciarán desde 1</p>
            <p>• Solo permanecerán las unidades del archivo Excel</p>
          </div>
        </div>

        {/* Resultados de importación */}
        {results && (
          <div className={`border rounded-lg p-4 ${
            results.errors === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-start gap-3">
              {results.errors === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className={`font-medium ${
                  results.errors === 0 ? 'text-green-900' : 'text-yellow-900'
                }`}>
                  Resultados de la importación
                </h4>
                <div className={`text-sm mt-2 ${
                  results.errors === 0 ? 'text-green-700' : 'text-yellow-700'
                }`}>
                  {results.deleted !== undefined && (
                    <p>• {results.deleted} unidades eliminadas</p>
                  )}
                  <p>• {results.created} unidades creadas</p>
                  {results.updated !== undefined && (
                    <p>• {results.updated} unidades ya existían</p>
                  )}
                  {results.errors > 0 && (
                    <p>• {results.errors} errores encontrados</p>
                  )}
                </div>
                
                {results.error_details && results.error_details.length > 0 && (
                  <div className="mt-3">
                    <p className="font-medium text-yellow-900 mb-1">Errores:</p>
                    <ul className="text-sm text-yellow-700 list-disc list-inside">
                      {results.error_details.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            {results ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!results && (
            <Button
              onClick={handleImport}
              disabled={!file}
              loading={loading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {loading ? 'Importando...' : 'Importar'}
            </Button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelImportModal;