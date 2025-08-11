from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import OrderItem, ContainerSale
import logging

logger = logging.getLogger(__name__)

# TEMPORALMENTE DESACTIVADO PARA DEBUG
# @receiver(post_save, sender=OrderItem)
# @receiver(post_delete, sender=OrderItem)
def update_order_total_on_item_change(sender, instance, **kwargs):
    """
    Recalcular total de orden automáticamente cuando se modifica un OrderItem
    """
    try:
        if instance.order:
            # Usar el método calculate_total mejorado
            instance.order.calculate_total()
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