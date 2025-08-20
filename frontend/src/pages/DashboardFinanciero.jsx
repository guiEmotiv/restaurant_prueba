import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { getPeruDate } from '../utils/dashboardUtils';
import AnalyticsCharts from '../components/AnalyticsCharts';
import LoadingSpinner from '../components/LoadingSpinner';

const DashboardFinanciero = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getPeruDate());
  const [dashboardData, setDashboardData] = useState(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await apiService.dashboard.getReport(selectedDate);
      setDashboardData(data);

    } catch (error) {
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Mostrar componentes de loading/error si es necesario
  const loadingComponent = (
    <LoadingSpinner 
      loading={loading}
      error={error}
      onRetry={loadDashboardData}
      loadingText="Cargando datos financieros..."
      showNoData={!dashboardData}
    />
  );

  if (loading || error || !dashboardData) {
    return loadingComponent;
  }

  return (
    <div className="min-h-screen bg-gray-50 -m-4 sm:-m-6 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <AnalyticsCharts 
          dashboardData={dashboardData} 
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
        />
      </div>
    </div>
  );
};

export default DashboardFinanciero;