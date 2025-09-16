#!/usr/bin/env python3
"""Test script to verify USB printer detection and configuration"""

import requests
import json

BASE_URL = "http://192.168.1.43:8000/api/v1"

def test_usb_detection():
    """Test USB port scanning endpoint"""
    print("1. Testing USB port detection...")
    response = requests.get(f"{BASE_URL}/rpi-scan-ports/")

    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Success! Found {data['total_found']} USB port(s):")
        for port in data['available_ports']:
            print(f"      - {port}")
        if data.get('additional_info'):
            print("   Additional info:")
            for info in data['additional_info']:
                print(f"      {info}")
        return data['available_ports']
    else:
        print(f"   ❌ Error: {response.status_code}")
        return []

def test_printer_config_api():
    """Test printer configuration endpoints"""
    print("\n2. Testing printer configuration API...")

    # Get CSRF token first
    csrf_response = requests.get(f"{BASE_URL.replace('/api/v1', '')}/csrf/")
    if csrf_response.status_code == 200:
        csrf_token = csrf_response.json().get('csrfToken')
        print(f"   ✅ Got CSRF token")
    else:
        print("   ❌ Failed to get CSRF token")
        return

    # Try to get printer configs
    headers = {'X-CSRFToken': csrf_token}
    cookies = {'csrftoken': csrf_token}

    response = requests.get(f"{BASE_URL}/printer-config/", headers=headers, cookies=cookies)
    if response.status_code == 200:
        printers = response.json()
        print(f"   ✅ Found {len(printers)} configured printer(s)")
        for printer in printers:
            print(f"      - {printer.get('name', 'Unknown')} at {printer.get('usb_port', 'Unknown port')}")
    else:
        print(f"   ⚠️  No printers configured or error: {response.status_code}")

def main():
    print("=" * 60)
    print("USB PRINTER DETECTION TEST")
    print("=" * 60)

    # Test USB detection
    ports = test_usb_detection()

    # Test printer config API
    test_printer_config_api()

    print("\n" + "=" * 60)
    print("SUMMARY:")
    if ports:
        print(f"✅ USB detection working - {len(ports)} port(s) available")
        print("✅ Ready to configure printers through the web interface")
    else:
        print("⚠️  No USB ports detected - check printer connections")
    print("=" * 60)

if __name__ == "__main__":
    main()