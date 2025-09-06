import { useState } from 'react';
import printerSimple from '../../services/bluetoothKitchenPrinterSimple';
import { useToast } from '../../contexts/ToastContext';

const PrinterDiagnostic = () => {
  const { showToast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [deviceInfo, setDeviceInfo] = useState(null);

  // Agregar log a la consola visual
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    setLogs(prev => [...prev, { timestamp, message, type }]);
    console.log(`[${timestamp}] ${message}`);
  };

  // Conectar impresora
  const handleConnect = async () => {
    try {
      addLog('🔌 Iniciando conexión...', 'info');
      await printerSimple.connect();
      setIsConnected(true);
      
      if (printerSimple.device) {
        const info = {
          name: printerSimple.device.name || 'Sin nombre',
          id: printerSimple.device.id,
          service: printerSimple.service?.uuid || 'N/A',
          characteristic: printerSimple.characteristic?.uuid || 'N/A'
        };
        setDeviceInfo(info);
        addLog(`✅ Conectado a: ${info.name}`, 'success');
        addLog(`📍 Service UUID: ${info.service}`, 'info');
        addLog(`📍 Char UUID: ${info.characteristic}`, 'info');
      }
      
      showToast('✅ Impresora conectada', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      showToast(`❌ Error: ${error.message}`, 'error');
    }
  };

  // Desconectar
  const handleDisconnect = () => {
    printerSimple.disconnect();
    setIsConnected(false);
    setDeviceInfo(null);
    addLog('🔌 Desconectado', 'info');
    showToast('Impresora desconectada', 'info');
  };

  // Test 1: ASCII Puro
  const testAscii = async () => {
    try {
      addLog('🧪 Test ASCII puro...', 'info');
      await printerSimple.testPureAscii();
      addLog('✅ ASCII enviado', 'success');
      showToast('Test ASCII completado', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Test 2: ESC/POS Mínimo
  const testMinimal = async () => {
    try {
      addLog('🧪 Test ESC/POS mínimo...', 'info');
      await printerSimple.testMinimalEscPos();
      addLog('✅ ESC/POS enviado', 'success');
      showToast('Test ESC/POS completado', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Test 3: Térmica
  const testThermal = async () => {
    try {
      addLog('🧪 Test térmico básico...', 'info');
      await printerSimple.testThermalBasic();
      addLog('✅ Configuración térmica enviada', 'success');
      showToast('Test térmico completado', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Test 4: Densidad
  const testDensity = async () => {
    try {
      addLog('🧪 Test patrón densidad...', 'info');
      await printerSimple.testDensityPattern();
      addLog('✅ Patrón de densidad enviado', 'success');
      showToast('Test densidad completado', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Test 5: Hardware
  const testHardware = async () => {
    try {
      addLog('🧪 Test hardware self-test...', 'info');
      await printerSimple.testHardwareSelfTest();
      addLog('✅ Comando self-test enviado', 'success');
      showToast('Test hardware completado', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Ejecutar todos los tests
  const runAllTests = async () => {
    try {
      addLog('🚀 Iniciando batería completa de tests...', 'info');
      await printerSimple.runAllTests();
      addLog('✨ Batería de tests completada', 'success');
      showToast('Todos los tests completados', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Diagnóstico profundo de hardware
  const deepHardwareDiag = async () => {
    try {
      addLog('🔍 Iniciando diagnóstico profundo de hardware...', 'info');
      showToast('🔍 Diagnosticando hardware...', 'info');
      const results = await printerSimple.deepHardwareDiagnostic();
      results.forEach(result => {
        if (result.status === 'enviado') {
          addLog(`✅ ${result.test}: comando enviado`, 'success');
        } else {
          addLog(`❌ ${result.test}: ${result.error}`, 'error');
        }
      });
      addLog('🔍 Diagnóstico profundo completado - revisa la impresora', 'success');
      showToast('Diagnóstico completado - revisa papel impreso', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Reset de fábrica y reconfiguración
  const factoryReset = async () => {
    const confirmed = confirm(
      '⚠️ ATENCIÓN: Esto hará un reset de fábrica completo de la impresora.\n' +
      'Se perderán todas las configuraciones personalizadas.\n' +
      '¿Estás seguro de continuar?'
    );
    
    if (!confirmed) return;

    try {
      addLog('⚠️ Iniciando reset de fábrica y reconfiguración...', 'info');
      showToast('⚠️ Reseteando impresora...', 'info');
      await printerSimple.factoryResetAndReconfigure();
      addLog('✅ Reset de fábrica y reconfiguración completados', 'success');
      showToast('✅ Impresora reconfigurada - prueba imprimir', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Verificar configuración térmica
  const verifyThermal = async () => {
    try {
      addLog('🌡️ Verificando configuración térmica...', 'info');
      showToast('🌡️ Verificando configuración térmica...', 'info');
      await printerSimple.verifyThermalConfig();
      addLog('✅ Verificación térmica completada - revisa papel', 'success');
      showToast('Verificación completada', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Test progresivo térmico
  const progressiveThermal = async () => {
    try {
      addLog('📈 Iniciando test progresivo térmico...', 'info');
      showToast('📈 Test térmico progresivo...', 'info');
      await printerSimple.progressiveThermalTest();
      addLog('✅ Test progresivo completado - revisa densidades en papel', 'success');
      showToast('Test progresivo completado', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Test para identificar qué comando funciona
  const testWhatWorks = async () => {
    try {
      addLog('🔍 Identificando comandos que generan líneas...', 'info');
      showToast('🔍 Probando comandos individuales...', 'info');
      await printerSimple.testWhatWorksStep();
      addLog('🔍 Test completado - revisa qué salió impreso', 'success');
      showToast('✅ Revisa la impresora - algunos comandos deberían haber impreso líneas', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Test personalizado
  const sendCustomCommand = async () => {
    const input = prompt('Ingresa comandos hexadecimales separados por espacio (ej: 1B 40 0A):');
    if (!input) return;

    try {
      const bytes = input.split(' ').map(hex => parseInt(hex, 16));
      addLog(`📤 Enviando: [${bytes.join(', ')}]`, 'info');
      await printerSimple.sendData(bytes);
      addLog('✅ Comando personalizado enviado', 'success');
      showToast('Comando enviado', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Limpiar logs
  const clearLogs = () => {
    setLogs([]);
    addLog('📋 Logs limpiados', 'info');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔧 Diagnóstico de Impresora Bluetooth</h1>
        
        {/* Estado de conexión */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h2 className="text-xl font-semibold mb-4">Estado de Conexión</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
            {!isConnected ? (
              <button
                onClick={handleConnect}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                🔌 Conectar
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                ❌ Desconectar
              </button>
            )}
          </div>
          
          {deviceInfo && (
            <div className="bg-gray-100 p-3 rounded text-sm font-mono">
              <div>📱 Dispositivo: {deviceInfo.name}</div>
              <div>🆔 ID: {deviceInfo.id}</div>
              <div>📡 Service: {deviceInfo.service}</div>
              <div>✏️ Characteristic: {deviceInfo.characteristic}</div>
            </div>
          )}
        </div>

        {/* Panel de Tests Básicos */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h2 className="text-xl font-semibold mb-4">Tests Básicos</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <button
              onClick={testAscii}
              disabled={!isConnected}
              className="px-4 py-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              🔤 Test ASCII Puro
            </button>
            
            <button
              onClick={testMinimal}
              disabled={!isConnected}
              className="px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              📄 ESC/POS Mínimo
            </button>
            
            <button
              onClick={testThermal}
              disabled={!isConnected}
              className="px-4 py-3 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              🔥 Térmica Básica
            </button>
            
            <button
              onClick={testDensity}
              disabled={!isConnected}
              className="px-4 py-3 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              ▓ Patrón Densidad
            </button>
            
            <button
              onClick={testHardware}
              disabled={!isConnected}
              className="px-4 py-3 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              🔧 Hardware Test
            </button>
            
            <button
              onClick={runAllTests}
              disabled={!isConnected}
              className="px-4 py-3 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              🚀 Todos los Tests
            </button>
          </div>

          {/* Test especial para identificar comandos */}
          <div className="mt-4 pt-4 border-t bg-yellow-50 p-3 rounded">
            <h3 className="font-medium mb-2 text-yellow-800">🔍 Diagnóstico Específico</h3>
            <button
              onClick={testWhatWorks}
              disabled={!isConnected}
              className="px-4 py-3 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              🔍 ¿Qué Comandos Funcionan?
              <div className="text-xs opacity-90">Prueba 8 comandos individuales</div>
            </button>
          </div>
        </div>

        {/* Panel de Diagnóstico Avanzado */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-red-600">🔍 Diagnóstico Profundo de Hardware</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={deepHardwareDiag}
              disabled={!isConnected}
              className="px-4 py-3 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              🔍 Diagnóstico Profundo
              <div className="text-xs opacity-90">Estado, firmware, memoria</div>
            </button>
            
            <button
              onClick={verifyThermal}
              disabled={!isConnected}
              className="px-4 py-3 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              🌡️ Verificar Config Térmica
              <div className="text-xs opacity-90">Leer configuración actual</div>
            </button>
            
            <button
              onClick={progressiveThermal}
              disabled={!isConnected}
              className="px-4 py-3 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              📈 Test Térmico Progresivo
              <div className="text-xs opacity-90">Diferentes densidades</div>
            </button>
            
            <button
              onClick={factoryReset}
              disabled={!isConnected}
              className="px-4 py-3 bg-red-700 text-white rounded hover:bg-red-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              ⚠️ Reset de Fábrica
              <div className="text-xs opacity-90">¡Elimina configuración!</div>
            </button>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={sendCustomCommand}
              disabled={!isConnected}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              ⚙️ Comando Personalizado
            </button>
          </div>
        </div>

        {/* Consola de Logs */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">📋 Consola de Logs</h2>
            <button
              onClick={clearLogs}
              className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
            >
              Limpiar
            </button>
          </div>
          
          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">Sin logs aún...</div>
            ) : (
              logs.map((log, index) => (
                <div 
                  key={index} 
                  className={`mb-1 ${
                    log.type === 'error' ? 'text-red-400' : 
                    log.type === 'success' ? 'text-green-400' : 
                    'text-gray-300'
                  }`}
                >
                  [{log.timestamp}] {log.message}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instrucciones */}
        <div className="bg-blue-50 rounded-lg p-4 mt-6">
          <h3 className="font-semibold mb-2">📖 Instrucciones de Diagnóstico:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Conecta la impresora con el botón "Conectar"</li>
            <li>Prueba primero "Test ASCII Puro" - debería imprimir texto simple</li>
            <li>Si funciona, prueba "ESC/POS Mínimo" para comandos básicos</li>
            <li>Prueba "Térmica Básica" para configurar el calor</li>
            <li>Si nada imprime, verifica que el papel sea térmico</li>
            <li>El "Hardware Test" debería imprimir información del dispositivo</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default PrinterDiagnostic;