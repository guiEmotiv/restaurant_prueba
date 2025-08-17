import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Download } from 'lucide-react';
import Button from './Button';
import { useToast } from '../../contexts/ToastContext';

const GenericExcelImportModal = ({ 
  isOpen, 
  onClose, 
  onImportSuccess, 
  title = "Importar desde Excel",
  apiImportFunction,
  templateConfig = {},
  formatDescription = []
}) => {
  const { showSuccess, showError, showWarning } = useToast();
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

      const response = await apiImportFunction(formData);
      setResults(response);

      // Determine success based on multiple criteria for better reliability
      const isFullSuccess = response.success && 
        (response.errors === 0 || response.errors === undefined) &&
        (response.created > 0 || response.count > 0);
      
      const hasPartialSuccess = response.success && 
        (response.created > 0 || response.count > 0) &&
        response.errors > 0;

      if (isFullSuccess) {
        showSuccess(`✅ ${response.message}`);
      } else if (hasPartialSuccess) {
        showWarning(`⚠️ ${response.message}`);
      }

      // Call success callback if any items were created, regardless of errors
      // This ensures UI refresh happens when data is actually imported
      if ((response.created > 0 || response.count > 0) && onImportSuccess) {
        onImportSuccess();
      }

    } catch (error) {
      let errorMessage = 'Error al importar el archivo Excel';
      
      if (error.response?.data) {
        const data = error.response.data;
        
        // Si hay errores de validación detallados
        if (data.error && data.details) {
          errorMessage = data.error;
          // Mostrar los detalles como resultados para que el usuario los vea
          setResults({
            errors: data.details.length,
            error_details: data.details,
            created: 0,
            deleted: 0
          });
          showError(`❌ ${errorMessage}`);
          return; // No limpiar results para que se muestren los errores
        } 
        // Si hay un mensaje de error simple
        else if (data.error) {
          errorMessage = data.error;
        }
        // Si hay errores de validación específicos
        else if (data.details) {
          errorMessage = `Errores encontrados: ${data.details.join(', ')}`;
        }
      } else {
        // Errores de conexión o estado HTTP
        if (error.response?.status === 400) {
          errorMessage = `Error en el formato del archivo. ${formatDescription.length > 0 ? 'Verifique las columnas requeridas.' : ''}`;
        } else if (error.response?.status === 401) {
          errorMessage = 'Error de autenticación. Recargue la página e intente nuevamente.';
        } else if (!error.response) {
          errorMessage = 'Error de conexión. Verifique que el servidor esté funcionando.';
        }
      }
      
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
    if (!templateConfig.filename) {
      showError('No hay plantilla disponible para este tipo de import');
      return;
    }
    
    // Descargar archivo Excel pre-generado desde el servidor
    const templatePath = `/templates/${templateConfig.filename}`;
    const link = document.createElement('a');
    link.href = templatePath;
    link.download = templateConfig.filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Nota: Si el archivo no existe, el navegador mostrará un error 404
    // En producción, estos archivos deben estar en la carpeta public/templates
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
        {templateConfig.columns && templateConfig.columns.length > 0 && (
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
        )}

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

        {/* Formato esperado */}
        {formatDescription.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Formato esperado:</h4>
            <div className="text-sm text-gray-600">
              {formatDescription.map((desc, index) => (
                <p key={index}>• {desc}</p>
              ))}
            </div>
          </div>
        )}
        
        {/* Advertencia importante */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-900 mb-2">⚠️ Advertencia importante:</h4>
          <div className="text-sm text-red-700">
            <p>• <strong>Todos los datos existentes serán eliminados</strong></p>
            <p>• Los IDs se reiniciarán desde 1</p>
            <p>• Solo permanecerán los datos del archivo Excel</p>
          </div>
        </div>

        {/* Resultados de importación */}
        {results && (
          <div className={`border rounded-lg p-4 ${
            (results.errors === 0 || results.errors === undefined) && (results.created > 0 || results.count > 0) ? 'bg-green-50 border-green-200' : 
            results.errors > 0 && (results.created > 0 || results.count > 0) ? 'bg-yellow-50 border-yellow-200' :
            'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-3">
              {(results.errors === 0 || results.errors === undefined) && (results.created > 0 || results.count > 0) ? (
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : results.errors > 0 && (results.created > 0 || results.count > 0) ? (
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className={`font-medium ${
                  (results.errors === 0 || results.errors === undefined) && (results.created > 0 || results.count > 0) ? 'text-green-900' : 
                  results.errors > 0 && (results.created > 0 || results.count > 0) ? 'text-yellow-900' :
                  'text-red-900'
                }`}>
                  {(results.errors === 0 || results.errors === undefined) && (results.created > 0 || results.count > 0) ? 'Importación exitosa' :
                   results.errors > 0 && (results.created > 0 || results.count > 0) ? 'Importación con errores' :
                   'Error en la importación'}
                </h4>
                <div className={`text-sm mt-2 ${
                  (results.errors === 0 || results.errors === undefined) && (results.created > 0 || results.count > 0) ? 'text-green-700' : 
                  results.errors > 0 && (results.created > 0 || results.count > 0) ? 'text-yellow-700' :
                  'text-red-700'
                }`}>
                  {results.deleted !== undefined && results.deleted > 0 && (
                    <p>• {results.deleted} elementos eliminados</p>
                  )}
                  {/* Support both 'created' and 'count' fields for backward compatibility */}
                  {((results.created !== undefined && results.created > 0) || (results.count !== undefined && results.count > 0)) && (
                    <p>• {results.created || results.count} elementos creados</p>
                  )}
                  {results.updated !== undefined && results.updated > 0 && (
                    <p>• {results.updated} elementos actualizados</p>
                  )}
                  {results.errors !== undefined && results.errors > 0 && (
                    <p>• {results.errors} errores encontrados</p>
                  )}
                </div>
                
                {results.error_details && results.error_details.length > 0 && (
                  <div className="mt-3">
                    <p className={`font-medium mb-1 ${
                      results.created > 0 ? 'text-yellow-900' : 'text-red-900'
                    }`}>
                      Errores detallados:
                    </p>
                    <div className={`text-sm max-h-32 overflow-y-auto ${
                      results.created > 0 ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {results.error_details.map((error, index) => (
                        <div key={index} className="mb-1 p-2 bg-white bg-opacity-50 rounded">
                          • {error}
                        </div>
                      ))}
                    </div>
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

export default GenericExcelImportModal;