"""
Django settings module - Auto-imports the appropriate environment configuration
"""
import os

# Determine which settings to use based on environment
environment = os.environ.get('DJANGO_ENV', 'local')

if environment == 'production':
    from .settings_prod import *
else:
    # Default to local settings for development and testing
    # settings.local.py is in the same directory
    import importlib.util
    import os
    from pathlib import Path
    
    # Import settings.local.py
    settings_path = Path(__file__).parent / 'settings.local.py'
    spec = importlib.util.spec_from_file_location("settings_local", settings_path)
    settings_local = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(settings_local)
    
    # Import all settings from the local module
    for attr in dir(settings_local):
        if not attr.startswith('_'):
            globals()[attr] = getattr(settings_local, attr)