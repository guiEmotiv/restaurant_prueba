"""
Django Settings Module Selector
Automatically imports the correct settings based on ENVIRONMENT variable
"""
import os

# Get environment from variable
environment = os.environ.get('ENVIRONMENT', 'development').lower()

# Import appropriate settings
if environment == 'production':
    from .production import *
elif environment == 'staging':
    try:
        from .staging import *
    except ImportError:
        print("⚠️ No staging settings found, using production")
        from .production import *
else:
    # Default to development
    from .development import *

print(f"✅ Settings loaded: {environment.upper()}")