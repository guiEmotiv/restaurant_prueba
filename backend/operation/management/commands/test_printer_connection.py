"""
Management command para probar la conexión con el sistema de impresión RPi4
"""
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from operation.http_printer_service import HttpPrinterService
from operation.models import PrinterConfig
import requests
import os
import sys


class Command(BaseCommand):
    help = 'Prueba la conexión con el sistema de impresión RPi4'

    def add_arguments(self, parser):
        parser.add_argument(
            '--full-test',
            action='store_true',
            help='Ejecuta un test completo incluyendo impresión real'
        )
        parser.add_argument(
            '--printer-id',
            type=int,
            help='ID de impresora específica a probar'
        )

    def handle(self, *args, **options):
        """Ejecuta las pruebas de conexión"""
        
        self.stdout.write(
            self.style.SUCCESS('🔧 INICIANDO PRUEBAS DE SISTEMA DE IMPRESIÓN')
        )
        self.stdout.write('=' * 60)

        # 1. Verificar variables de entorno
        self._test_environment_variables()
        
        # 2. Verificar conectividad básica RPi4
        service = HttpPrinterService()
        self._test_rpi4_connectivity(service)
        
        # 3. Verificar impresoras configuradas
        self._test_printer_configs()
        
        # 4. Test de health check
        self._test_health_check(service)
        
        # 5. Test completo si se solicita
        if options['full_test']:
            self._test_full_print_functionality(service, options.get('printer_id'))
        
        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS('✅ PRUEBAS COMPLETADAS')
        )

    def _test_environment_variables(self):
        """Verifica las variables de entorno necesarias"""
        self.stdout.write('\n📋 1. VERIFICANDO VARIABLES DE ENTORNO')
        self.stdout.write('-' * 40)
        
        rpi_host = os.getenv('RPI4_HTTP_HOST')
        rpi_port = os.getenv('RPI4_HTTP_PORT', '3001')
        
        if rpi_host:
            self.stdout.write(f'  ✅ RPI4_HTTP_HOST: {rpi_host}')
        else:
            self.stdout.write(
                self.style.WARNING('  ⚠️  RPI4_HTTP_HOST no configurado (usando default)')
            )
        
        self.stdout.write(f'  ✅ RPI4_HTTP_PORT: {rpi_port}')
        
        # URL completa
        url = f"http://{rpi_host or '192.168.1.44'}:{rpi_port}"
        self.stdout.write(f'  🔗 URL RPi4: {url}')

    def _test_rpi4_connectivity(self, service):
        """Prueba conectividad básica con RPi4"""
        self.stdout.write('\n🌐 2. VERIFICANDO CONECTIVIDAD CON RPI4')
        self.stdout.write('-' * 40)
        
        try:
            # Test básico de conectividad
            response = requests.get(f"{service.rpi_url}/status", timeout=10)
            
            if response.status_code == 200:
                self.stdout.write('  ✅ RPi4 responde correctamente')
                
                data = response.json()
                self.stdout.write(f"  📡 Hostname: {data.get('server_info', {}).get('hostname', 'N/A')}")
                self.stdout.write(f"  🐍 Python: {data.get('server_info', {}).get('python_version', 'N/A')}")
                self.stdout.write(f"  🖨️  Impresoras detectadas: {data.get('usb_devices', {}).get('total_count', 0)}")
                
            else:
                self.stdout.write(
                    self.style.ERROR(f'  ❌ RPi4 responde con código {response.status_code}')
                )
                
        except requests.exceptions.ConnectTimeout:
            self.stdout.write(
                self.style.ERROR('  ❌ Timeout conectando con RPi4 - verificar IP y puerto')
            )
        except requests.exceptions.ConnectionError:
            self.stdout.write(
                self.style.ERROR('  ❌ No se puede conectar con RPi4 - verificar que esté corriendo')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'  ❌ Error inesperado: {e}')
            )

    def _test_printer_configs(self):
        """Verifica configuraciones de impresoras en Django"""
        self.stdout.write('\n🖨️ 3. VERIFICANDO CONFIGURACIONES DE IMPRESORAS')
        self.stdout.write('-' * 50)
        
        printers = PrinterConfig.objects.all()
        
        if not printers.exists():
            self.stdout.write(
                self.style.WARNING('  ⚠️  No hay impresoras configuradas en Django')
            )
            return
        
        for printer in printers:
            status_icon = '✅' if printer.is_active else '❌'
            self.stdout.write(f'  {status_icon} {printer.name}')
            self.stdout.write(f'      Puerto: {printer.usb_port}')
            self.stdout.write(f'      Activa: {printer.is_active}')
            if printer.last_used_at:
                self.stdout.write(f'      Último uso: {printer.last_used_at}')
            self.stdout.write('')

    def _test_health_check(self, service):
        """Prueba el health check del RPi4"""
        self.stdout.write('\n❤️  4. VERIFICANDO HEALTH CHECK')
        self.stdout.write('-' * 35)
        
        try:
            response = requests.get(f"{service.rpi_url}/health", timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                self.stdout.write('  ✅ Health check exitoso')
                self.stdout.write(f"  📊 Estado: {data.get('status')}")
                self.stdout.write(f"  🖨️  Impresoras activas: {len(data.get('active_ports', []))}")
                
                for port in data.get('active_ports', []):
                    self.stdout.write(f"      • {port}")
            else:
                self.stdout.write(
                    self.style.ERROR(f'  ❌ Health check falló: {response.status_code}')
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'  ❌ Error en health check: {e}')
            )

    def _test_full_print_functionality(self, service, printer_id):
        """Prueba completa incluyendo impresión real"""
        self.stdout.write('\n🧪 5. TEST COMPLETO DE IMPRESIÓN')
        self.stdout.write('-' * 35)
        
        # Buscar impresora para probar
        if printer_id:
            try:
                printer = PrinterConfig.objects.get(id=printer_id, is_active=True)
            except PrinterConfig.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'  ❌ Impresora con ID {printer_id} no encontrada o inactiva')
                )
                return
        else:
            printer = PrinterConfig.objects.filter(is_active=True).first()
            if not printer:
                self.stdout.write(
                    self.style.ERROR('  ❌ No hay impresoras activas configuradas')
                )
                return
        
        self.stdout.write(f'  🎯 Probando impresora: {printer.name}')
        self.stdout.write(f'  📍 Puerto: {printer.usb_port}')
        
        # Crear contenido de prueba
        test_content = self._generate_test_content()
        
        try:
            # Enviar prueba de impresión
            payload = {
                'port': printer.usb_port,
                'data': {
                    'label_content': test_content,
                    'test': True,
                    'timestamp': timezone.now().isoformat()
                }
            }
            
            response = requests.post(
                f"{service.rpi_url}/print",
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    self.stdout.write('  ✅ Impresión de prueba exitosa')
                    self.stdout.write('  📄 Se debería haber impreso un ticket de prueba')
                else:
                    self.stdout.write(
                        self.style.ERROR(f'  ❌ Impresión falló: {result.get("error", "Error desconocido")}')
                    )
            else:
                self.stdout.write(
                    self.style.ERROR(f'  ❌ Error HTTP: {response.status_code}')
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'  ❌ Error durante impresión: {e}')
            )

    def _generate_test_content(self):
        """Genera contenido ESC/POS para prueba"""
        from datetime import datetime
        
        # Comandos ESC/POS básicos
        large_text = "\x1B\x21\x30"
        normal_text = "\x1B\x21\x00"
        center_on = "\x1B\x61\x01"
        center_off = "\x1B\x61\x00"
        
        content = f"""
{center_on}{large_text}PRUEBA SISTEMA{normal_text}{center_off}

{center_on}🧪 TEST DE CONEXION{center_off}
{center_on}Django -> RPi4{center_off}

Fecha: {datetime.now().strftime('%Y-%m-%d')}
Hora: {datetime.now().strftime('%H:%M:%S')}

{center_on}✅ Sistema Funcional{center_off}



"""
        return content