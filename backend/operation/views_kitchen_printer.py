"""
Vista para manejo de impresión de etiquetas en cocina
Proxy para comunicación TCP con etiquetadora ESC/POS
"""

import socket
import json
import logging
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.conf import settings

logger = logging.getLogger(__name__)


class KitchenPrinterViewSet(viewsets.ViewSet):
    """
    ViewSet para manejo de impresión de etiquetas en cocina
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def print_label(self, request):
        """
        Endpoint para imprimir etiquetas via proxy TCP
        Recibe datos ESC/POS y los envía a la etiquetadora
        """
        try:
            # Obtener datos del request
            printer_ip = request.data.get('printer_ip', '192.168.1.23')
            printer_port = request.data.get('printer_port', 9100)
            label_data = request.data.get('label_data', [])
            
            if not label_data:
                return Response({
                    'error': 'No se proporcionaron datos de etiqueta',
                    'success': False
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Convertir array de bytes a bytes
            if isinstance(label_data, list):
                label_bytes = bytes(label_data)
            elif isinstance(label_data, str):
                label_bytes = label_data.encode('utf-8')
            else:
                label_bytes = label_data
            
            # Enviar a impresora via TCP
            result = self._send_to_printer(printer_ip, printer_port, label_bytes)
            
            if result['success']:
                logger.info(f"✅ Etiqueta enviada exitosamente a {printer_ip}:{printer_port}")
                return Response({
                    'success': True,
                    'message': 'Etiqueta impresa correctamente',
                    'bytes_sent': result['bytes_sent'],
                    'printer_ip': printer_ip,
                    'printer_port': printer_port
                })
            else:
                logger.error(f"❌ Error enviando etiqueta a {printer_ip}:{printer_port}: {result['error']}")
                return Response({
                    'success': False,
                    'error': result['error'],
                    'printer_ip': printer_ip,
                    'printer_port': printer_port
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            logger.error(f"❌ Error general en print_label: {str(e)}")
            return Response({
                'success': False,
                'error': f'Error interno: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _send_to_printer(self, printer_ip, printer_port, label_bytes):
        """
        Enviar datos ESC/POS a la impresora via TCP
        """
        sock = None
        try:
            # Crear socket TCP
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(10)  # Timeout de 10 segundos
            
            # Conectar a la impresora
            logger.info(f"🔗 Conectando a etiquetadora {printer_ip}:{printer_port}")
            sock.connect((printer_ip, printer_port))
            
            # Enviar datos ESC/POS
            bytes_sent = sock.send(label_bytes)
            logger.info(f"📤 Enviados {bytes_sent} bytes a la etiquetadora")
            
            # Pequeña pausa para asegurar que la impresora procese los datos
            import time
            time.sleep(0.5)
            
            return {
                'success': True,
                'bytes_sent': bytes_sent
            }
            
        except socket.timeout:
            return {
                'success': False,
                'error': 'Timeout conectando a la impresora'
            }
        except socket.gaierror as e:
            return {
                'success': False,
                'error': f'Error de resolución DNS: {str(e)}'
            }
        except ConnectionRefusedError:
            return {
                'success': False,
                'error': 'Conexión rechazada por la impresora'
            }
        except OSError as e:
            return {
                'success': False,
                'error': f'Error de red: {str(e)}'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Error inesperado: {str(e)}'
            }
        finally:
            if sock:
                try:
                    sock.close()
                except:
                    pass

    @action(detail=False, methods=['post'])
    def test_printer(self, request):
        """
        Endpoint para probar conectividad con la etiquetadora
        """
        try:
            printer_ip = request.data.get('printer_ip', '192.168.1.23')
            printer_port = request.data.get('printer_port', 9100)
            
            # Generar etiqueta de prueba
            test_label = self._generate_test_label()
            test_bytes = test_label.encode('latin-1', errors='ignore')
            
            # Enviar etiqueta de prueba
            result = self._send_to_printer(printer_ip, printer_port, test_bytes)
            
            if result['success']:
                return Response({
                    'success': True,
                    'message': 'Impresora respondió correctamente',
                    'printer_ip': printer_ip,
                    'printer_port': printer_port,
                    'bytes_sent': result['bytes_sent']
                })
            else:
                return Response({
                    'success': False,
                    'error': result['error'],
                    'printer_ip': printer_ip,
                    'printer_port': printer_port
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            logger.error(f"❌ Error en test_printer: {str(e)}")
            return Response({
                'success': False,
                'error': f'Error interno: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _generate_test_label(self):
        """
        Generar etiqueta de prueba ESC/POS
        """
        from datetime import datetime
        
        # Comandos ESC/POS
        ESC = '\x1B'
        GS = '\x1D'
        INIT = '\x1B@'
        BOLD_ON = '\x1B\x45\x01'
        BOLD_OFF = '\x1B\x45\x00'
        CENTER = '\x1B\x61\x01'
        LEFT = '\x1B\x61\x00'
        CUT_PAPER = '\x1D\x56\x42\x00'
        LINE_FEED = '\x0A'
        FONT_SIZE_DOUBLE_HEIGHT = '\x1D\x21\x10'
        FONT_SIZE_NORMAL = '\x1D\x21\x00'
        
        now = datetime.now()
        time_str = now.strftime('%H:%M:%S')
        date_str = now.strftime('%d/%m/%Y')
        
        label = ''
        label += INIT
        label += CENTER
        label += BOLD_ON
        label += FONT_SIZE_DOUBLE_HEIGHT
        label += 'TEST ETIQUETADORA'
        label += LINE_FEED
        label += BOLD_OFF
        label += FONT_SIZE_NORMAL
        label += 'Sistema de Cocina'
        label += LINE_FEED
        label += LEFT
        label += f'{time_str}    {date_str}'
        label += LINE_FEED
        label += LINE_FEED
        label += 'Prueba de conectividad'
        label += LINE_FEED
        label += 'exitosa!'
        label += LINE_FEED
        label += LINE_FEED
        label += CUT_PAPER
        
        return label

    @action(detail=False, methods=['get'])
    def printer_status(self, request):
        """
        Verificar estado de conectividad con la etiquetadora
        """
        try:
            printer_ip = request.query_params.get('printer_ip', '192.168.1.23')
            printer_port = int(request.query_params.get('printer_port', 9100))
            
            # Intentar conexión rápida sin enviar datos
            sock = None
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(3)  # Timeout corto para verificación
                sock.connect((printer_ip, printer_port))
                
                return Response({
                    'success': True,
                    'status': 'online',
                    'message': 'Etiquetadora accesible',
                    'printer_ip': printer_ip,
                    'printer_port': printer_port
                })
                
            except (socket.timeout, ConnectionRefusedError, OSError):
                return Response({
                    'success': False,
                    'status': 'offline',
                    'message': 'Etiquetadora no accesible',
                    'printer_ip': printer_ip,
                    'printer_port': printer_port
                })
            finally:
                if sock:
                    try:
                        sock.close()
                    except:
                        pass
                        
        except Exception as e:
            logger.error(f"❌ Error en printer_status: {str(e)}")
            return Response({
                'success': False,
                'status': 'error',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)