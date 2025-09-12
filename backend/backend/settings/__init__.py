"""
Django Settings Module - Development Only
Simplified settings for development environment only
"""
import os

# Force development environment
environment = 'development'

# Always use development settings
from .development import *

print(f"✅ Settings loaded: DEVELOPMENT (simplified setup)")