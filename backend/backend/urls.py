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
    """Serve frontend assets (CSS, JS, etc.) - we know they're in staticfiles/assets"""
    static_asset_path = settings.STATIC_ROOT / 'assets' / path
    if static_asset_path.exists() and static_asset_path.is_file():
        content_type, _ = mimetypes.guess_type(str(static_asset_path))
        return FileResponse(open(static_asset_path, 'rb'), content_type=content_type)
    
    raise Http404(f"Asset not found at {static_asset_path}: {path}")

def serve_vite_svg(request):
    """Serve vite.svg - try multiple locations"""
    # Try frontend_static first
    svg_path = settings.BASE_DIR / 'frontend_static' / 'vite.svg'
    if svg_path.exists():
        return FileResponse(open(svg_path, 'rb'), content_type='image/svg+xml')
    
    # Try staticfiles
    static_svg_path = settings.STATIC_ROOT / 'vite.svg'
    if static_svg_path.exists():
        return FileResponse(open(static_svg_path, 'rb'), content_type='image/svg+xml')
    
    raise Http404("vite.svg not found")

def debug_static_files(request):
    """Debug view to show where files are located"""
    import os
    debug_info = []
    
    debug_info.append(f"DEBUG setting: {settings.DEBUG}")
    debug_info.append(f"BASE_DIR: {settings.BASE_DIR}")
    debug_info.append(f"STATIC_ROOT: {settings.STATIC_ROOT}")
    debug_info.append("")
    
    # Check frontend_static
    frontend_dir = settings.BASE_DIR / 'frontend_static'
    debug_info.append(f"frontend_static exists: {frontend_dir.exists()}")
    if frontend_dir.exists():
        try:
            files = list(frontend_dir.rglob('*'))[:20]  # First 20 files
            debug_info.append(f"frontend_static files: {[str(f) for f in files]}")
        except Exception as e:
            debug_info.append(f"Error reading frontend_static: {e}")
    
    debug_info.append("")
    
    # Check staticfiles
    static_dir = Path(settings.STATIC_ROOT)
    debug_info.append(f"staticfiles exists: {static_dir.exists()}")
    if static_dir.exists():
        try:
            files = list(static_dir.rglob('*'))[:30]  # First 30 files
            debug_info.append(f"staticfiles files: {[str(f) for f in files]}")
        except Exception as e:
            debug_info.append(f"Error reading staticfiles: {e}")
    
    # Look for the specific assets we need
    debug_info.append("")
    debug_info.append("Looking for specific assets:")
    search_files = ['index-dsb0hPYX.css', 'index-BCaE9ebp.js', 'vite.svg']
    for search_file in search_files:
        try:
            found_files = list(Path('/app').rglob(f'*{search_file}*'))
            debug_info.append(f"{search_file}: {found_files}")
        except Exception as e:
            debug_info.append(f"Error searching {search_file}: {e}")
    
    return HttpResponse('<br>'.join(debug_info), content_type='text/html')

urlpatterns = [
    path('admin/', admin.site.urls),
    # API routes FIRST
    path('', include('api_urls')),
    # Debug view
    path('debug-static/', debug_static_files, name='debug_static'),
    # Serve frontend assets - MUST come before the catch-all route
    re_path(r'^assets/(?P<path>.*)$', serve_frontend_asset, name='frontend_assets'),
    path('vite.svg', serve_vite_svg, name='vite_svg'),
]

# Serve static and media files in production
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
# Also serve assets directly from static
urlpatterns += static('/assets/', document_root=settings.STATIC_ROOT / 'assets')

# Serve React app for all other routes (MUST be last)
urlpatterns += [
    path('', index_view, name='frontend_index'),
]
