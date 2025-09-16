#!/usr/bin/env python3
"""Test script to verify Peru timezone formatting in printer test"""

import requests
import json

BASE_URL = "http://192.168.1.43:8000/api/v1"
session = requests.Session()

def login():
    """Login to get session authentication"""
    csrf_response = session.get(f"{BASE_URL.replace('/api/v1', '')}/csrf/")
    csrf_token = csrf_response.json().get('csrfToken')

    login_data = {'username': 'admin', 'password': 'admin123'}
    headers = {'X-CSRFToken': csrf_token}
    response = session.post(f"{BASE_URL}/auth/login/", json=login_data, headers=headers)

    return response.status_code == 200

def test_printer_date_format():
    """Test the printer connection with corrected Peru timezone"""

    # Get available printers
    response = session.get(f"{BASE_URL}/printer-config/")
    if response.status_code != 200:
        print("❌ No se pudieron obtener las impresoras")
        return

    printers_data = response.json()
    if isinstance(printers_data, dict):
        printers = printers_data.get('results', [])
    else:
        printers = printers_data

    if not printers:
        print("❌ No hay impresoras configuradas")
        return

    printer = printers[0]
    print(f"🧪 Probando formato de fecha con impresora: {printer['name']}")
    print(f"   Puerto: {printer['usb_port']}")

    # Test the connection (this will print to USB)
    response = session.post(f"{BASE_URL}/printer-config/{printer['id']}/test_connection/")

    if response.status_code == 200:
        result = response.json()
        if result.get('test_result', {}).get('success'):
            print("✅ Test de conexión exitoso!")
            print("   📋 La etiqueta impresa debe mostrar:")
            print("      - Fecha en formato DD/MM/AAAA")
            print("      - Hora en formato HH:MM:SS")
            print("      - Zona: America/Lima (UTC-5)")
            print("\n   ⚡ Revisa la impresora física para verificar el formato correcto")
        else:
            error = result.get('test_result', {}).get('error')
            print(f"⚠️  Test falló: {error}")
    else:
        print(f"❌ Error en test: {response.status_code}")
        try:
            error_detail = response.json()
            print(f"   Detalles: {error_detail}")
        except:
            pass

    print("\n📝 Formato esperado en la etiqueta:")
    print("   Fecha: 12/09/2025 (DD/MM/YYYY)")
    print("   Hora: 19:XX:XX (formato 24h, hora de Perú)")
    print("   Zona: America/Lima (UTC-5)")

def main():
    print("=" * 60)
    print("TEST DE FORMATO DE FECHA Y HORA - PERÚ")
    print("=" * 60)

    if not login():
        print("❌ Error de autenticación")
        return

    test_printer_date_format()

    print("\n" + "=" * 60)
    print("Prueba completada - Verifica la impresora física")
    print("=" * 60)

if __name__ == "__main__":
    main()