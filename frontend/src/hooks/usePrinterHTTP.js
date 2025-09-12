import { useState, useEffect } from 'react';
import { httpPrinterService } from '../services/httpPrinterService';

export const usePrinterHTTP = () => {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPrinters = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await httpPrinterService.getConfigurations();
      setPrinters(response.data || response);
    } catch (err) {
      setError(err.message || 'Error fetching printers');
    } finally {
      setLoading(false);
    }
  };

  const testPrinter = async (printerId) => {
    try {
      const response = await httpPrinterService.testConnection(printerId);
      return response;
    } catch (err) {
      throw new Error(err.message || 'Error testing printer');
    }
  };

  const createPrinter = async (printerData) => {
    try {
      const response = await httpPrinterService.createConfiguration(printerData);
      await fetchPrinters(); // Refresh list
      return response;
    } catch (err) {
      throw new Error(err.message || 'Error creating printer');
    }
  };

  const updatePrinter = async (printerId, printerData) => {
    try {
      const response = await httpPrinterService.updateConfiguration(printerId, printerData);
      await fetchPrinters(); // Refresh list
      return response;
    } catch (err) {
      throw new Error(err.message || 'Error updating printer');
    }
  };

  const deletePrinter = async (printerId) => {
    try {
      await httpPrinterService.deleteConfiguration(printerId);
      await fetchPrinters(); // Refresh list
    } catch (err) {
      throw new Error(err.message || 'Error deleting printer');
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, []);

  return {
    printers,
    loading,
    error,
    fetchPrinters,
    testPrinter,
    createPrinter,
    updatePrinter,
    deletePrinter
  };
};