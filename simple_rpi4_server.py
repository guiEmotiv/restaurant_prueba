#!/usr/bin/env python3
"""
Servidor RPi4 Simple para desarrollo - Sin dependencias
Simula impresora para testing de print jobs
"""

import json
import random
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse
import logging

# Configuración
PORT = 3001
SIMULATE_FAILURES = True  # True para simular fallos ocasionales

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RPi4Handler(BaseHTTPRequestHandler):
    
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'ok',
                'message': 'RPi4 Simple Server Running'
            }).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/print':
            self._handle_print_request()
        else:
            self.send_response(404)
            self.end_headers()
    
    def _handle_print_request(self):
        """Process print request"""
        try:
            # Leer datos del request
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            print_data = json.loads(post_data.decode('utf-8'))
            
            job_id = print_data.get('job_id', 'unknown')
            content = print_data.get('content', '')
            
            logger.info(f"📄 Procesando print job {job_id}")
            logger.info(f"📝 Contenido: {content[:50]}...")
            
            # Simular procesamiento
            import time
            time.sleep(0.5)  # Simular tiempo de impresión
            
            # Simular fallos ocasionales si está habilitado
            if SIMULATE_FAILURES and random.random() < 0.3:  # 30% probabilidad de fallo
                logger.error(f"❌ Simulando fallo para job {job_id}")
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': 'Simulated printer error - no USB connection',
                    'job_id': job_id
                }).encode())
                return
            
            # Simulación exitosa
            logger.info(f"✅ Print job {job_id} procesado exitosamente")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'message': 'Print job completed successfully',
                'job_id': job_id
            }).encode())
            
        except Exception as e:
            logger.error(f"💥 Error procesando print request: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': False,
                'error': f'Server error: {str(e)}'
            }).encode())
    
    def log_message(self, format, *args):
        """Customize log format"""
        logger.info(f"🌐 {format % args}")

def main():
    """Start simple RPi4 server"""
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, RPi4Handler)
    
    print(f"🚀 Simple RPi4 Server iniciado en puerto {PORT}")
    print(f"🔗 Health check: http://localhost:{PORT}/health")
    print(f"🖨️  Print endpoint: http://localhost:{PORT}/print")
    print(f"⚠️  Simulación de fallos: {'HABILITADA' if SIMULATE_FAILURES else 'DESHABILITADA'}")
    print("🛑 Presiona Ctrl+C para detener")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Deteniendo servidor...")
        httpd.shutdown()
        print("✅ Servidor detenido")

if __name__ == '__main__':
    main()