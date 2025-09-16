import React, { useState, useEffect } from 'react';
import { Printer, Plus, Settings, Trash2, TestTube, Play, Pause, RefreshCw, Eye, AlertCircle, CheckCircle, Clock, RotateCcw, X } from 'lucide-react';
import { httpPrinterService } from '../../services/httpPrinterService';
import { apiService } from '../../services/api';

const PrinterManagement = () => {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [availablePorts, setAvailablePorts] = useState([]);
  const [newPrinter, setNewPrinter] = useState({
    name: '',
    usb_port: '',
    baud_rate: 9600,
    paper_width_mm: 80
  });
  const [message, setMessage] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
    // Recargar cada 30 segundos
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const printersData = await httpPrinterService.getPrinterStatusSummary();
      setPrinters(printersData.printers || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showMessage('Error cargando datos de impresoras', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePorts = async () => {
    try {
      setActionLoading(prev => ({ ...prev, scanning_ports: true }));
      const portsData = await httpPrinterService.scanAvailablePorts();
      setAvailablePorts(portsData.available_ports || []);
      if (portsData.rpi_status === 'unreachable') {
        showMessage('RPi no alcanzable, usando puertos comunes', 'warning');
      }
    } catch (error) {
      console.error('Error loading available ports:', error);
      // Fallback a puertos comunes si falla
      setAvailablePorts(httpPrinterService.getCommonUsbPorts());
      showMessage('Error escaneando puertos, usando fallback', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, scanning_ports: false }));
    }
  };

  // REMOVIDO: loadPrinterJobs y togglePrinterExpanded - Ya no se usa PrintQueue con impresión USB directa


  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const setLoading_ = (key, value) => {
    setActionLoading(prev => ({ ...prev, [key]: value }));
  };

  // Crear nueva impresora
  const handleCreatePrinter = async (e) => {
    e.preventDefault();
    setLoading_('create', true);
    
    try {
      const result = await httpPrinterService.createPrinterConfig({
        ...newPrinter,
        usb_port: httpPrinterService.formatUsbPort(newPrinter.usb_port)
      });
      
      showMessage(`Impresora "${result.name}" creada exitosamente`);
      setShowAddPrinter(false);
      setAvailablePorts([]);
      setNewPrinter({
        name: '',
        usb_port: '',
        baud_rate: 9600,
        paper_width_mm: 80
      });

      await loadData();
    } catch (error) {
      showMessage('Error creando impresora: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setLoading_('create', false);
    }
  };

  // Probar conexión de impresora
  const handleTestPrinter = async (printer) => {
    setLoading_(`test_${printer.id}`, true);
    
    try {
      const result = await httpPrinterService.testPrinterConnection(printer.id);
      if (result.test_result.success) {
        showMessage(`✅ Test exitoso en ${printer.name}`);
      } else {
        showMessage(`❌ Test fallido en ${printer.name}: ${result.test_result.error}`, 'error');
      }
      await loadData();
    } catch (error) {
      showMessage(`Error probando ${printer.name}: ` + error.message, 'error');
    } finally {
      setLoading_(`test_${printer.id}`, false);
    }
  };

  // Activar/desactivar impresora
  const handleTogglePrinter = async (printer) => {
    setLoading_(`toggle_${printer.id}`, true);
    
    try {
      if (printer.is_active) {
        await httpPrinterService.deactivatePrinter(printer.id);
        showMessage(`Impresora ${printer.name} desactivada`);
      } else {
        await httpPrinterService.activatePrinter(printer.id);
        showMessage(`Impresora ${printer.name} activada`);
      }
      await loadData();
    } catch (error) {
      showMessage(`Error cambiando estado de ${printer.name}: ` + error.message, 'error');
    } finally {
      setLoading_(`toggle_${printer.id}`, false);
    }
  };

  // Eliminar impresora
  const handleDeletePrinter = async (printer) => {
    if (!window.confirm(`¿Estás seguro de eliminar la impresora "${printer.name}"?`)) {
      return;
    }

    setLoading_(`delete_${printer.id}`, true);
    
    try {
      await httpPrinterService.deletePrinterConfig(printer.id);
      showMessage(`Impresora "${printer.name}" eliminada exitosamente`);
      await loadData();
    } catch (error) {
      showMessage('Error eliminando impresora: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setLoading_(`delete_${printer.id}`, false);
    }
  };

  // Probar todas las impresoras
  const handleTestAll = async () => {
    setLoading_('test_all', true);
    
    try {
      const result = await httpPrinterService.testAllPrinters();
      const { successful, failed } = result.summary;
      showMessage(`Test completado: ${successful} exitosas, ${failed} fallidas`);
      await loadData();
    } catch (error) {
      showMessage('Error probando impresoras: ' + error.message, 'error');
    } finally {
      setLoading_('test_all', false);
    }
  };

  // REMOVIDO: handleProcessQueue, handleRetryJob, handleCancelJob - Ya no se usa PrintQueue con impresión USB directa


  // REMOVIDO: Helper functions para estados de trabajos - Ya no se usa PrintQueue

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Cargando configuración de impresoras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Printer className="w-8 h-8" />
            Gestión de Impresoras
          </h1>
          <p className="text-gray-600 mt-1">
            Configuración y monitoreo de impresoras USB conectadas al Raspberry Pi
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              setShowAddPrinter(true);
              await loadAvailablePorts();
            }}
            disabled={actionLoading.scanning_ports}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Agregar Impresora
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-100 text-green-800 border border-green-200'
            : message.type === 'warning'
            ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}


      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleTestAll}
          disabled={actionLoading.test_all}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
        >
          {actionLoading.test_all ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <TestTube className="w-4 h-4" />
          )}
          Probar Todas
        </button>
        <button
          onClick={loadData}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Lista de impresoras */}
      <div className="grid gap-4">
        {printers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Printer className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay impresoras configuradas</h3>
            <p className="text-gray-600 mb-4">Agrega tu primera impresora para comenzar</p>
            <button
              onClick={async () => {
                setShowAddPrinter(true);
                await loadAvailablePorts();
              }}
              disabled={actionLoading.scanning_ports}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Agregar Primera Impresora
            </button>
          </div>
        ) : (
          printers.map((printer) => (
            <div key={printer.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Header de la impresora */}
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Printer className="w-5 h-5" />
                        <h3 className="text-lg font-semibold">{printer.name}</h3>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        printer.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {printer.status_display}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Puerto:</span>
                        <div className="font-mono text-xs">{printer.usb_port}</div>
                      </div>
                      <div>
                        <span className="font-medium">Último uso:</span>
                        <div>{printer.last_used_at_formatted}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestPrinter(printer)}
                      disabled={actionLoading[`test_${printer.id}`] || !printer.is_active}
                      className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                        printer.is_active 
                          ? 'bg-blue-600 text-white hover:bg-blue-700' 
                          : 'bg-gray-400 text-white cursor-not-allowed'
                      }`}
                      title={printer.is_active ? "Probar impresora" : "Impresora inactiva - No se puede probar"}
                    >
                      {actionLoading[`test_${printer.id}`] ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleTogglePrinter(printer)}
                      disabled={actionLoading[`toggle_${printer.id}`]}
                      className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 disabled:opacity-50 ${
                        printer.is_active 
                          ? 'bg-orange-600 text-white hover:bg-orange-700'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                      title={printer.is_active ? "Desactivar" : "Activar"}
                    >
                      {actionLoading[`toggle_${printer.id}`] ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : printer.is_active ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleDeletePrinter(printer)}
                      disabled={actionLoading[`delete_${printer.id}`]}
                      className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 flex items-center gap-1 disabled:opacity-50"
                      title="Eliminar impresora"
                    >
                      {actionLoading[`delete_${printer.id}`] ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* REMOVIDO: Cola de impresión - Ya no se usa con impresión USB directa */}
              {false && (
                <div className="border-t bg-gray-50">
                  <div className="px-6 py-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-md font-medium">Cola de Impresión</h4>
                      <button
                        onClick={() => loadPrinterJobs(printer.id)}
                        className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Actualizar
                      </button>
                    </div>

                    {!printerJobs[printer.id] ? (
                      <div className="text-center py-4 text-gray-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm">Cargando trabajos...</p>
                      </div>
                    ) : printerJobs[printer.id].length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No hay trabajos en cola</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded border overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Job #</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Receta</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mesa</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pedido</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tiempo</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {printerJobs[printer.id].map((job) => (
                              <tr key={job.id} className={`hover:bg-gray-50 ${
                                job.status === 'failed' ? 'bg-red-25' :
                                job.status === 'in_progress' ? 'bg-blue-25' :
                                job.status === 'printed' ? 'bg-green-25' :
                                ''
                              }`}>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getJobStatusClass(job.status)}`}>
                                    {getJobStatusIcon(job.status)} {job.status}
                                  </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">#{job.id}</td>
                                <td className="px-3 py-2 text-sm text-gray-900 max-w-32 truncate">{job.order_item_name || 'N/A'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{job.table_number || 'N/A'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">#{job.order_id}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {httpPrinterService.getTimeElapsed(job.created_at)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                                  <div className="flex items-center gap-1">
                                    {job.status === 'failed' && job.can_retry && (
                                      <button
                                        onClick={() => handleRetryJob(job.id, printer.id)}
                                        disabled={actionLoading[`retry_${job.id}`]}
                                        className="bg-orange-600 text-white px-2 py-1 rounded text-xs hover:bg-orange-700 disabled:opacity-50"
                                        title="Reintentar"
                                      >
                                        {actionLoading[`retry_${job.id}`] ? (
                                          <RefreshCw className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <RotateCcw className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                    
                                    {job.status !== 'printed' && job.status !== 'cancelled' && (
                                      <button
                                        onClick={() => handleCancelJob(job.id, job.order_item_name, printer.id)}
                                        disabled={actionLoading[`cancel_${job.id}`]}
                                        className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700 disabled:opacity-50"
                                        title="Cancelar"
                                      >
                                        {actionLoading[`cancel_${job.id}`] ? (
                                          <RefreshCw className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <X className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                  {job.error_message && (
                                    <div className="mt-1 text-xs text-red-600 max-w-40 truncate" title={job.error_message}>
                                      {job.error_message}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Agregar Impresora */}
      {showAddPrinter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Agregar Nueva Impresora</h3>
            
            <form onSubmit={handleCreatePrinter} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Impresora
                </label>
                <input
                  type="text"
                  value={newPrinter.name}
                  onChange={(e) => setNewPrinter(prev => ({...prev, name: e.target.value}))}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  placeholder="ej: Etiquetadora Mesa 1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Puerto USB
                  <button
                    type="button"
                    onClick={loadAvailablePorts}
                    disabled={actionLoading.scanning_ports}
                    className="ml-2 text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
                    title="Escanear puertos disponibles"
                  >
                    {actionLoading.scanning_ports ? (
                      <RefreshCw className="w-3 h-3 inline animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3 inline" />
                    )}
                    Escanear
                  </button>
                </label>
                <select
                  value={newPrinter.usb_port}
                  onChange={(e) => setNewPrinter(prev => ({...prev, usb_port: e.target.value}))}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">
                    {actionLoading.scanning_ports
                      ? "Escaneando puertos..."
                      : availablePorts.length > 0
                        ? "Seleccionar puerto..."
                        : "No hay puertos detectados"}
                  </option>
                  {availablePorts.map(port => (
                    <option key={port} value={port}>{port}</option>
                  ))}
                </select>
                {availablePorts.length === 0 && !actionLoading.scanning_ports && (
                  <p className="text-sm text-gray-500 mt-1">
                    Haz clic en "Escanear" para detectar puertos USB disponibles en el RPi
                  </p>
                )}
              </div>


              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPrinter(false);
                    setAvailablePorts([]);
                    setNewPrinter({
                      name: '',
                      usb_port: '',
                      baud_rate: 9600,
                      paper_width_mm: 80
                    });
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading.create}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading.create ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Crear Impresora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrinterManagement;