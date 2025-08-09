// Versión ultra-segura sin hooks complejos ni funciones problemáticas
import { useParams, useNavigate } from 'react-router-dom';

const OrderReceiptSafe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // No useEffect, no async, no callbacks - solo render directo
  const handleBack = () => {
    navigate('/payment-history');
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header simple */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          ← Volver
        </button>
        <div>
          <h1 className="text-2xl font-bold">Recibo de Pago</h1>
          <p className="text-gray-600">Orden #{id || '0'}</p>
        </div>
      </div>

      {/* Contenido estático temporal */}
      <div className="bg-white p-6 rounded-lg shadow max-w-md mx-auto">
        <div className="text-center mb-4">
          <h2 className="font-bold">EL FOGÓN DE DON SOTO</h2>
          <p className="text-sm">COMPROBANTE</p>
        </div>
        
        <div className="border-t pt-4">
          <p className="text-sm">Orden: #{id || '0'}</p>
          <p className="text-sm">Mesa: N/A</p>
          <p className="text-sm">Fecha: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="border-t mt-4 pt-4">
          <p className="text-center text-sm text-gray-500">
            Versión temporal - Sin datos dinámicos
          </p>
        </div>
      </div>

      {/* Botones deshabilitados temporalmente */}
      <div className="flex gap-2 justify-center">
        <button
          disabled
          className="px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed"
        >
          Imprimir Bluetooth (Deshabilitado)
        </button>
        <button
          disabled
          className="px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed"
        >
          Probar Impresora (Deshabilitado)
        </button>
      </div>
    </div>
  );
};

export default OrderReceiptSafe;