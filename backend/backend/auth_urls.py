"""
URL configuration for Django authentication endpoints
"""
from django.urls import path
from . import auth_views

urlpatterns = [
    # Authentication endpoints
    path('login/', auth_views.login_view, name='login'),
    path('logout/', auth_views.logout_view, name='logout'),
    path('status/', auth_views.user_status, name='user_status'),
    path('register/', auth_views.register_view, name='register'),
    path('csrf/', auth_views.csrf_token, name='csrf_token'),
    path('change-password/', auth_views.change_password, name='change_password'),

    # User management (admin only)
    path('users/', auth_views.user_list, name='user_list'),
    path('users/<int:user_id>/', auth_views.user_detail, name='user_detail'),
    path('setup-status/', auth_views.setup_status, name='setup_status'),
]