from django.urls import path
from django.http import JsonResponse
from . import views
# Temporarily comment out aws_views import to test routing
# from . import aws_views

def test_auth_view(request):
    """Simple test view to verify auth URLs are loading"""
    import traceback
    try:
        # Test if we can import the AWS views module
        from . import aws_views
        aws_status = "AWS views imported successfully"
    except Exception as e:
        aws_status = f"AWS views import error: {str(e)} - {traceback.format_exc()}"
    
    return JsonResponse({
        "status": "Authentication module loaded successfully",
        "aws_import_status": aws_status,
        "request_path": request.path,
        "request_method": request.method
    })

urlpatterns = [
    # Test endpoint to verify routing - put at end to avoid issues
    path('test/', test_auth_view, name='auth_test'),
    
    # Basic working endpoints
    path('login/', views.login_view, name='login'),
]