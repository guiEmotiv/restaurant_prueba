#!/usr/bin/env python3
"""
Script para analizar los modelos Django y generar el esquema esperado
"""
import os
import sys
import django

# Configurar Django
sys.path.append('/Users/guillermosotozuniga/restaurant-web/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.apps import apps
from django.db import models

def analyze_model_fields(model):
    """Analiza los campos de un modelo Django"""
    fields_info = []
    for field in model._meta.get_fields():
        if hasattr(field, 'column'):  # Es un campo real de BD
            field_info = {
                'name': field.column,
                'type': type(field).__name__,
                'null': field.null,
                'blank': field.blank,
                'default': getattr(field, 'default', None)
            }
            
            # Información específica según tipo
            if isinstance(field, models.CharField):
                field_info['max_length'] = field.max_length
            elif isinstance(field, models.DecimalField):
                field_info['max_digits'] = field.max_digits
                field_info['decimal_places'] = field.decimal_places
            elif isinstance(field, models.ForeignKey):
                field_info['related_model'] = field.related_model.__name__
                
            fields_info.append(field_info)
    
    return fields_info

def main():
    print("🔍 ANÁLISIS DE MODELOS DJANGO")
    print("=" * 50)
    
    # Modelos principales que nos interesan
    models_to_analyze = [
        'config.Unit',
        'config.Zone', 
        'config.Table',
        'config.Container',
        'inventory.Group',
        'inventory.Ingredient',
        'inventory.Recipe',
        'inventory.RecipeItem',
        'operation.Order',
        'operation.OrderItem'
    ]
    
    for model_path in models_to_analyze:
        try:
            model = apps.get_model(model_path)
            print(f"\n📋 MODELO: {model.__name__}")
            print(f"   Tabla: {model._meta.db_table}")
            
            fields = analyze_model_fields(model)
            for field in fields:
                null_str = "NULL" if field['null'] else "NOT NULL"
                type_info = field['type']
                
                if 'max_length' in field:
                    type_info += f"({field['max_length']})"
                elif 'max_digits' in field:
                    type_info += f"({field['max_digits']}, {field['decimal_places']})"
                
                print(f"   • {field['name']}: {type_info} {null_str}")
                
                if field.get('related_model'):
                    print(f"     └─ FK → {field['related_model']}")
                    
        except Exception as e:
            print(f"❌ Error analizando {model_path}: {e}")

if __name__ == "__main__":
    main()