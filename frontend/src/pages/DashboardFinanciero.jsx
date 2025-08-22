import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../services/api';
import { getPeruDate } from '../utils/dashboardUtils';
import AnalyticsCharts from '../components/AnalyticsCharts';
import LoadingSpinner from '../components/LoadingSpinner';
import { DollarSign, Clock, Calendar, Filter } from 'lucide-react';

const DashboardFinanciero = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getPeruDate());
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // Período inteligente
  const [chartType, setChartType] = useState('sales'); // Vista actual
  const [dashboardData, setDashboardData] = useState(null);
  const [goals, setGoals] = useState({
    sales: { meta300: 300, meta500: 500 },
    production: { meta300: 20, meta500: 50 }
  });

  // Memoizar opciones de período para evitar re-creaciones
  const periodOptions = useMemo(() => [
    { value: 'month', label: 'Último Mes' },
    { value: 'quarter', label: 'Último Trimestre' },
    { value: 'semester', label: 'Último Semestre' },
    { value: 'year', label: 'Último Año' }
  ], []);

  // Memoizar opciones de vista para evitar re-creaciones
  const chartOptions = useMemo(() => [
    { key: 'sales', label: 'Ventas', icon: DollarSign },
    { key: 'production', label: 'Producción', icon: Clock }
  ], []);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await apiService.dashboardFinanciero.getReport(selectedDate, selectedPeriod);
      setDashboardData(data);
      
      // Actualizar metas si vienen del backend
      if (data.goals) {
        setGoals(data.goals);
      }

    } catch (error) {
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedPeriod]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Memoizar callbacks para evitar re-renders
  const handlePeriodChange = useCallback((period) => {
    setSelectedPeriod(period);
  }, []);

  const handleChartTypeChange = useCallback((type) => {
    setChartType(type);
  }, []);

  // Memoizar componente de loading para evitar re-creaciones
  const loadingComponent = useMemo(() => (
    <LoadingSpinner 
      loading={loading}
      error={error}
      onRetry={loadDashboardData}
      loadingText="Cargando datos financieros..."
      showNoData={!dashboardData}
    />
  ), [loading, error, loadDashboardData, dashboardData]);

  if (loading || error || !dashboardData) {
    return loadingComponent;
  }

  return (
    <div className="min-h-screen bg-gray-50 -m-4 sm:-m-6 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header unificado con todos los controles */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            
            {/* Filtro de Período */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Período:</span>
              </div>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {periodOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handlePeriodChange(option.value)}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                      selectedPeriod === option.value
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vista */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Vista:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {chartOptions.map(chart => {
                  const Icon = chart.icon;
                  return (
                    <button
                      key={chart.key}
                      onClick={() => handleChartTypeChange(chart.key)}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
                        chartType === chart.key
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {chart.label}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Información del período y metas */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              
              {/* Info del período */}
              {dashboardData?.period_info && (
                <div className="text-sm text-gray-600">
                  {dashboardData.period_info.start_date && dashboardData.period_info.end_date ? (
                    <>
                      <span className="font-medium">Período:</span> Desde {dashboardData.period_info.start_date} hasta {dashboardData.period_info.end_date}
                      {dashboardData.period_info.total_days && (
                        <span className="ml-2 text-gray-500">({dashboardData.period_info.total_days} días)</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-medium">Período:</span> Todos los datos disponibles
                    </>
                  )}
                </div>
              )}

              {/* Metas dinámicas */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Metas:</span>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                      <span className="text-sm text-gray-600">
                        Promedio: {chartType === 'sales' ? `S/ ${(goals[chartType]?.meta300 || 0).toFixed(2)}` : `${goals[chartType]?.meta300 || 0} items`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                      <span className="text-sm text-gray-600">
                        Máximo: {chartType === 'sales' ? `S/ ${(goals[chartType]?.meta500 || 0).toFixed(2)}` : `${goals[chartType]?.meta500 || 0} items`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Gráfica */}
        <AnalyticsCharts 
          dashboardData={dashboardData} 
          selectedDate={selectedDate}
          selectedPeriod={selectedPeriod}
          chartType={chartType}
          goals={goals}
          onDateChange={setSelectedDate}
          onPeriodChange={handlePeriodChange}
          onChartTypeChange={handleChartTypeChange}
          onGoalsChange={setGoals}
        />
      </div>
    </div>
  );
};

export default DashboardFinanciero;