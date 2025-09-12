#!/bin/bash
# Script de prueba para verificar que todo funciona
# Ejecutar después de la configuración del RPi4

echo "🧪 PRUEBA COMPLETA DEL SISTEMA DE IMPRESIÓN"
echo "=========================================="

# Test 1: Verificar conectividad básica
echo ""
echo "📡 1. Probando conectividad con RPi4..."
curl -s http://raspberrypi.local:3001/health | python3 -m json.tool || echo "❌ No se puede conectar al RPi4"

# Test 2: Verificar endpoints específicos
echo ""
echo "🔍 2. Probando endpoints del servidor..."
echo "   - Health check:"
curl -s -o /dev/null -w "     Status: %{http_code}\n" http://raspberrypi.local:3001/health

echo "   - Status:"
curl -s -o /dev/null -w "     Status: %{http_code}\n" http://raspberrypi.local:3001/status

# Test 3: Escanear dispositivos USB
echo ""
echo "🔌 3. Escaneando dispositivos USB..."
curl -s -X POST http://raspberrypi.local:3001/scan \
  -H "Content-Type: application/json" | python3 -m json.tool || echo "❌ Error en scan"

# Test 4: Probar conectividad de Django con RPi4
echo ""
echo "🐍 4. Probando conexión Django -> RPi4..."
python3 << 'EOF'
import requests
import json

try:
    # Test básico de conectividad
    response = requests.get('http://192.168.1.44:3001/health', timeout=5)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Django -> RPi4 conectividad OK")
        print(f"   Puertos USB activos: {data.get('total_printers', 0)}")
        if data.get('active_ports'):
            for port in data['active_ports']:
                print(f"   📍 {port}")
    else:
        print(f"❌ Error HTTP: {response.status_code}")
        
except requests.exceptions.ConnectionError:
    print("❌ No se puede conectar desde Django al RPi4")
    print("   Verificar IP del RPi4 en .env: RPI4_HTTP_HOST")
    
except Exception as e:
    print(f"❌ Error: {e}")
EOF

echo ""
echo "📋 INSTRUCCIONES PARA PRUEBA COMPLETA:"
echo "======================================"
echo ""
echo "1. 🖨️ Conectar etiquetadora USB al RPi4"
echo ""
echo "2. 🔧 En el RPi4, ejecutar:"
echo "   ssh gsz@raspberrypi.local"
echo "   sudo systemctl start restaurant-printer.service"
echo "   sudo systemctl status restaurant-printer.service"
echo ""
echo "3. 🌐 Verificar en el navegador:"
echo "   http://localhost:5173/printer-management"
echo ""
echo "4. ➕ Agregar impresora con puerto detectado"
echo ""
echo "5. 🧪 Hacer test de impresión desde la interfaz"
echo ""
echo "6. 🍽️ Asignar impresora a una receta"
echo ""
echo "7. 📝 Crear orden con esa receta y verificar impresión automática"
echo ""
echo "==============================================="
echo "🎯 Si todos los pasos funcionan, el sistema está listo!"
echo "==============================================="