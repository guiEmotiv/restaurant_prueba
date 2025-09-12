#!/usr/bin/env python3
"""
PHASE 4: RPi4 Print Queue Worker - Sistema de polling
Worker que se ejecuta en Raspberry Pi para procesar cola de impresión
Reemplaza el sistema de HTTP directo con polling cada 30 segundos
"""

import time
import logging
import requests
import json
from typing import List, Dict, Optional, Any

# Imports condicionales para desarrollo
try:
    import usb.core
    import usb.util
    USB_AVAILABLE = True
except ImportError:
    print("⚠️  USB library no disponible. Modo de simulación activado.")
    USB_AVAILABLE = False

# Configuración
API_BASE_URL = "http://localhost:8000/api/v1"  # URL del backend Django en desarrollo
POLLING_INTERVAL = 30  # Segundos entre checks de cola
USB_VENDOR_ID = 0x04b8  # Epson (cambiar según tu impresora)
USB_PRODUCT_ID = 0x0202  # Modelo específico
MAX_RETRIES = 3
RETRY_DELAY = 5  # Segundos entre reintentos

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('print_worker.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PrinterError(Exception):
    """Excepción personalizada para errores de impresora"""
    pass

class PrintQueueWorker:
    """Worker para procesar cola de impresión con polling"""
    
    def __init__(self):
        self.api_token = None
        self.printer_device = None
        self.running = False
        
    def authenticate(self, username: str = "admin", password: str = "admin123") -> bool:
        """Autenticar con el backend para obtener token de API"""
        try:
            # En modo desarrollo, no se requiere autenticación
            logger.info("Modo desarrollo: Sin autenticación requerida")
            self.api_token = None
            return True
                
        except Exception as e:
            logger.error(f"Error en autenticación: {e}")
            return False
    
    def get_auth_headers(self) -> Dict[str, str]:
        """Headers con autenticación para requests"""
        if self.api_token:
            return {"Authorization": f"Bearer {self.api_token}"}
        return {}
    
    def find_printer(self) -> bool:
        """Buscar y conectar a impresora USB"""
        try:
            if not USB_AVAILABLE:
                logger.info("Modo simulación: Impresora virtual conectada")
                self.printer_device = "virtual_printer"
                return True
            
            # Buscar impresora por Vendor/Product ID
            self.printer_device = usb.core.find(
                idVendor=USB_VENDOR_ID,
                idProduct=USB_PRODUCT_ID
            )
            
            if self.printer_device is None:
                # Buscar cualquier impresora térmica común
                for vid, pid in [(0x04b8, 0x0202), (0x0416, 0x5011), (0x154f, 0x154f)]:
                    device = usb.core.find(idVendor=vid, idProduct=pid)
                    if device:
                        self.printer_device = device
                        logger.info(f"Impresora encontrada: VID={hex(vid)}, PID={hex(pid)}")
                        break
            
            if self.printer_device:
                try:
                    # Intentar reclamar interfaz
                    if self.printer_device.is_kernel_driver_active(0):
                        self.printer_device.detach_kernel_driver(0)
                    usb.util.claim_interface(self.printer_device, 0)
                    logger.info("Impresora USB conectada exitosamente")
                    return True
                except usb.core.USBError as e:
                    logger.warning(f"Error configurando impresora: {e}")
                    return False
            else:
                logger.error("No se encontró impresora USB")
                return False
                
        except Exception as e:
            logger.error(f"Error buscando impresora: {e}")
            return False
    
    def send_to_printer(self, data: bytes) -> bool:
        """Enviar datos ESC/POS a la impresora"""
        if not self.printer_device:
            logger.error("Impresora no disponible")
            return False
        
        try:
            if self.printer_device == "virtual_printer":
                # Modo simulación
                logger.info(f"Modo simulación: Imprimiendo {len(data)} bytes")
                time.sleep(1)  # Simular tiempo de impresión
                logger.info("Impresión simulada exitosa")
                return True
            
            # Impresora real
            endpoint = self.printer_device[0][(0,0)][1]
            endpoint.write(data, timeout=5000)
            
            # Verificar que se envió correctamente
            time.sleep(0.5)  # Esperar procesamiento
            logger.info("Datos enviados a impresora exitosamente")
            return True
            
        except Exception as e:
            if USB_AVAILABLE:
                logger.error(f"Error enviando a impresora: {e}")
            else:
                logger.error(f"Error inesperado en impresión: {e}")
            return False
    
    def get_pending_jobs(self) -> List[Dict[str, Any]]:
        """Obtener trabajos pendientes de la cola"""
        try:
            response = requests.get(
                f"{API_BASE_URL}/print-queue/pending/",
                headers=self.get_auth_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                jobs = data.get('jobs', [])  # Extraer la lista de jobs del response
                logger.info(f"Obtenidos {len(jobs)} trabajos pendientes")
                return jobs
            else:
                logger.warning(f"Error obteniendo trabajos: {response.status_code}")
                return []
                
        except requests.RequestException as e:
            logger.error(f"Error conectando al backend: {e}")
            return []
    
    def update_job_status(self, job_id: int, status: str, error_message: str = None) -> bool:
        """Actualizar estado de un trabajo en la cola usando endpoints específicos"""
        try:
            # Mapear status a endpoints específicos
            endpoint_map = {
                'in_progress': 'mark_in_progress',
                'printed': 'mark_completed',
                'failed': 'mark_failed'
            }
            
            if status not in endpoint_map:
                logger.error(f"Status {status} no soportado. Usar: {list(endpoint_map.keys())}")
                return False
            
            endpoint = endpoint_map[status]
            data = {}
            
            if status == 'in_progress':
                data['worker_id'] = 'rpi4_worker'
            elif status == 'failed' and error_message:
                data['error_message'] = error_message
            
            response = requests.post(
                f"{API_BASE_URL}/print-queue/{job_id}/{endpoint}/",
                json=data,
                headers=self.get_auth_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info(f"Job {job_id} actualizado a estado: {status}")
                return True
            else:
                logger.error(f"Error actualizando job {job_id}: {response.status_code}")
                return False
                
        except requests.RequestException as e:
            logger.error(f"Error actualizando job: {e}")
            return False
    
    def process_job(self, job: Dict[str, Any]) -> bool:
        """Procesar un trabajo individual de impresión"""
        job_id = job['id']
        logger.info(f"Procesando job {job_id}: {job['order_item_name']}")
        
        # Marcar como en progreso
        if not self.update_job_status(job_id, 'in_progress'):
            return False
        
        try:
            # Construir comando ESC/POS básico
            escpos_data = self.build_escpos_command(job)
            
            # Intentar imprimir con reintentos
            for attempt in range(MAX_RETRIES):
                if self.send_to_printer(escpos_data):
                    # Éxito - marcar como impreso
                    self.update_job_status(job_id, 'printed')
                    logger.info(f"Job {job_id} impreso exitosamente")
                    return True
                else:
                    logger.warning(f"Intento {attempt + 1} fallido para job {job_id}")
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(RETRY_DELAY)
            
            # Todos los intentos fallaron
            self.update_job_status(
                job_id, 
                'failed', 
                f"Error imprimiendo después de {MAX_RETRIES} intentos"
            )
            return False
            
        except Exception as e:
            logger.error(f"Error procesando job {job_id}: {e}")
            self.update_job_status(job_id, 'failed', str(e))
            return False
    
    def build_escpos_command(self, job: Dict[str, Any]) -> bytes:
        """Construir comando ESC/POS para el trabajo"""
        
        # Comandos ESC/POS básicos
        ESC = b'\x1b'
        INIT = ESC + b'@'           # Inicializar
        BOLD_ON = ESC + b'E\x01'    # Negrita ON
        BOLD_OFF = ESC + b'E\x00'   # Negrita OFF  
        CENTER = ESC + b'a\x01'     # Centrar
        LEFT = ESC + b'a\x00'       # Izquierda
        CUT = ESC + b'd\x03'        # Cortar papel
        LF = b'\n'
        
        # Construir ticket
        data = INIT
        
        # Encabezado
        data += CENTER + BOLD_ON
        data += b'COCINA - PEDIDO\n'
        data += BOLD_OFF + b'================\n'
        
        # Información del pedido
        data += LEFT
        data += f"Mesa: {job.get('order_table', 'N/A')}\n".encode('utf-8')
        data += f"Pedido: #{job.get('order_id', 'N/A')}\n".encode('utf-8')
        data += f"Cliente: {job.get('order_customer', 'Cliente')}\n".encode('utf-8')
        data += LF
        
        # Item principal
        data += BOLD_ON
        data += f"{job.get('quantity', 1)}x {job.get('order_item_name', 'Item')}\n".encode('utf-8')
        data += BOLD_OFF
        
        # Ingredientes si existen
        ingredients = job.get('ingredients_text', '')
        if ingredients:
            data += f"Ingredientes:\n{ingredients}\n".encode('utf-8')
        
        # Notas si existen  
        notes = job.get('notes', '')
        if notes:
            data += f"Notas: {notes}\n".encode('utf-8')
        
        # Pie
        data += LF
        data += CENTER
        data += f"Hora: {job.get('created_at', '')}\n".encode('utf-8')
        data += b'================\n'
        data += LF + LF + LF
        data += CUT
        
        return data
    
    def run(self):
        """Bucle principal del worker"""
        logger.info("Iniciando Print Queue Worker...")
        
        # Autenticación inicial
        if not self.authenticate():
            logger.error("No se pudo autenticar. Saliendo.")
            return
        
        # Buscar impresora
        if not self.find_printer():
            logger.error("No se encontró impresora. Continuando sin impresión física.")
        
        self.running = True
        logger.info(f"Worker iniciado. Polling cada {POLLING_INTERVAL} segundos.")
        
        try:
            while self.running:
                # Obtener trabajos pendientes
                jobs = self.get_pending_jobs()
                
                # Procesar cada trabajo
                for job in jobs:
                    if not self.running:
                        break
                    self.process_job(job)
                
                # Esperar antes del siguiente polling
                if self.running:
                    logger.debug(f"Esperando {POLLING_INTERVAL} segundos...")
                    time.sleep(POLLING_INTERVAL)
                    
        except KeyboardInterrupt:
            logger.info("Deteniendo worker...")
            self.running = False
        except Exception as e:
            logger.error(f"Error crítico en worker: {e}")
        finally:
            if self.printer_device:
                try:
                    usb.util.release_interface(self.printer_device, 0)
                    logger.info("Impresora desconectada")
                except:
                    pass
            logger.info("Worker detenido")

def main():
    """Punto de entrada principal"""
    worker = PrintQueueWorker()
    worker.run()

if __name__ == "__main__":
    main()