import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Waiters = () => {
  const { showSuccess, showError } = useToast();
  const [waiters, setWaiters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWaiters();
  }, []);

  const loadWaiters = async () => {
    try {
      setLoading(true);
      console.log('🚀 Starting to load waiters...');
      
      // Direct API call without service
      const response = await fetch('/api/v1/waiters/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);
      
      const data = await response.json();
      console.log('📋 Raw JSON data:', data);
      console.log('📋 Data type:', typeof data);
      console.log('📋 Is array:', Array.isArray(data));
      
      if (Array.isArray(data)) {
        console.log('✅ Setting waiters as array:', data);
        setWaiters(data);
      } else {
        console.log('⚠️ Data is not array, setting empty array');
        setWaiters([]);
      }
      
    } catch (error) {
      console.error('❌ Error loading waiters:', error);
      showError('Error al cargar los meseros');
      setWaiters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const name = prompt('Nombre del mesero:');
    if (name) {
      try {
        const response = await fetch('/api/v1/waiters/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name }),
        });
        
        if (response.ok) {
          showSuccess('Mesero creado exitosamente');
          await loadWaiters();
        } else {
          throw new Error('Error creating waiter');
        }
      } catch (error) {
        console.error('Error creating waiter:', error);
        showError('Error al crear el mesero');
      }
    }
  };

  console.log('🔍 About to render. Waiters:', waiters);
  console.log('🔍 Waiters length:', waiters?.length);
  console.log('🔍 Loading:', loading);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Meseros</h1>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meseros</h1>
        <Button onClick={handleCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Mesero
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium mb-4">Lista de Meseros</h2>
        
        {!waiters || waiters.length === 0 ? (
          <p className="text-gray-500">No hay meseros registrados</p>
        ) : (
          <div className="space-y-2">
            {waiters.map((waiter, index) => (
              <div key={waiter?.id || index} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <span className="font-medium">ID: {waiter?.id || 'N/A'}</span>
                  <span className="ml-4">Nombre: {waiter?.name || 'Sin nombre'}</span>
                </div>
              </div>
            )) || <p>Error rendering waiters</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default Waiters;