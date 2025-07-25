from django.contrib.auth.models import AbstractUser
from django.db import models


class RestaurantUser(AbstractUser):
    """Extended User model with restaurant-specific roles"""
    
    ROLE_CHOICES = [
        ('admin', 'Administrador'),
        ('mesero', 'Mesero'),
        ('cajero', 'Cajero'),
        ('cocinero', 'Cocinero'),
    ]
    
    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default='mesero',
        help_text='Rol del usuario en el restaurante'
    )
    
    aws_iam_username = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text='Nombre de usuario en AWS IAM (opcional)'
    )
    
    is_active_session = models.BooleanField(
        default=False,
        help_text='Indica si el usuario tiene una sesión activa'
    )
    
    last_activity = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Última actividad del usuario'
    )
    
    class Meta:
        db_table = 'restaurant_user'
        verbose_name = 'Usuario del Restaurante'
        verbose_name_plural = 'Usuarios del Restaurante'
    
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
    
    @property
    def allowed_views(self):
        """Retorna las vistas permitidas según el rol"""
        view_permissions = {
            'admin': [
                'dashboard', 'categories', 'units', 'zones', 'tables',
                'groups', 'ingredients', 'recipes', 'orders', 'kitchen',
                'payments', 'payment-history'
            ],
            'mesero': ['orders', 'kitchen'],
            'cajero': ['payments', 'payment-history'],
            'cocinero': ['kitchen', 'orders']
        }
        return view_permissions.get(self.role, [])
    
    @property
    def allowed_api_endpoints(self):
        """Retorna los endpoints de API permitidos según el rol"""
        api_permissions = {
            'admin': ['*'],  # Todos los endpoints
            'mesero': [
                'orders', 'order-items', 'order-item-ingredients',
                'recipes', 'ingredients', 'tables'  # Solo lectura para recetas e ingredientes
            ],
            'cajero': [
                'payments', 'orders'  # Solo lectura para órdenes, escritura para pagos
            ],
            'cocinero': [
                'orders', 'order-items', 'recipes', 'ingredients'  # Para gestionar cocina
            ]
        }
        return api_permissions.get(self.role, [])
    
    def can_access_view(self, view_name):
        """Verifica si el usuario puede acceder a una vista específica"""
        return view_name in self.allowed_views
    
    def can_access_api_endpoint(self, endpoint):
        """Verifica si el usuario puede acceder a un endpoint específico"""
        allowed = self.allowed_api_endpoints
        return '*' in allowed or endpoint in allowed