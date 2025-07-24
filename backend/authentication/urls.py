from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('user/', views.current_user_view, name='current_user'),
    path('permissions/', views.user_permissions_view, name='user_permissions'),
    path('users/', views.list_users_view, name='list_users'),
    path('users/create/', views.create_user_view, name='create_user'),
]