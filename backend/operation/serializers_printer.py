"""
Serializers para sistema de impresión y cola de trabajos
"""
from rest_framework import serializers
from django.utils import timezone
from .models import PrinterConfig, PrintQueue


class PrinterConfigSerializer(serializers.ModelSerializer):
    """Serializer para configuración de impresoras"""
    
    class Meta:
        model = PrinterConfig
        fields = [
            'id', 'name', 'usb_port', 'device_path', 'is_active',
            'baud_rate', 'paper_width_mm', 'description', 
            'created_at', 'updated_at', 'last_used_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'last_used_at']


class PrintQueueSerializer(serializers.ModelSerializer):
    """Serializer para trabajos en cola de impresión"""
    
    # Campos relacionados para display
    order_item_name = serializers.CharField(source='order_item.recipe.name', read_only=True)
    order_id = serializers.IntegerField(source='order_item.order.id', read_only=True)
    table_number = serializers.CharField(source='order_item.order.table.table_number', read_only=True)
    printer_name = serializers.CharField(source='printer.name', read_only=True)
    printer_usb_port = serializers.CharField(source='printer.usb_port', read_only=True)
    
    # Status display
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    # Campos calculados
    can_retry = serializers.BooleanField(read_only=True)
    time_elapsed = serializers.SerializerMethodField()
    
    class Meta:
        model = PrintQueue
        fields = [
            'id', 'order_item', 'printer', 'content', 'status', 'attempts', 
            'max_attempts', 'error_message', 'created_at', 'started_at', 
            'completed_at', 'rpi_worker_id',
            # Campos relacionados
            'order_item_name', 'order_id', 'table_number', 'printer_name', 
            'printer_usb_port', 'status_display', 'can_retry', 'time_elapsed'
        ]
        read_only_fields = [
            'created_at', 'started_at', 'completed_at', 'attempts',
            'order_item_name', 'order_id', 'table_number', 'printer_name',
            'printer_usb_port', 'status_display', 'can_retry', 'time_elapsed'
        ]
    
    def get_time_elapsed(self, obj):
        """Calcular tiempo transcurrido desde creación"""
        if not obj.created_at:
            return None
        
        elapsed = timezone.now() - obj.created_at
        total_seconds = int(elapsed.total_seconds())
        
        if total_seconds < 60:
            return f"{total_seconds}s"
        elif total_seconds < 3600:
            minutes = total_seconds // 60
            return f"{minutes}m"
        else:
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            return f"{hours}h {minutes}m"


class PrintQueueCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear trabajos de impresión manualmente"""
    
    class Meta:
        model = PrintQueue
        fields = ['order_item', 'printer', 'content']
    
    def create(self, validated_data):
        """Crear trabajo de impresión con contenido auto-generado si no se proporciona"""
        if not validated_data.get('content'):
            order_item = validated_data['order_item']
            validated_data['content'] = order_item._generate_label_content()
        
        return super().create(validated_data)


class PrintQueueStatusUpdateSerializer(serializers.Serializer):
    """Serializer para actualizar estado de trabajos (usado por RPi4 worker)"""
    
    status = serializers.ChoiceField(choices=PrintQueue.PRINT_STATUS_CHOICES)
    error_message = serializers.CharField(required=False, allow_blank=True)
    worker_id = serializers.CharField(required=False, allow_blank=True)
    
    def validate_status(self, value):
        """Validar transiciones de estado permitidas"""
        instance = self.instance
        if not instance:
            return value
            
        # Definir transiciones permitidas
        allowed_transitions = {
            'pending': ['in_progress', 'cancelled'],
            'in_progress': ['printed', 'failed', 'cancelled'],
            'failed': ['pending', 'cancelled'],  # Permitir retry
            'printed': [],  # Estado final
            'cancelled': []  # Estado final
        }
        
        current_status = instance.status
        if value not in allowed_transitions.get(current_status, []):
            raise serializers.ValidationError(
                f"Transición no permitida: {current_status} -> {value}"
            )
        
        return value


class PrintQueueSummarySerializer(serializers.Serializer):
    """Serializer para resumen del estado de la cola"""
    
    total_jobs = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    in_progress_count = serializers.IntegerField()
    printed_count = serializers.IntegerField()
    failed_count = serializers.IntegerField()
    cancelled_count = serializers.IntegerField()
    
    # Por impresora
    by_printer = serializers.DictField()
    
    # Trabajos recientes
    recent_failed = PrintQueueSerializer(many=True, read_only=True)
    recent_completed = PrintQueueSerializer(many=True, read_only=True)