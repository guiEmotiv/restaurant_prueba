"""
Views para gestión de configuración de impresoras
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from django.db import transaction
from django.conf import settings
import os
from .models import PrinterConfig
# ELIMINADO: PrintQueue y servicios HTTP - se usa impresión directa
# from .serializers_printer import (
#     PrinterConfigSerializer, 
#     PrinterConfigCreateSerializer,
#     PrinterTestSerializer
# )
# from .services_http_printer import http_printer_service
import logging

logger = logging.getLogger(__name__)


class PrinterConfigViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de configuraciones de impresoras - SIMPLIFICADO SIN PRINTQUEUE"""
    queryset = PrinterConfig.objects.all().order_by('name')
    
    def get_queryset(self):
        """Filtrar por parámetros de query"""
        queryset = PrinterConfig.objects.all().order_by('name')
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        return queryset
    
    def get_serializer_class(self):
        # ELIMINADO: PrintConfigCreateSerializer y PrinterConfigSerializer - usar serializer básico
        from rest_framework import serializers
        
        class BasicPrinterSerializer(serializers.ModelSerializer):
            class Meta:
                model = PrinterConfig
                fields = '__all__'
        
        return BasicPrinterSerializer
    
    def create(self, request, *args, **kwargs):
        """Crear nueva configuración de impresora - SIMPLIFICADO"""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            with transaction.atomic():
                printer = serializer.save()
                logger.info(f"🖨️ Nueva impresora creada: {printer.name}")
                return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, *args, **kwargs):
        """Actualizar configuración de impresora - SIMPLIFICADO"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        old_port = instance.usb_port
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            updated_printer = serializer.save()
            
            if old_port != updated_printer.usb_port:
                logger.info(f"🖨️ Puerto cambiado en {updated_printer.name}: {old_port} -> {updated_printer.usb_port}")
                # ELIMINADO: test automático - sin servicio HTTP
            
            return Response(serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, *args, **kwargs):
        """Eliminar configuración de impresora"""
        instance = self.get_object()
        
        # ELIMINADO: PrintQueue - ya no hay trabajos pendientes que verificar
        # pending_jobs_count = instance.printqueue_set.filter(status='pending').count()
        # if pending_jobs_count > 0:
        #     return Response({
        #         'error': f'No se puede eliminar la impresora. Tiene {pending_jobs_count} trabajos pendientes.'
        #     }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verificar si hay recetas asignadas
        recipes_count = instance.recipe_set.count()
        if recipes_count > 0:
            return Response({
                'error': f'No se puede eliminar la impresora. Tiene {recipes_count} recetas asignadas.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"🗑️ Eliminando impresora: {instance.name}")
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """ELIMINADO: Test de conexión - sin servicio HTTP"""
        printer = self.get_object()
        logger.info(f"🧪 Test solicitado para: {printer.name} - FUNCIONALIDAD ELIMINADA")
        
        return Response({
            'message': 'Funcionalidad de test eliminada - se usa impresión directa',
            'printer_name': printer.name,
            'status': 'disabled'
        })
    
    @action(detail=False, methods=['post'])
    def test_all(self, request):
        """ELIMINADO: Test masivo - sin servicio HTTP"""
        active_printers = PrinterConfig.objects.filter(is_active=True)
        logger.info(f"🧪 Test masivo solicitado - FUNCIONALIDAD ELIMINADA")
        
        return Response({
            'message': 'Funcionalidad de test masivo eliminada - se usa impresión directa',
            'total_printers': active_printers.count(),
            'status': 'disabled'
        })
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activar una impresora - SIMPLIFICADO"""
        printer = self.get_object()
        printer.is_active = True
        printer.save(update_fields=['is_active'])
        
        logger.info(f"✅ Impresora activada: {printer.name}")
        
        return Response({
            'message': f'Impresora {printer.name} activada',
            'printer_name': printer.name,
            'is_active': True
        })
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Desactivar una impresora - SIMPLIFICADO"""
        printer = self.get_object()
        printer.is_active = False
        printer.save(update_fields=['is_active'])
        
        logger.info(f"⏸️ Impresora desactivada: {printer.name}")
        
        return Response({
            'message': f'Impresora {printer.name} desactivada',
            'printer_name': printer.name,
            'is_active': False
        })
    
    @action(detail=True, methods=['post'])
    def check_usb_connection(self, request, pk=None):
        """ELIMINADO: Verificación USB - sin servicio HTTP"""
        printer = self.get_object()
        logger.info(f"🔍 Verificación USB solicitada para: {printer.name} - FUNCIONALIDAD ELIMINADA")
        
        return Response({
            'message': 'Funcionalidad de verificación USB eliminada - se usa impresión directa',
            'printer_name': printer.name,
            'status': 'disabled'
        })
    
    @action(detail=False, methods=['get'])
    def status_summary(self, request):
        """Obtener resumen del estado de todas las impresoras - SIMPLIFICADO"""
        total_printers = PrinterConfig.objects.count()
        active_printers = PrinterConfig.objects.filter(is_active=True).count()
        inactive_printers = total_printers - active_printers
        
        from django.utils import timezone
        from datetime import timedelta
        
        last_24h = timezone.now() - timedelta(hours=24)
        recently_used = PrinterConfig.objects.filter(
            last_used_at__gte=last_24h
        ).count()
        
        # Usar serializer básico
        serializer = self.get_serializer_class()
        
        return Response({
            'summary': {
                'total_printers': total_printers,
                'active_printers': active_printers,
                'inactive_printers': inactive_printers,
                'recently_used_24h': recently_used
            },
            'printers': serializer(
                PrinterConfig.objects.all().order_by('-last_used_at', 'name'),
                many=True
            ).data
        })