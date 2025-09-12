#!/usr/bin/env python3
"""
Worker de Polling HTTPS para Sistema de Impresión RPi4
Reemplaza el sistema HTTP Push con HTTPS Polling seguro y compatible con firewalls

Uso:
    python rpi4_https_polling_worker.py

Variables de entorno necesarias:
    DJANGO_BACKEND_URL=https://xn--elfogndedonsoto-zrb.com
    PRINTER_SECRET=tu-token-super-secreto-2024
"""

import os
import sys
import time
import json
import logging
import requests
import signal
from datetime import datetime, timedelta
from typing import Dict, List, Optional

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pi/print_polling_worker.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class HttpsPollingWorker:
    """Worker que consulta Django backend via HTTPS y procesa trabajos de impresión"""
    
    def __init__(self):
        # Configuración desde variables de entorno
        self.django_url = os.getenv('DJANGO_BACKEND_URL', 'http://localhost:8000')
        self.printer_secret = os.getenv('PRINTER_SECRET', 'dev-token')
        self.polling_interval = int(os.getenv('POLLING_INTERVAL', '5'))  # segundos
        self.max_jobs_per_poll = int(os.getenv('MAX_JOBS_PER_POLL', '5'))
        self.request_timeout = int(os.getenv('REQUEST_TIMEOUT', '30'))
        
        # URLs del API
        self.poll_url = f"{self.django_url}/api/v1/print-queue/poll/"
        self.complete_url = f"{self.django_url}/api/v1/print-queue/{{}}/mark_completed/"
        self.failed_url = f"{self.django_url}/api/v1/print-queue/{{}}/mark_failed/"
        
        # Headers de autenticación
        self.headers = {
            'Authorization': f'Bearer {self.printer_secret}',
            'Content-Type': 'application/json',
            'User-Agent': 'RPi4-PrintWorker/1.0'
        }
        
        # Control del worker
        self.running = True
        self.stats = {
            'started_at': datetime.now(),
            'total_polls': 0,
            'total_jobs_processed': 0,
            'total_jobs_completed': 0,
            'total_jobs_failed': 0,
            'last_poll_at': None,
            'last_job_at': None,
            'consecutive_errors': 0
        }
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        logger.info("🖨️ HTTPS Polling Worker inicializado")
        logger.info(f"📡 Backend URL: {self.django_url}")
        logger.info(f"⏰ Intervalo de polling: {self.polling_interval}s")
    
    def _signal_handler(self, signum, frame):
        """Manejo de señales para shutdown graceful"""
        logger.info(f"📡 Señal {signum} recibida - cerrando worker...")
        self.running = False
    
    def _print_stats(self):
        """Imprime estadísticas del worker"""
        uptime = datetime.now() - self.stats['started_at']
        
        logger.info("📊 ESTADÍSTICAS DEL WORKER")
        logger.info(f"   ⏳ Uptime: {uptime}")
        logger.info(f"   📞 Total polls: {self.stats['total_polls']}")
        logger.info(f"   📄 Jobs procesados: {self.stats['total_jobs_processed']}")
        logger.info(f"   ✅ Jobs completados: {self.stats['total_jobs_completed']}")
        logger.info(f"   ❌ Jobs fallidos: {self.stats['total_jobs_failed']}")
        if self.stats['last_poll_at']:
            logger.info(f"   🕐 Último poll: {self.stats['last_poll_at'].strftime('%H:%M:%S')}")
        if self.stats['last_job_at']:
            logger.info(f"   🖨️ Último trabajo: {self.stats['last_job_at'].strftime('%H:%M:%S')}")
    
    def poll_for_jobs(self) -> List[Dict]:
        """Consulta Django por trabajos pendientes"""
        try:
            response = requests.get(
                self.poll_url,
                headers=self.headers,
                timeout=self.request_timeout,
                params={'limit': self.max_jobs_per_poll}
            )
            
            self.stats['total_polls'] += 1
            self.stats['last_poll_at'] = datetime.now()
            self.stats['consecutive_errors'] = 0  # Reset error counter
            
            if response.status_code == 200:
                data = response.json()
                jobs = data.get('jobs', [])
                
                if jobs:
                    logger.info(f"📥 Recibidos {len(jobs)} trabajos de impresión")
                    self.stats['last_job_at'] = datetime.now()
                
                return jobs
                
            elif response.status_code == 401:
                logger.error("🔒 Error de autenticación - verificar PRINTER_SECRET")
                return []
                
            else:
                logger.warning(f"⚠️ Respuesta inesperada del servidor: {response.status_code}")
                return []
                
        except requests.exceptions.Timeout:
            logger.warning(f"⏱️ Timeout conectando a {self.django_url}")
            self.stats['consecutive_errors'] += 1
            return []
            
        except requests.exceptions.ConnectionError:
            logger.warning(f"🔌 Error de conexión a {self.django_url}")
            self.stats['consecutive_errors'] += 1
            return []
            
        except Exception as e:
            logger.error(f"💥 Error inesperado en polling: {e}")
            self.stats['consecutive_errors'] += 1
            return []
    
    def process_print_job(self, job_data: Dict) -> bool:
        """Procesa un trabajo de impresión individual"""
        job_id = job_data.get('id')
        printer_port = job_data.get('printer_port')
        content = job_data.get('content', '')
        recipe_name = job_data.get('recipe_name', 'N/A')
        
        logger.info(f"🖨️ Procesando job #{job_id}: {recipe_name} → {printer_port}")
        
        try:
            # Verificar que el puerto USB existe
            if not os.path.exists(printer_port):
                error_msg = f"Puerto de impresora no encontrado: {printer_port}"
                logger.error(f"❌ {error_msg}")
                self._mark_job_failed(job_id, error_msg)
                return False
            
            # Escribir contenido ESC/POS al puerto USB
            with open(printer_port, 'wb') as printer:
                printer.write(content.encode('utf-8'))
                printer.flush()
            
            logger.info(f"✅ Job #{job_id} enviado a impresora exitosamente")
            
            # Marcar como completado en Django
            self._mark_job_completed(job_id)
            self.stats['total_jobs_completed'] += 1
            
            return True
            
        except PermissionError:
            error_msg = f"Sin permisos para escribir a {printer_port}"
            logger.error(f"🔒 {error_msg}")
            self._mark_job_failed(job_id, error_msg)
            return False
            
        except Exception as e:
            error_msg = f"Error imprimiendo: {str(e)}"
            logger.error(f"💥 {error_msg}")
            self._mark_job_failed(job_id, error_msg)
            return False
    
    def _mark_job_completed(self, job_id: int):
        """Marca trabajo como completado en Django"""
        try:
            url = self.complete_url.format(job_id)
            response = requests.post(
                url,
                headers=self.headers,
                timeout=self.request_timeout,
                json={}
            )
            
            if response.status_code == 200:
                logger.debug(f"✅ Job #{job_id} marcado como completado en Django")
            else:
                logger.warning(f"⚠️ Error marcando job #{job_id} como completado: {response.status_code}")
                
        except Exception as e:
            logger.error(f"💥 Error notificando completado para job #{job_id}: {e}")
    
    def _mark_job_failed(self, job_id: int, error_message: str):
        """Marca trabajo como fallido en Django"""
        try:
            url = self.failed_url.format(job_id)
            response = requests.post(
                url,
                headers=self.headers,
                timeout=self.request_timeout,
                json={'error_message': error_message}
            )
            
            if response.status_code == 200:
                logger.debug(f"❌ Job #{job_id} marcado como fallido en Django")
            else:
                logger.warning(f"⚠️ Error marcando job #{job_id} como fallido: {response.status_code}")
                
        except Exception as e:
            logger.error(f"💥 Error notificando falla para job #{job_id}: {e}")
            
        self.stats['total_jobs_failed'] += 1
    
    def _should_backoff(self) -> bool:
        """Determina si debe hacer backoff por errores consecutivos"""
        if self.stats['consecutive_errors'] >= 5:
            backoff_time = min(60, self.stats['consecutive_errors'] * 10)  # Max 60s
            logger.warning(f"⚠️ {self.stats['consecutive_errors']} errores consecutivos - esperando {backoff_time}s")
            time.sleep(backoff_time)
            return True
        return False
    
    def run(self):
        """Loop principal del worker"""
        logger.info("🚀 Iniciando HTTPS Polling Worker...")
        
        # Estadísticas cada 5 minutos
        last_stats = datetime.now()
        stats_interval = timedelta(minutes=5)
        
        while self.running:
            try:
                # Imprimir estadísticas periódicamente
                if datetime.now() - last_stats > stats_interval:
                    self._print_stats()
                    last_stats = datetime.now()
                
                # Backoff si hay muchos errores
                if self._should_backoff():
                    continue
                
                # Poll por trabajos
                jobs = self.poll_for_jobs()
                
                # Procesar cada trabajo
                for job_data in jobs:
                    if not self.running:  # Check si debemos parar
                        break
                        
                    self.process_print_job(job_data)
                    self.stats['total_jobs_processed'] += 1
                
                # Esperar antes del siguiente poll
                time.sleep(self.polling_interval)
                
            except KeyboardInterrupt:
                logger.info("🔴 Interrupción por teclado - cerrando...")
                break
                
            except Exception as e:
                logger.error(f"💥 Error inesperado en loop principal: {e}")
                time.sleep(self.polling_interval * 2)  # Esperar más tiempo si hay error
        
        # Imprimir estadísticas finales
        logger.info("📊 ESTADÍSTICAS FINALES:")
        self._print_stats()
        logger.info("👋 Worker terminado")

def main():
    """Función principal"""
    print("🖨️ HTTPS Polling Worker para Sistema de Impresión")
    print("=" * 50)
    
    # Verificar variables de entorno
    required_vars = ['DJANGO_BACKEND_URL', 'PRINTER_SECRET']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"❌ Variables de entorno faltantes: {', '.join(missing_vars)}")
        print("\nConfigurar en ~/.bashrc o archivo .env:")
        print("export DJANGO_BACKEND_URL=https://tu-dominio.com")
        print("export PRINTER_SECRET=tu-token-secreto")
        sys.exit(1)
    
    # Crear y ejecutar worker
    worker = HttpsPollingWorker()
    
    try:
        worker.run()
    except Exception as e:
        logger.error(f"💥 Error fatal: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()