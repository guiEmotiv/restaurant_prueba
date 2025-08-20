from django.apps import AppConfig


class OperationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'operation'
    
    def ready(self):
        """Configurar signals cuando la app esté lista"""
        try:
            from .sse_views import setup_signals
            setup_signals()
        except ImportError:
            # SSE views no disponible
            pass
