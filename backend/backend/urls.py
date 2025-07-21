from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import HttpResponse

def index_view(request):
    """Serve React index.html for production"""
    try:
        with open(settings.BASE_DIR / 'frontend_static' / 'index.html', 'r') as f:
            return HttpResponse(f.read(), content_type='text/html')
    except FileNotFoundError:
        return HttpResponse('Frontend not built yet. Build the React app first.', status=404)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('api_urls')),
    # Serve React app for all other routes
    path('', index_view, name='frontend_index'),
]

# Serve static and media files in production
if settings.DEBUG is False:  # In production
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
