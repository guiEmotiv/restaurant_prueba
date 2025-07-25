from django.urls import path
from . import views

urlpatterns = [
    # AWS IAM Authentication endpoints
    path('login/', views.login_view, name='login'),
    path('password-reset-instructions/', views.password_reset_instructions_view, name='password_reset_instructions'),
]