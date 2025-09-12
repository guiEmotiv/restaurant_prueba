#!/usr/bin/env python3
"""
Servidor HTTP para Raspberry Pi 4 - Gestión de Impresoras USB
Especialmente diseñado para etiquetadoras USB
"""

import os
import sys
import time
import json
import logging
import requests
import subprocess
from datetime import datetime
from flask import Flask, request, jsonify
from threading import Thread

# Configuración
app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuración del servidor
PORT = 3001
DJANGO_BASE_URL = "http://192.168.1.0:8000"  # Ajustar según tu red

class USBPrinterManager:
    """Gestor de impresoras USB para RPi4"""
    
    def __init__(self):
        self.active_ports = []
        self.scan_usb_devices()
    
    def scan_usb_devices(self):
        """Escanea y detecta dispositivos USB disponibles"""
        possible_ports = [
            '/dev/usb/lp0', '/dev/usb/lp1', '/dev/usb/lp2',
            '/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyUSB2',
            '/dev/lp0', '/dev/lp1', '/dev/lp2'
        ]
        
        self.active_ports = []
        for port in possible_ports:
            if os.path.exists(port):
                try:
                    # Verificar permisos
                    if os.access(port, os.W_OK):
                        self.active_ports.append(port)
                        logger.info(f"✅ Puerto USB detectado: {port}")
                    else:
                        logger.warning(f"⚠️ Puerto sin permisos de escritura: {port}")
                        # Intentar arreglar permisos
                        try:
                            os.system(f"sudo chmod 666 {port}")
                            if os.access(port, os.W_OK):
                                self.active_ports.append(port)
                                logger.info(f"✅ Permisos corregidos para: {port}")
                        except Exception as e:
                            logger.error(f"❌ No se pudieron corregir permisos para {port}: {e}")
                except Exception as e:
                    logger.error(f"❌ Error verificando {port}: {e}")
        
        logger.info(f"📊 Total puertos USB activos: {len(self.active_ports)}")
        return self.active_ports
    
    def print_to_usb(self, port, content):
        """Envía contenido a impresora USB con comando de corte"""
        try:
            if port not in self.active_ports:
                raise Exception(f"Puerto {port} no está disponible")
            
            # Verificar estado del puerto antes de imprimir
            if not os.path.exists(port):
                raise Exception(f"Puerto {port} desconectado")
            
            # Escribir contenido + comando de corte
            with open(port, 'wb') as printer:
                # Escribir contenido principal
                printer.write(content.encode('utf-8'))
                printer.flush()
                
                # Agregar comando de corte ESC/POS
                cut_command = b'\x1d\x56\x00'  # GS V 0 - Corte completo
                printer.write(cut_command)
                printer.flush()
                
                # Pequeña pausa para que la impresora procese
                time.sleep(0.2)
            
            logger.info(f"✅ Impresión y corte completados en {port}")
            return True, "Impresión y corte completados"
            
        except Exception as e:
            error_msg = f"Error imprimiendo en {port}: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return False, error_msg
    
    
    def test_printer(self, port):
        """Prueba una impresora específica"""
        test_content = f"""
================================
      PRUEBA DE IMPRESORA
================================

Puerto: {port}
Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Servidor: RPi4 USB Print Server

--------------------------------
✅ CONEXIÓN EXITOSA
🖨️ Impresora Funcionando
🍽️ Sistema Restaurant Web
================================

        """
        
        return self.print_to_usb(port, test_content)

# Instancia global del gestor
printer_manager = USBPrinterManager()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check del servidor"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'message': 'RPi4 USB Print Server is running',
        'active_ports': printer_manager.active_ports,
        'total_printers': len(printer_manager.active_ports)
    })

@app.route('/scan', methods=['POST'])
def scan_devices():
    """Escanea dispositivos USB disponibles"""
    ports = printer_manager.scan_usb_devices()
    return jsonify({
        'success': True,
        'active_ports': ports,
        'total_found': len(ports),
        'message': f'Encontrados {len(ports)} puertos USB'
    })

@app.route('/test', methods=['POST'])
def test_printer():
    """Prueba una impresora específica"""
    try:
        data = request.get_json()
        port = data.get('port')
        
        if not port:
            return jsonify({
                'success': False,
                'error': 'Puerto requerido'
            }), 400
        
        logger.info(f"🧪 Probando impresora en {port}")
        
        success, message = printer_manager.test_printer(port)
        
        return jsonify({
            'success': success,
            'message': message,
            'port': port,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"❌ Error en test: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/print', methods=['POST'])
def print_label():
    """Imprime una etiqueta"""
    try:
        data = request.get_json()
        port = data.get('port')
        print_data = data.get('data', {})
        content = print_data.get('label_content', '')
        job_id = print_data.get('job_id')
        callback_url = print_data.get('callback_url')
        
        if not port or not content:
            return jsonify({
                'success': False,
                'error': 'Puerto y contenido requeridos'
            }), 400
        
        logger.info(f"🖨️ Imprimiendo trabajo {job_id} en {port}")
        logger.info(f"📄 Contenido: {content[:100]}...")
        
        success, message = printer_manager.print_to_usb(port, content)
        
        # Enviar callback a Django si se especifica
        if callback_url and job_id:
            Thread(target=send_callback, args=(callback_url, job_id, success, message, port)).start()
        
        return jsonify({
            'success': success,
            'message': message,
            'port': port,
            'job_id': job_id,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"❌ Error en impresión: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def send_callback(callback_url, job_id, success, message, port):
    """Envía callback a Django de forma asíncrona"""
    try:
        callback_data = {
            'job_uuid': job_id,
            'success': success,
            'message': message,
            'error': message if not success else '',
            'printer_port': port,
            'timestamp': datetime.now().isoformat()
        }
        
        logger.info(f"📞 Enviando callback para job {job_id}")
        
        response = requests.post(callback_url, json=callback_data, timeout=10)
        
        if response.status_code == 200:
            logger.info(f"✅ Callback enviado exitosamente para job {job_id}")
        else:
            logger.warning(f"⚠️ Callback falló para job {job_id}: HTTP {response.status_code}")
            
    except Exception as e:
        logger.error(f"❌ Error enviando callback para job {job_id}: {str(e)}")

@app.route('/status', methods=['GET'])
def get_status():
    """Obtiene estado detallado del sistema"""
    return jsonify({
        'server_info': {
            'hostname': os.uname().nodename,
            'system': f"{os.uname().sysname} {os.uname().release}",
            'python_version': sys.version.split()[0],
            'uptime': time.time()
        },
        'usb_devices': {
            'active_ports': printer_manager.active_ports,
            'total_count': len(printer_manager.active_ports)
        },
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    logger.info("🚀 Iniciando RPi4 USB Print Server...")
    logger.info(f"📍 Servidor corriendo en puerto {PORT}")
    logger.info(f"📊 Puertos USB detectados: {len(printer_manager.active_ports)}")
    
    for port in printer_manager.active_ports:
        logger.info(f"  ✅ {port}")
    
    # Correr servidor Flask
    app.run(host='0.0.0.0', port=PORT, debug=False)