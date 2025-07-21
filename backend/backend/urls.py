from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import HttpResponse, FileResponse, Http404
from pathlib import Path
import mimetypes

def index_view(request):
    """Serve React index.html for production"""
    try:
        with open(settings.BASE_DIR / 'frontend_static' / 'index.html', 'r') as f:
            return HttpResponse(f.read(), content_type='text/html')
    except FileNotFoundError:
        return HttpResponse('Frontend not built yet. Build the React app first.', status=404)

def serve_frontend_asset(request, path):
    """Serve frontend assets (CSS, JS, etc.) from frontend_static directory"""
    asset_path = settings.BASE_DIR / 'frontend_static' / 'assets' / path
    if asset_path.exists() and asset_path.is_file():
        content_type, _ = mimetypes.guess_type(str(asset_path))
        return FileResponse(open(asset_path, 'rb'), content_type=content_type)
    raise Http404("Asset not found")

def serve_vite_svg(request):
    """Serve vite.svg from frontend_static directory"""
    svg_path = settings.BASE_DIR / 'frontend_static' / 'vite.svg'
    if svg_path.exists():
        return FileResponse(open(svg_path, 'rb'), content_type='image/svg+xml')
    raise Http404("vite.svg not found")

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('api_urls')),
    # Serve frontend assets
    re_path(r'^assets/(?P<path>.*)$', serve_frontend_asset, name='frontend_assets'),
    path('vite.svg', serve_vite_svg, name='vite_svg'),
    # Serve React app for all other routes
    path('', index_view, name='frontend_index'),
]

# Serve static and media files in production
if settings.DEBUG is False:  # In production
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
