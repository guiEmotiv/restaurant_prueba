"""
Server-Sent Events (SSE) views para actualizaciones en tiempo real
"""
import json
import time
import asyncio
from django.http import StreamingHttpResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.core.cache import cache
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver


class SSEManager:
    """Gestor centralizado de conexiones SSE"""
    
    def __init__(self):
        self.connections = {}  # {user_id: [connection_generators]}
        self.order_updates = {}  # Cache temporal de actualizaciones
    
    def add_connection(self, user_id, generator):
        if user_id not in self.connections:
            self.connections[user_id] = []
        self.connections[user_id].append(generator)
    
    def remove_connection(self, user_id, generator):
        if user_id in self.connections:
            try:
                self.connections[user_id].remove(generator)
                if not self.connections[user_id]:
                    del self.connections[user_id]
            except ValueError:
                pass
    
    def broadcast_update(self, event_type, data, target_users=None):
        """Envía actualizaciones a usuarios específicos o todos"""
        message = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        
        users_to_notify = target_users if target_users else self.connections.keys()
        
        for user_id in users_to_notify:
            if user_id in self.connections:
                # Usar cache para evitar spam de actualizaciones
                cache_key = f"sse_last_update_{user_id}_{event_type}"
                last_update = cache.get(cache_key, 0)
                current_time = time.time()
                
                # Throttle: máximo 1 actualización por segundo por tipo de evento
                if current_time - last_update > 1.0:
                    for connection in self.connections[user_id][:]:  # Copia para evitar modificaciones concurrentes
                        try:
                            connection.send(message)
                        except:
                            # Conexión cerrada, remover
                            self.remove_connection(user_id, connection)
                    
                    cache.set(cache_key, current_time, timeout=60)


# Instancia global del gestor SSE
sse_manager = SSEManager()


@csrf_exempt
@require_http_methods(["GET"])
def order_updates_stream(request):
    """
    Stream SSE para actualizaciones de órdenes en tiempo real
    """
    
    def event_stream(user_id):
        """Generador de eventos SSE simplificado"""
        try:
            # Mensaje inicial de conexión
            yield "event: connected\ndata: {\"status\": \"connected\"}\n\n"
            
            last_heartbeat = time.time()
            
            while True:
                current_time = time.time()
                
                # Enviar heartbeat cada 30 segundos
                if current_time - last_heartbeat > 30:
                    yield f"event: heartbeat\ndata: {{\"timestamp\": {int(current_time)}}}\n\n"
                    last_heartbeat = current_time
                
                # Pausa para evitar uso excesivo de CPU
                time.sleep(1)
                
        except GeneratorExit:
            # Cliente desconectado
            pass
        except Exception as e:
            yield f"event: error\ndata: {{\"error\": \"{str(e)}\"}}\n\n"
    
    # Obtener user_id de los parámetros
    user_id = request.GET.get('user_id', 'anonymous')
    
    # Configurar respuesta SSE
    response = StreamingHttpResponse(
        event_stream(user_id),
        content_type='text/event-stream'
    )
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    response['Connection'] = 'keep-alive'
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Headers'] = 'Cache-Control'
    response['X-Accel-Buffering'] = 'no'  # Nginx: desactivar buffering
    
    return response


@csrf_exempt
@require_http_methods(["GET"])
def kitchen_updates_stream(request):
    """
    Stream SSE específico para la vista de cocina con datos en tiempo real
    """
    
    def get_kitchen_board_data():
        """Query optimizada para kitchen board"""
        from .models import OrderItem
        
        cache_key = 'kitchen_board_sse_data'
        data = cache.get(cache_key)
        
        if not data:
            # Query optimizada con prefetch y select_related
            order_items = OrderItem.objects.filter(
                status__in=['CREATED', 'PREPARING'],
                order__status='CREATED'
            ).select_related(
                'recipe__group', 
                'order__table__zone'
            ).values(
                'id', 'status', 'created_at', 'preparing_at', 'notes',
                'recipe__name', 'recipe__preparation_time', 
                'recipe__group__name', 'recipe__group__id',
                'order__id', 'order__table__table_number', 
                'order__table__zone__name', 'order__waiter', 
                'is_takeaway'
            ).order_by('created_at')[:100]  # Limitar a 100 items
            
            # Formatear datos para frontend
            data = []
            for item in order_items:
                data.append({
                    'id': item['id'],
                    'status': item['status'],
                    'created_at': item['created_at'].isoformat(),
                    'preparing_at': item['preparing_at'].isoformat() if item['preparing_at'] else None,
                    'notes': item['notes'] or '',
                    'recipe_name': item['recipe__name'],
                    'recipe_preparation_time': item['recipe__preparation_time'],
                    'recipe_group_name': item['recipe__group__name'] or 'Sin Grupo',
                    'recipe_group_id': item['recipe__group__id'],
                    'order_id': item['order__id'],
                    'order_table': item['order__table__table_number'],
                    'order_zone': item['order__table__zone__name'],
                    'waiter_name': item['order__waiter'] or 'Sin mesero',
                    'is_takeaway': item['is_takeaway']
                })
            
            # Cache por 10 segundos
            cache.set(cache_key, data, 10)
            
        return data
    
    def kitchen_event_stream():
        """Generador de eventos SSE para kitchen con datos"""
        try:
            # Enviar datos iniciales
            initial_data = get_kitchen_board_data()
            yield f"event: kitchen_data\ndata: {json.dumps(initial_data)}\n\n"
            
            last_data_check = time.time()
            last_heartbeat = time.time()
            
            while True:
                current_time = time.time()
                
                # Comprobar datos cada 2 segundos
                if current_time - last_data_check >= 2:
                    kitchen_data = get_kitchen_board_data()
                    yield f"event: kitchen_data\ndata: {json.dumps(kitchen_data)}\n\n"
                    last_data_check = current_time
                
                # Heartbeat cada 30 segundos
                if current_time - last_heartbeat > 30:
                    yield f"event: heartbeat\ndata: {{\"timestamp\": {int(current_time)}}}\n\n"
                    last_heartbeat = current_time
                
                time.sleep(1)
                
        except GeneratorExit:
            # Cliente desconectado
            pass
        except Exception as e:
            yield f"event: error\ndata: {{\"error\": \"{str(e)}\"}}\n\n"
    
    response = StreamingHttpResponse(
        kitchen_event_stream(),
        content_type='text/event-stream'
    )
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    response['Connection'] = 'keep-alive'
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Headers'] = 'Cache-Control'
    response['X-Accel-Buffering'] = 'no'  # Nginx: desactivar buffering
    
    return response


