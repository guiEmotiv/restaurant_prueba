"""
DEPRECATED: Servicio HTTP Push - Reemplazado por HTTPS Polling
Este servicio ya no se usa en producción - mantenido para testing local
"""
import requests
import os
import logging
from django.utils import timezone
from .models import PrintQueue

logger = logging.getLogger(__name__)

class HttpPrinterService:
    """DEPRECATED: Servicio HTTP Push - Solo para desarrollo local"""
    
    def __init__(self):
        # NOTA: Este servicio es solo para desarrollo local
        # En producción se usa HTTPS Polling (ver polling_worker.py)
        self.rpi_host = os.getenv('RPI4_HTTP_HOST', '192.168.1.44')
        self.rpi_port = os.getenv('RPI4_HTTP_PORT', '3001')
        self.rpi_url = f"http://{self.rpi_host}:{self.rpi_port}"
        self.timeout = 10  # 10 segundos timeout
    
    def send_print_job(self, print_job):
        """Enviar trabajo de impresión al RPi4"""
        try:
            # Marcar trabajo como en progreso
            print_job.mark_in_progress(worker_id=f"django-{timezone.now().strftime('%Y%m%d-%H%M%S')}")
            
            # Preparar payload para RPi4
            payload = {
                'action': 'print',
                'port': print_job.printer.usb_port,
                'data': {
                    'label_content': print_job.content,
                    'job_id': print_job.id,
                    'printer_id': print_job.printer.id,
                    'printer_name': print_job.printer.name,
                    'order_item_id': print_job.order_item.id,
                    'recipe_name': print_job.order_item.recipe.name,
                    'timestamp': timezone.now().isoformat(),
                }
            }
            
            logger.info(f"🖨️ Enviando trabajo de impresión {print_job.id} al RPi4: {print_job.order_item.recipe.name}")
            
            # Enviar request HTTP al RPi4
            response = requests.post(
                f"{self.rpi_url}/print",
                json=payload,
                timeout=self.timeout,
                headers={'Content-Type': 'application/json'}
            )
            
            # Procesar respuesta
            if response.status_code == 200:
                result = response.json()
                if result.get('success', False):
                    logger.info(f"✅ Trabajo {print_job.id} completado exitosamente en RPi4")
                    # RPi4 responde sincrónicamente, marcar como completado inmediatamente
                    print_job.mark_completed()
                    return True
                else:
                    error_msg = result.get('error', 'Error desconocido del RPi4')
                    logger.error(f"❌ RPi4 reportó error para trabajo {print_job.id}: {error_msg}")
                    print_job.mark_failed(error_msg)
                    return False
            else:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                logger.error(f"❌ Error HTTP enviando trabajo {print_job.id}: {error_msg}")
                print_job.mark_failed(error_msg)
                return False
                
        except requests.exceptions.Timeout:
            error_msg = f"Timeout comunicando con RPi4 en {self.rpi_url}"
            logger.error(f"⏱️ {error_msg}")
            print_job.mark_failed(error_msg)
            return False
            
        except requests.exceptions.ConnectionError:
            error_msg = f"No se puede conectar al RPi4 en {self.rpi_url}"
            logger.error(f"🔌 {error_msg}")
            print_job.mark_failed(error_msg)
            return False
            
        except Exception as e:
            error_msg = f"Error inesperado enviando al RPi4: {str(e)}"
            logger.error(f"💥 {error_msg}")
            print_job.mark_failed(error_msg)
            return False
    
    def retry_failed_job(self, job_id):
        """Reintentar un trabajo fallido"""
        try:
            print_job = PrintQueue.objects.get(id=job_id)
            
            if not print_job.can_retry():
                logger.warning(f"⚠️ Trabajo {job_id} no puede reintentarse (intentos: {print_job.attempts}/{print_job.max_attempts})")
                return False
            
            # Resetear para reintento
            print_job.reset_for_retry()
            
            # Enviar nuevamente
            return self.send_print_job(print_job)
            
        except PrintQueue.DoesNotExist:
            logger.error(f"❌ Trabajo de impresión {job_id} no encontrado")
            return False
        except Exception as e:
            logger.error(f"💥 Error reintentando trabajo {job_id}: {e}")
            return False
    
    def get_rpi_status(self):
        """Verificar estado del RPi4"""
        try:
            response = requests.get(f"{self.rpi_url}/status", timeout=5)
            if response.status_code == 200:
                return response.json()
            else:
                return {'status': 'error', 'message': f'HTTP {response.status_code}'}
        except Exception as e:
            return {'status': 'error', 'message': str(e)}

# Instancia singleton del servicio
http_printer_service = HttpPrinterService()