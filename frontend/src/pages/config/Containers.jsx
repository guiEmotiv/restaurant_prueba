import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Button from '../../components/common/Button';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const Containers = () => {
  const { showSuccess, showError } = useToast();
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContainers();
  }, []);

  const loadContainers = async () => {
    try {
      setLoading(true);
      console.log('🚀 Starting to load containers...');
      
      // Direct API call without service
      const response = await fetch('/api/v1/containers/', {
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
        console.log('✅ Setting containers as array:', data);
        setContainers(data);
      } else {
        console.log('⚠️ Data is not array, setting empty array');
        setContainers([]);
      }
      
    } catch (error) {
      console.error('❌ Error loading containers:', error);
      showError('Error al cargar los envases');
      setContainers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const name = prompt('Nombre del envase:');
    const price = prompt('Precio:');
    const stock = prompt('Stock:');
    
    if (name && price && stock) {
      try {
        const response = await fetch('/api/v1/containers/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            name, 
            price: parseFloat(price), 
            stock: parseInt(stock) 
          }),
        });
        
        if (response.ok) {
          showSuccess('Envase creado exitosamente');
          await loadContainers();
        } else {
          throw new Error('Error creating container');
        }
      } catch (error) {
        console.error('Error creating container:', error);
        showError('Error al crear el envase');
      }
    }
  };

  console.log('🔍 About to render. Containers:', containers);
  console.log('🔍 Containers length:', containers?.length);
  console.log('🔍 Loading:', loading);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Envases</h1>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Envases</h1>
        <Button onClick={handleCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Envase
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium mb-4">Lista de Envases</h2>
        
        {!containers || containers.length === 0 ? (
          <p className="text-gray-500">No hay envases registrados</p>
        ) : (
          <div className="space-y-2">
            {containers.map((container, index) => (
              <div key={container?.id || index} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <span className="font-medium">ID: {container?.id || 'N/A'}</span>
                  <span className="ml-4">Nombre: {container?.name || 'Sin nombre'}</span>
                  <span className="ml-4">Precio: S/ {container?.price || '0.00'}</span>
                  <span className="ml-4">Stock: {container?.stock || '0'}</span>
                </div>
              </div>
            )) || <p>Error rendering containers</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default Containers;