# Signals para detectar cambios automáticamente
def setup_signals():
    """Configurar signals después de que Django esté listo"""
    from .models import OrderItem, Order
    
    @receiver(post_save, sender=OrderItem)
    def orderitem_updated(sender, instance, created, **kwargs):
        """Signal que se ejecuta cuando se actualiza un OrderItem"""
        
        import logging
        logger = logging.getLogger(__name__)
        
        # Invalidar cache de kitchen board
        cache.delete('kitchen_board_sse_data')
        cache.delete('kitchen_board_data')
        cache.delete('kitchen_view_orders')
        
        # AUTO-IMPRESIÓN HABILITADA: Los items se imprimen automáticamente cuando se crean
        if created and instance.status == 'CREATED':
            try:
                # Usar transaction.on_commit para asegurar que PrintQueue job esté disponible
                from django.db import transaction
                
                def print_item():
                    try:
                        # El trabajo de impresión ya fue creado por el método save() del OrderItem
                        # Solo necesitamos enviarlo al RPi4
                        from .http_printer_service import http_printer_service
                        
                        # Obtener el último trabajo creado para este OrderItem
                        print_job = instance.print_jobs.filter(status='pending').last()
                        if print_job:
                            http_printer_service.send_print_job(print_job)
                        else:
                            logger.warning(f"No se encontró trabajo de impresión pendiente para OrderItem {instance.id}")
                            
                    except Exception as e:
                        logger.error(f"Error en impresión automática para OrderItem {instance.id}: {e}")
                
                # Ejecutar después de que la transacción se confirme
                transaction.on_commit(print_item)
                
            except Exception as e:
                logger.error(f"Error iniciando impresión automática para OrderItem {instance.id}: {e}")
        
        # Datos del evento
        event_data = {
            'type': 'order_item_updated',
            'item_id': instance.id,
            'order_id': instance.order.id,
            'table_id': instance.order.table.id if instance.order.table else None,
            'status': instance.status,
            'recipe_name': instance.recipe.name if instance.recipe else None,
            'created': created,
            'timestamp': int(time.time())
        }
        
        # Broadcast a todas las conexiones activas
        sse_manager.broadcast_update('order_item_update', event_data)

    @receiver(post_save, sender=Order)
    def order_updated(sender, instance, created, **kwargs):
        """Signal que se ejecuta cuando se actualiza una Order"""
        
        # Invalidar cache de kitchen board
        cache.delete('kitchen_board_sse_data')
        cache.delete('kitchen_board_data')
        cache.delete('kitchen_view_orders')
        
        event_data = {
            'type': 'order_updated',
            'order_id': instance.id,
            'table_id': instance.table.id if instance.table else None,
            'status': instance.status,
            'created': created,
            'timestamp': int(time.time())
        }
        
        # Broadcast a todas las conexiones
        sse_manager.broadcast_update('order_update', event_data)

    @receiver(post_delete, sender=OrderItem)
    def orderitem_deleted(sender, instance, **kwargs):
        """Signal que se ejecuta cuando se elimina un OrderItem"""
        
        event_data = {
            'type': 'order_item_deleted',
            'item_id': instance.id,
            'order_id': instance.order.id,
            'table_id': instance.order.table.id if instance.order.table else None,
            'timestamp': int(time.time())
        }
        
        sse_manager.broadcast_update('order_item_delete', event_data)

    @receiver(post_delete, sender=Order)
    def order_deleted(sender, instance, **kwargs):
        """Signal que se ejecuta cuando se elimina una Order"""
        
        event_data = {
            'type': 'order_deleted',
            'order_id': instance.id,
            'table_id': instance.table.id if instance.table else None,
            'timestamp': int(time.time())
        }
        
        sse_manager.broadcast_update('order_delete', event_data)


# Configurar signals al importar el módulo
try:
    from django.apps import apps
    if apps.ready:
        setup_signals()
except:
    # Django aún no está listo, configurar en apps.py
    pass