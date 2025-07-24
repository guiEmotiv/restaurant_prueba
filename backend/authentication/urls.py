from django.urls import path
from django.http import JsonResponse
from . import views
# Temporarily comment out aws_views import to test routing
# from . import aws_views

def test_auth_view(request):
    """Simple test view to verify auth URLs are loading"""
    return JsonResponse({"status": "Authentication module loaded successfully"})

urlpatterns = [
    # Test endpoint to verify routing
    path('test/', test_auth_view, name='auth_test'),
    
    # Temporarily use original Django views for debugging
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('user/', views.current_user_view, name='current_user'),
    path('permissions/', views.user_permissions_view, name='user_permissions'),
    path('users/', views.list_users_view, name='list_users'),
    path('users/create/', views.create_user_view, name='create_user'),
]