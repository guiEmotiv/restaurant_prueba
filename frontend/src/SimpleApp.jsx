import { useToast } from './contexts/ToastContext';

function SimpleApp() {
  const { showSuccess } = useToast();
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🍽️ Sistema de Restaurante</h1>
      <div style={{ background: '#f0f9ff', padding: '20px', borderRadius: '8px', margin: '20px 0' }}>
        <h2>✅ Frontend Funcionando Correctamente</h2>
        <ul>
          <li>✅ React 19 cargado</li>
          <li>✅ Vite servidor funcionando</li>
          <li>✅ JavaScript ejecutándose</li>
          <li>✅ CSS aplicado</li>
        </ul>
      </div>
      
      <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '8px', margin: '20px 0' }}>
        <h3>🔧 Próximos pasos:</h3>
        <p>1. Verificar navegación</p>
        <p>2. Cargar componentes completos</p>
        <p>3. Conectar con backend</p>
      </div>
      
      <button 
        onClick={() => showSuccess('¡JavaScript funciona perfectamente!')}
        style={{ 
          background: '#3b82f6', 
          color: 'white', 
          padding: '10px 20px', 
          border: 'none', 
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Probar JavaScript
      </button>
    </div>
  );
}

export default SimpleApp;