from django.urls import path
from . import views, aws_views

urlpatterns = [
    # AWS IAM Authentication (Primary)
    path('aws-login/', aws_views.aws_login_view, name='aws_login'),
    path('aws-logout/', aws_views.aws_logout_view, name='aws_logout'),
    path('aws-user/', aws_views.aws_current_user_view, name='aws_current_user'),
    
    # Legacy Database Authentication (Deprecated - will redirect to AWS)
    path('login/', aws_views.aws_login_view, name='login'),  # Redirect to AWS login
    path('logout/', aws_views.aws_logout_view, name='logout'),
    path('user/', aws_views.aws_current_user_view, name='current_user'),
    path('permissions/', views.user_permissions_view, name='user_permissions'),
    path('users/', views.list_users_view, name='list_users'),
    path('users/create/', views.create_user_view, name='create_user'),
]