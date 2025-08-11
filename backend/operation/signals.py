from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import OrderItem, ContainerSale
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=OrderItem)
@receiver(post_delete, sender=OrderItem)
def update_order_total_on_item_change(sender, instance, **kwargs):
    """
    Recalcular total de orden automáticamente cuando se modifica un OrderItem
    """
    try:
        if instance.order:
            # Forzar recálculo directo en DB
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE operation_order 
                    SET total_amount = (
                        SELECT COALESCE(SUM(total_price), 0)
                        FROM operation_orderitem
                        WHERE order_id = %s
                    )
                    WHERE id = %s
                """, [instance.order.id, instance.order.id])
            
            logger.info(f"✅ Total recalculado para orden {instance.order.id}")
    except Exception as e:
        logger.error(f"❌ Error recalculando total: {e}")

@receiver(post_save, sender=ContainerSale)
@receiver(post_delete, sender=ContainerSale)
def update_order_on_container_change(sender, instance, **kwargs):
    """
    Notificar cambio cuando se modifica ContainerSale
    """
    try:
        if instance.order:
            # Solo logging, el total de containers es separado
            logger.info(f"Container modificado para orden {instance.order.id}")
    except Exception as e:
        logger.error(f"Error en signal de container: {e}")