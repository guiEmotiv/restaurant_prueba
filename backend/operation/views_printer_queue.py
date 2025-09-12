"""
ViewSets para sistema de cola de impresión
"""
import os
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import models
from django.db.models import Q, Count
from backend.development_permissions import DevelopmentAwarePermission
from .models import PrintQueue, PrinterConfig
from .serializers_printer import (
    PrintQueueSerializer, 
    PrintQueueCreateSerializer,
    PrintQueueStatusUpdateSerializer,
    PrintQueueSummarySerializer
)


class PrintQueueViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de cola de impresión"""
    
    queryset = PrintQueue.objects.select_related(
        'order_item__recipe', 'order_item__order__table', 'printer'
    ).all()
    serializer_class = PrintQueueSerializer
    permission_classes = [DevelopmentAwarePermission]
    
    def get_serializer_class(self):
        """Usar serializer específico según la acción"""
        if self.action == 'create':
            return PrintQueueCreateSerializer
        elif self.action in ['mark_in_progress', 'mark_completed', 'mark_failed']:
            return PrintQueueStatusUpdateSerializer
        return PrintQueueSerializer
    
    def get_queryset(self):
        """Filtrar queryset según parámetros"""
        queryset = super().get_queryset()
        
        # Filtros opcionales
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        printer_id = self.request.query_params.get('printer_id')
        if printer_id:
            queryset = queryset.filter(printer_id=printer_id)
        
        order_id = self.request.query_params.get('order_id')
        if order_id:
            queryset = queryset.filter(order_item__order_id=order_id)
        
        order_item_id = self.request.query_params.get('order_item_id')
        if order_item_id:
            queryset = queryset.filter(order_item_id=order_item_id)
        
        return queryset.order_by('-created_at')
    
    # ====================================
    # ENDPOINTS PARA RASPBERRY PI WORKER
    # ====================================
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Obtener trabajos pendientes para RPi4 worker"""
        pending_jobs = self.get_queryset().filter(
            Q(status='pending') | 
            (Q(status='failed') & Q(attempts__lt=models.F('max_attempts')))
        ).filter(
            printer__is_active=True  # Solo impresoras activas
        )
        
        # Limitar cantidad de trabajos por request
        limit = int(request.query_params.get('limit', 10))
        pending_jobs = pending_jobs[:limit]
        
        serializer = self.get_serializer(pending_jobs, many=True)
        return Response({
            'count': pending_jobs.count(),
            'jobs': serializer.data
        })
    
    @action(detail=False, methods=['get'], permission_classes=[])
    def poll(self, request):
        """Endpoint de polling para RPi4 - obtiene y marca trabajos automáticamente"""
        # Autenticación simple por token (en producción)
        auth_header = request.headers.get('Authorization', '')
        printer_secret = os.getenv('PRINTER_SECRET', 'dev-token')
        expected_token = f"Bearer {printer_secret}"
        
        # Debug temporal
        if request.GET.get('debug') == '1':
            return Response({
                'auth_header_received': auth_header,
                'printer_secret_env': printer_secret,
                'expected_token': expected_token,
                'match': auth_header == expected_token
            })
        
        if not auth_header == expected_token:
            return Response({
                'error': 'Token de autenticación inválido',
                'jobs': []
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Obtener trabajos pendientes para esta instancia RPi4
        pending_jobs = self.get_queryset().filter(
            Q(status='pending') | 
            (Q(status='failed') & Q(attempts__lt=models.F('max_attempts')))
        ).filter(
            printer__is_active=True
        ).select_related('order_item__recipe', 'printer')
        
        # Limitar trabajos por polling
        limit = int(request.query_params.get('limit', 5))
        pending_jobs = pending_jobs[:limit]
        
        jobs_data = []
        for job in pending_jobs:
            # Marcar como in_progress inmediatamente
            worker_id = f"rpi4-poller-{timezone.now().strftime('%Y%m%d-%H%M%S')}"
            job.mark_in_progress(worker_id)
            
            jobs_data.append({
                'id': job.id,
                'content': job.content,
                'printer_port': job.printer.usb_port,
                'printer_name': job.printer.name,
                'recipe_name': job.order_item.recipe.name,
                'order_item_id': job.order_item.id,
                'created_at': job.created_at.isoformat(),
                'attempts': job.attempts,
                'max_attempts': job.max_attempts
            })
        
        return Response({
            'jobs': jobs_data,
            'count': len(jobs_data),
            'timestamp': timezone.now().isoformat(),
            'status': 'success'
        })
    
    @action(detail=True, methods=['post'])
    def mark_in_progress(self, request, pk=None):
        """Marcar trabajo como en progreso (RPi4 worker)"""
        job = self.get_object()
        
        if job.status not in ['pending', 'failed']:
            return Response(
                {'error': f'No se puede marcar como en progreso desde estado {job.status}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        worker_id = request.data.get('worker_id', '')
        job.mark_in_progress(worker_id)
        
        serializer = self.get_serializer(job)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_completed(self, request, pk=None):
        """Marcar trabajo como completado (RPi4 worker)"""
        job = self.get_object()
        
        if job.status != 'in_progress':
            return Response(
                {'error': f'No se puede completar desde estado {job.status}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        job.mark_completed()
        
        # Actualizar timestamp de impresora
        job.printer.last_used_at = timezone.now()
        job.printer.save(update_fields=['last_used_at'])
        
        serializer = self.get_serializer(job)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_failed(self, request, pk=None):
        """Marcar trabajo como fallido (RPi4 worker)"""
        job = self.get_object()
        
        if job.status not in ['in_progress', 'pending']:
            return Response(
                {'error': f'No se puede marcar como fallido desde estado {job.status}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        error_message = request.data.get('error_message', 'Error no especificado')
        job.mark_failed(error_message)
        
        serializer = self.get_serializer(job)
        return Response(serializer.data)
    
    # ====================================
    # ENDPOINTS PARA GESTIÓN MANUAL
    # ====================================
    
    @action(detail=True, methods=['post'])
    def retry_job(self, request, pk=None):
        """Reintentar un trabajo fallido (retry manual - permite reintentar incluso si se agotaron los intentos)"""
        job = self.get_object()
        
        # Para retry manual, solo verificar que esté en estado fallido
        if job.status != 'failed':
            return Response(
                {'error': f'Solo se pueden reintentar trabajos fallidos. Estado actual: {job.status}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Resetear contador de intentos para retry manual
        job.attempts = 0
        
        if job.reset_for_retry():
            # Intentar imprimir inmediatamente después del retry
            try:
                from .http_printer_service import http_printer_service
                print_success = http_printer_service.send_print_job(job)
                
                serializer = self.get_serializer(job)
                
                if print_success:
                    return Response({
                        'message': 'Trabajo reintentado exitosamente',
                        'job': serializer.data,
                        'print_status': 'success'
                    })
                else:
                    return Response({
                        'message': 'Trabajo reintentado pero falló la impresión',
                        'job': serializer.data,
                        'print_status': 'failed'
                    })
                    
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error en retry_job para job {job.id}: {e}")
                
                # Marcar como fallido si hay excepción
                job.mark_failed(f"Error en retry: {str(e)}")
                
                serializer = self.get_serializer(job)
                return Response({
                    'message': 'Error durante el reintento',
                    'job': serializer.data,
                    'error': str(e)
                })
        else:
            return Response(
                {'error': 'No se pudo reestablecer el trabajo'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def cancel_job(self, request, pk=None):
        """Cancelar un trabajo específico"""
        job = self.get_object()
        
        if job.status in ['printed', 'cancelled']:
            return Response(
                {'error': f'No se puede cancelar trabajo en estado {job.status}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        reason = request.data.get('reason', 'Cancelado por usuario')
        job.status = 'cancelled'
        job.error_message = f"Cancelado: {reason}"
        job.save()
        
        serializer = self.get_serializer(job)
        return Response({
            'message': 'Trabajo cancelado exitosamente',
            'job': serializer.data
        })
    
    # ====================================
    # ENDPOINTS DE MONITOREO Y ESTADÍSTICAS
    # ====================================
    
    @action(detail=False, methods=['get'])
    def queue_status(self, request):
        """Obtener estado actual de la cola"""
        # Estadísticas generales
        total_jobs = self.get_queryset().count()
        status_counts = self.get_queryset().aggregate(
            pending_count=Count('id', filter=Q(status='pending')),
            in_progress_count=Count('id', filter=Q(status='in_progress')),
            printed_count=Count('id', filter=Q(status='printed')),
            failed_count=Count('id', filter=Q(status='failed')),
            cancelled_count=Count('id', filter=Q(status='cancelled'))
        )
        
        # Estadísticas por impresora
        by_printer = {}
        for printer in PrinterConfig.objects.filter(is_active=True):
            printer_jobs = self.get_queryset().filter(printer=printer)
            by_printer[printer.name] = {
                'printer_id': printer.id,
                'total': printer_jobs.count(),
                'pending': printer_jobs.filter(status='pending').count(),
                'in_progress': printer_jobs.filter(status='in_progress').count(),
                'failed': printer_jobs.filter(status='failed').count(),
                'last_used': printer.last_used_at.isoformat() if printer.last_used_at else None
            }
        
        # Trabajos recientes fallidos y completados
        recent_failed = self.get_queryset().filter(
            status='failed'
        ).order_by('-created_at')[:5]
        
        recent_completed = self.get_queryset().filter(
            status='printed'
        ).order_by('-completed_at')[:5]
        
        return Response({
            'total_jobs': total_jobs,
            'by_printer': by_printer,
            'recent_failed': PrintQueueSerializer(recent_failed, many=True).data,
            'recent_completed': PrintQueueSerializer(recent_completed, many=True).data,
            **status_counts
        })
    
    @action(detail=False, methods=['get'])
    def failed_jobs(self, request):
        """Obtener trabajos fallidos que pueden reintentarse"""
        failed_jobs = self.get_queryset().filter(
            status='failed',
            attempts__lt=models.F('max_attempts')
        )
        
        serializer = self.get_serializer(failed_jobs, many=True)
        return Response({
            'count': failed_jobs.count(),
            'jobs': serializer.data
        })
    
    @action(detail=False, methods=['post'])
    def retry_all_failed(self, request):
        """Reintentar todos los trabajos fallidos"""
        failed_jobs = self.get_queryset().filter(
            status='failed',
            attempts__lt=models.F('max_attempts')
        )
        
        retried_count = 0
        for job in failed_jobs:
            if job.reset_for_retry():
                retried_count += 1
        
        return Response({
            'message': f'Se reintentarán {retried_count} trabajos fallidos',
            'retried_count': retried_count,
            'total_failed': failed_jobs.count()
        })
    
    @action(detail=False, methods=['delete'])
    def clear_completed(self, request):
        """Limpiar trabajos completados antiguos"""
        # Solo limpiar trabajos completados de más de 24 horas
        cutoff_time = timezone.now() - timezone.timedelta(hours=24)
        
        old_completed = self.get_queryset().filter(
            status='printed',
            completed_at__lt=cutoff_time
        )
        
        deleted_count = old_completed.count()
        old_completed.delete()
        
        return Response({
            'message': f'Se eliminaron {deleted_count} trabajos completados antiguos',
            'deleted_count': deleted_count
        })
    
    @action(detail=False, methods=['post'])
    def process_pending(self, request):
        """Procesar trabajos pendientes (trigger manual para debugging)"""
        limit = int(request.data.get('limit', 5))
        
        pending_jobs = self.get_queryset().filter(
            status='pending',
            printer__is_active=True
        )[:limit]
        
        return Response({
            'message': f'Se encontraron {pending_jobs.count()} trabajos pendientes',
            'pending_count': pending_jobs.count(),
            'jobs': PrintQueueSerializer(pending_jobs, many=True).data
        })
    
    @action(detail=True, methods=['post'])
    def callback(self, request, pk=None):
        """Callback del RPi4 para reportar estado de impresión"""
        job = self.get_object()
        
        try:
            result = request.data
            success = result.get('success', False)
            error_message = result.get('error', '')
            
            if success:
                # Marcar como completado
                job.mark_completed()
                
                # Actualizar timestamp de impresora
                job.printer.last_used_at = timezone.now()
                job.printer.save(update_fields=['last_used_at'])
                
                # Log
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"✅ Callback: Trabajo {job.id} completado exitosamente")
                
                return Response({
                    'status': 'success',
                    'message': 'Trabajo marcado como completado'
                })
            else:
                # Marcar como fallido
                job.mark_failed(error_message or 'Error reportado por RPi4')
                
                # Log
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"❌ Callback: Trabajo {job.id} falló: {error_message}")
                
                return Response({
                    'status': 'failed', 
                    'message': 'Trabajo marcado como fallido',
                    'error': error_message
                })
                
        except Exception as e:
            # Log error
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"💥 Error procesando callback para trabajo {job.id}: {e}")
            
            # Marcar como fallido por error del callback
            job.mark_failed(f'Error en callback: {str(e)}')
            
            return Response({
                'status': 'error',
                'message': 'Error procesando callback',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)