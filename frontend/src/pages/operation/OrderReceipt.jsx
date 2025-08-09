// VERSIÓN ULTRA-MÍNIMA - Sin ninguna dependencia problemática
const OrderReceipt = () => {
  // Funciones básicas sin hooks
  const handleBack = () => {
    window.history.back();
  };

  // Obtener ID de la URL manualmente
  const url = window.location.pathname;
  const id = url.split('/').pop() || '0';

  return (
    <div style={{ padding: '16px', fontFamily: 'system-ui' }}>
      {/* Header con estilos inline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={handleBack}
          style={{
            padding: '8px 16px',
            backgroundColor: '#e5e7eb',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ← Volver
        </button>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0' }}>Recibo de Pago</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>Orden #{id}</p>
        </div>
      </div>

      {/* Contenido con estilos inline */}
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        maxWidth: '400px',
        margin: '0 auto',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0' }}>EL FOGÓN DE DON SOTO</h2>
          <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>COMPROBANTE</p>
        </div>
        
        <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Orden:</span>
            <span>#{id}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Mesa:</span>
            <span>N/A</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Fecha:</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Hora:</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #d1d5db', marginTop: '16px', paddingTop: '16px' }}>
          <div style={{ textAlign: 'center', color: '#6b7280' }}>
            <p>Versión de emergencia - Sin datos dinámicos</p>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #d1d5db', marginTop: '16px', paddingTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>TOTAL:</span>
            <span>S/ 0.00</span>
          </div>
        </div>

        <div style={{ 
          borderTop: '1px solid #d1d5db', 
          marginTop: '16px', 
          paddingTop: '16px',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '12px', margin: '0' }}>¡Gracias por su visita!</p>
        </div>
      </div>

      {/* Mensaje temporal */}
      <div style={{
        backgroundColor: '#fef3c7',
        padding: '16px',
        borderRadius: '6px',
        textAlign: 'center',
        margin: '24px 0'
      }}>
        <p style={{ fontSize: '14px', color: '#92400e', margin: '0' }}>
          ⚠️ Versión temporal de emergencia
        </p>
        <p style={{ fontSize: '12px', color: '#b45309', margin: '4px 0 0 0' }}>
          Funcionalidad completa temporalmente deshabilitada
        </p>
      </div>

      {/* Botón deshabilitado */}
      <div style={{ textAlign: 'center' }}>
        <button
          disabled
          style={{
            padding: '8px 16px',
            backgroundColor: '#d1d5db',
            color: '#6b7280',
            border: 'none',
            borderRadius: '6px',
            cursor: 'not-allowed'
          }}
        >
          Imprimir Bluetooth (Deshabilitado)
        </button>
      </div>
    </div>
  );
};

export default OrderReceipt;