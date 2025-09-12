"""
Django Settings Module Router
Delegates to the modular settings package
"""
# Import everything from the settings package
# The settings/__init__.py handles environment selection
from .settings import *