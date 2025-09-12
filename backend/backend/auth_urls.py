"""
URL configuration for Django authentication endpoints
"""
from django.urls import path
from . import auth_views

urlpatterns = [
    # Authentication endpoints
    path('auth/login/', auth_views.login_view, name='login'),
    path('auth/logout/', auth_views.logout_view, name='logout'),
    path('auth/status/', auth_views.user_status, name='user_status'),
    path('auth/register/', auth_views.register_view, name='register'),
    path('auth/csrf/', auth_views.csrf_token, name='csrf_token'),
    path('auth/change-password/', auth_views.change_password, name='change_password'),

    # User management (admin only)
    path('auth/users/', auth_views.user_list, name='user_list'),
    path('auth/users/<int:user_id>/', auth_views.user_detail, name='user_detail'),
    path('auth/setup-status/', auth_views.setup_status, name='setup_status'),
]