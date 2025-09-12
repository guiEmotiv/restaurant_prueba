import React, { useState, useEffect } from 'react';
import { 
  Printer, Plus, Settings, Trash2, TestTube, 
  RefreshCw, Eye, AlertCircle, CheckCircle, Edit3, Save, X,
  Wifi, Usb, Clock, Activity, List
} from 'lucide-react';
import { httpPrinterService } from '../../services/httpPrinterService';

const PrinterManagementImproved = () => {
  const [printers, setPrinters] = useState([]);
  const [availablePorts, setAvailablePorts] = useState([]);
  const [queueJobs, setQueueJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    usb_port: '',
    description: '',
    is_active: true,
    baud_rate: 9600,
    paper_width_mm: 80
  });
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('printers'); // 'printers' | 'queue'

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
    // Recargar cada 30 segundos
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [printersResponse, portsResponse, queueResponse] = await Promise.all([
        httpPrinterService.getConfigurations(),
        httpPrinterService.scanAvailablePorts(),
        httpPrinterService.getQueueJobs().catch(() => ({ results: [] }))
      ]);
      
      setPrinters(printersResponse?.results || printersResponse?.data || []);
      setAvailablePorts(portsResponse.available_ports || []);
      setQueueJobs(queueResponse?.results || queueResponse?.jobs || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showMessage('Error cargando datos de impresoras', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Helper function to update action loading state
  const updateActionLoading = (key, value) => {
    setActionLoading(prev => ({ ...prev, [key]: value }));
  };

  const openAddModal = () => {
    setEditingPrinter(null);
    setFormData({
      name: '',
      usb_port: '',
      description: '',
      is_active: true,
      baud_rate: 9600,
      paper_width_mm: 80
    });
    setShowModal(true);
  };

  const openEditModal = (printer) => {
    setEditingPrinter(printer);
    setFormData({
      name: printer.name || '',
      usb_port: printer.usb_port || '',
      description: printer.description || '',
      is_active: printer.is_active || false,
      baud_rate: printer.baud_rate || 9600,
      paper_width_mm: printer.paper_width_mm || 80
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPrinter(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.usb_port.trim()) {
      showMessage('Nombre y puerto USB son requeridos', 'error');
      return;
    }

    try {
      updateActionLoading('save', true);
      
      if (editingPrinter) {
        await httpPrinterService.updateConfiguration(editingPrinter.id, formData);
        showMessage('Impresora actualizada exitosamente');
      } else {
        await httpPrinterService.createConfiguration(formData);
        showMessage('Impresora creada exitosamente');
      }
      
      closeModal();
      await loadData();
    } catch (error) {
      console.error('Error saving printer:', error);
      showMessage('Error al guardar impresora', 'error');
    } finally {
      updateActionLoading('save', false);
    }
  };

  const handleTestPrinter = async (printerId) => {
    try {
      updateActionLoading(`test-${printerId}`, true);
      const response = await httpPrinterService.testConnection(printerId);
      
      console.log('Test response:', response); // Debug para ver la estructura
      
      // El backend devuelve { printer: {...}, test_result: {...} }
      const testResult = response.test_result;
      
      if (testResult && testResult.success) {
        showMessage(`✅ Prueba de impresión exitosa: ${testResult.message || 'Impresora funcionando correctamente'}`);
        // Recargar datos para reflejar cambios de estado
        loadData();
      } else {
        const errorMsg = testResult?.error || testResult?.message || 'Error desconocido en la prueba';
        showMessage(`❌ Error en prueba: ${errorMsg}`, 'error');
      }
    } catch (error) {
      console.error('Error testing printer:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Error al conectar con el servidor';
      showMessage(`❌ Error al probar impresora: ${errorMsg}`, 'error');
    } finally {
      updateActionLoading(`test-${printerId}`, false);
    }
  };

  const handleRefreshStatus = async (printer) => {
    try {
      updateActionLoading(`refresh-${printer.id}`, true);
      // Verificar SOLO conexión USB sin imprimir nada
      const usbResult = await httpPrinterService.checkUsbConnection(printer.id);
      // Recargar datos para mostrar el estado actualizado
      await loadData();
    } catch (error) {
      console.error('Error refreshing printer status:', error);
      showMessage('Error al verificar estado USB', 'error');
    } finally {
      updateActionLoading(`refresh-${printer.id}`, false);
    }
  };

  const handleDeletePrinter = async (printerId) => {
    if (!confirm('¿Estás seguro de eliminar esta impresora?')) return;
    
    try {
      updateActionLoading(`delete-${printerId}`, true);
      await httpPrinterService.deleteConfiguration(printerId);
      showMessage('Impresora eliminada exitosamente');
      await loadData();
    } catch (error) {
      console.error('Error deleting printer:', error);
      // Mostrar mensaje específico del servidor si está disponible
      const errorMessage = error.response?.data?.error || 'Error al eliminar impresora';
      showMessage(errorMessage, 'error');
    } finally {
      updateActionLoading(`delete-${printerId}`, false);
    }
  };

  const handleProcessQueue = async () => {
    try {
      updateActionLoading('process-queue', true);
      const result = await httpPrinterService.processPendingJobs(10);
      const { processed, successful, failed } = result.processing_results;
      showMessage(`Cola procesada: ${processed} trabajos (${successful} exitosos, ${failed} fallidos)`);
      await loadData();
    } catch (error) {
      console.error('Error processing queue:', error);
      showMessage('Error al procesar cola', 'error');
    } finally {
      updateActionLoading('process-queue', false);
    }
  };

  const handleClearCompleted = async () => {
    if (!confirm('¿Estás seguro de limpiar los trabajos completados?')) return;
    
    try {
      updateActionLoading('clear-completed', true);
      const result = await httpPrinterService.clearCompletedJobs();
      showMessage(`${result.deleted_count} trabajos completados eliminados`);
      await loadData();
    } catch (error) {
      console.error('Error clearing completed jobs:', error);
      showMessage('Error al limpiar trabajos completados', 'error');
    } finally {
      updateActionLoading('clear-completed', false);
    }
  };

  const handleRetryJob = async (jobId) => {
    try {
      updateActionLoading(`retry-${jobId}`, true);
      await httpPrinterService.retryPrintJob(jobId);
      showMessage('Trabajo reenviado a la cola');
      await loadData();
    } catch (error) {
      console.error('Error retrying job:', error);
      showMessage('Error al reintentar trabajo', 'error');
    } finally {
      updateActionLoading(`retry-${jobId}`, false);
    }
  };

  const handleCancelJob = async (jobId) => {
    try {
      updateActionLoading(`cancel-${jobId}`, true);
      await httpPrinterService.cancelPrintJob(jobId);
      showMessage('Trabajo cancelado exitosamente');
      await loadData();
    } catch (error) {
      console.error('Error canceling job:', error);
      showMessage('Error al cancelar trabajo', 'error');
    } finally {
      updateActionLoading(`cancel-${jobId}`, false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'printing': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando configuración de impresoras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Printer className="w-8 h-8 text-blue-600" />
                Gestión de Impresoras
              </h1>
              <p className="text-gray-600 mt-2">
                Administra las impresoras USB conectadas al Raspberry Pi 4
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nueva Impresora
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3">
              <Printer className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Impresoras</p>
                <p className="text-2xl font-bold text-gray-900">{Array.isArray(printers) ? printers.length : 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Activas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Array.isArray(printers) ? printers.filter(p => p.is_active).length : 0}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3">
              <Usb className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Puertos Disponibles</p>
                <p className="text-2xl font-bold text-gray-900">{availablePorts.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3">
              <List className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">En Cola</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Array.isArray(queueJobs) ? queueJobs.filter(j => j.status === 'pending').length : 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('printers')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'printers'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Printer className="w-4 h-4 inline mr-2" />
                Impresoras ({Array.isArray(printers) ? printers.length : 0})
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'queue'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <List className="w-4 h-4 inline mr-2" />
                Cola de Impresión ({queueJobs.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'printers' && (
              <div className="space-y-4">
                {!Array.isArray(printers) || printers.length === 0 ? (
                  <div className="text-center py-12">
                    <Printer className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No hay impresoras configuradas
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Agrega tu primera impresora USB para comenzar
                    </p>
                    <button
                      onClick={openAddModal}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Agregar Impresora
                    </button>
                  </div>
                ) : (
                  (Array.isArray(printers) ? printers : []).map((printer) => (
                    <div key={printer.id} className="bg-gray-50 p-6 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {printer.name}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              printer.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {printer.is_active ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <Usb className="w-4 h-4" />
                              Puerto: {printer.usb_port}
                            </div>
                          </div>
                          {printer.description && (
                            <p className="text-sm text-gray-600 mt-2">{printer.description}</p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 ml-6">
                          <button
                            onClick={() => handleTestPrinter(printer.id)}
                            disabled={actionLoading[`test-${printer.id}`] || !printer.is_active}
                            className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              printer.is_active 
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                            title={printer.is_active ? "Probar impresora (imprime test)" : "Impresora inactiva - No se puede probar"}
                          >
                            {actionLoading[`test-${printer.id}`] ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <TestTube className="w-4 h-4" />
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleRefreshStatus(printer)}
                            disabled={actionLoading[`refresh-${printer.id}`]}
                            className="p-2 rounded-lg transition-colors disabled:opacity-50 bg-green-100 text-green-700 hover:bg-green-200"
                            title="Verificar conexión USB (sin imprimir)"
                          >
                            {actionLoading[`refresh-${printer.id}`] ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </button>
                          
                          <button
                            onClick={() => openEditModal(printer)}
                            className="bg-yellow-100 text-yellow-700 p-2 rounded-lg hover:bg-yellow-200 transition-colors"
                            title="Editar configuración"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeletePrinter(printer.id)}
                            disabled={actionLoading[`delete-${printer.id}`]}
                            className="bg-red-100 text-red-700 p-2 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                            title="Eliminar impresora"
                          >
                            {actionLoading[`delete-${printer.id}`] ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'queue' && (
              <div className="overflow-hidden">

                {queueJobs.length === 0 ? (
                  <div className="text-center py-12">
                    <List className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No hay trabajos en cola
                    </h3>
                    <p className="text-gray-600">
                      Los trabajos de impresión aparecerán aquí
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Printer
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Recipe
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Order
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(Array.isArray(queueJobs) ? queueJobs : []).map((job) => (
                          <tr key={job.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                #{job.id}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {job.printer_name || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500 font-mono">
                                {job.printer_port || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {job.recipe_name || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {job.order_id ? `#${job.order_id}` : 'N/A'}
                              </div>
                              {job.order_table && (
                                <div className="text-xs text-gray-500">
                                  Mesa {job.order_table}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {job.created_at_formatted || new Date(job.created_at).toLocaleString('es-PE', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {job.status === 'pending' && (
                                <div>
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                    Pendiente
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {job.specific_message || 'Internet'}
                                  </div>
                                </div>
                              )}
                              {job.status === 'completed' && (
                                <div>
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                    Completado
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {job.specific_message || 'Impreso exitosamente'}
                                  </div>
                                </div>
                              )}
                              {job.status === 'cancelled' && (
                                <div>
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                    Cancelado
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {job.specific_message || 'Cancelado'}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {job.status === 'pending' && (
                                <button
                                  onClick={() => handleCancelJob(job.id)}
                                  disabled={actionLoading[`cancel-${job.id}`]}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50 p-1"
                                  title="Cancelar trabajo"
                                >
                                  {actionLoading[`cancel-${job.id}`] ? (
                                    <X className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <X className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPrinter ? 'Editar Impresora' : 'Nueva Impresora'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Impresora *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Impresora Cocina Principal"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Puerto USB *
                </label>
                <select
                  value={formData.usb_port}
                  onChange={(e) => setFormData({ ...formData, usb_port: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Seleccionar puerto...</option>
                  {availablePorts
                    .filter(port => {
                      // Filtrar puertos ya utilizados por otras impresoras
                      const isUsedByOther = printers.some(printer => 
                        printer.usb_port === port && printer.id !== editingPrinter?.id
                      );
                      return !isUsedByOther;
                    })
                    .map(port => (
                      <option key={port} value={port}>{port}</option>
                    ))
                  }
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Impresora térmica para etiquetas de cocina"
                  rows="2"
                />
              </div>



              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading.save}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading.save ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrinterManagementImproved;