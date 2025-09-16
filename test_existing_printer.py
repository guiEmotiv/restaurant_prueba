#!/usr/bin/env python3
"""Test script to verify existing printer actions"""

import requests
import json
import time

BASE_URL = "http://192.168.1.43:8000/api/v1"
session = requests.Session()

def login():
    """Login to get session authentication"""
    csrf_response = session.get(f"{BASE_URL.replace('/api/v1', '')}/csrf/")
    csrf_token = csrf_response.json().get('csrfToken')

    login_data = {'username': 'admin', 'password': 'admin123'}
    headers = {'X-CSRFToken': csrf_token}
    response = session.post(f"{BASE_URL}/auth/login/", json=login_data, headers=headers)

    if response.status_code == 200:
        user = response.json().get('user', {})
        print(f"✅ Logged in as: {user.get('username')}")
        return True
    return False

def test_existing_printers():
    """Test actions on existing printers"""

    # Get list of printers
    response = session.get(f"{BASE_URL}/printer-config/")
    if response.status_code != 200:
        print("❌ Failed to get printers")
        return

    printers_data = response.json()

    # Handle both list response and paginated response
    if isinstance(printers_data, dict):
        printers = printers_data.get('results', [])
    else:
        printers = printers_data

    if not printers:
        print("No printers found. Creating one...")
        # Try to create with a different port
        csrf_response = session.get(f"{BASE_URL.replace('/api/v1', '')}/csrf/")
        csrf_token = csrf_response.json().get('csrfToken')

        printer_data = {
            'name': 'Test Printer 2',
            'usb_port': '/dev/usb/lp1',  # Different port
            'baud_rate': 9600,
            'paper_width_mm': 80,
            'is_active': True
        }

        headers = {'X-CSRFToken': csrf_token}
        response = session.post(f"{BASE_URL}/printer-config/", json=printer_data, headers=headers)

        if response.status_code == 201:
            printers = [response.json()]
            print(f"✅ Created printer: {printers[0]['name']}")
        else:
            print(f"Could not create printer: {response.text}")
            return

    # Test with first printer
    printer = printers[0]
    printer_id = printer['id']
    print(f"\n📋 Testing with printer: {printer['name']} (ID: {printer_id})")
    print(f"   Port: {printer['usb_port']}")
    print(f"   Active: {printer['is_active']}")

    # Test DEACTIVATE
    print("\n1. Testing DEACTIVATE...")
    response = session.post(f"{BASE_URL}/printer-config/{printer_id}/deactivate/")
    if response.status_code == 200:
        print(f"   ✅ Deactivated successfully")
    else:
        print(f"   ❌ Failed: {response.status_code}")

    time.sleep(1)

    # Test ACTIVATE
    print("\n2. Testing ACTIVATE...")
    response = session.post(f"{BASE_URL}/printer-config/{printer_id}/activate/")
    if response.status_code == 200:
        print(f"   ✅ Activated successfully")
    else:
        print(f"   ❌ Failed: {response.status_code}")

    time.sleep(1)

    # Test CONNECTION
    print("\n3. Testing TEST CONNECTION (will print!)...")
    response = session.post(f"{BASE_URL}/printer-config/{printer_id}/test_connection/")
    if response.status_code == 200:
        result = response.json()
        if result.get('test_result', {}).get('success'):
            print(f"   ✅ Test print successful!")
        else:
            print(f"   ⚠️  Test failed: {result.get('test_result', {}).get('error')}")
    else:
        result = response.json() if response.text else {}
        print(f"   ⚠️  Error: {result.get('test_result', {}).get('error', 'Unknown error')}")

    # Test STATUS SUMMARY
    print("\n4. Testing STATUS SUMMARY...")
    response = session.get(f"{BASE_URL}/printer-config/status_summary/")
    if response.status_code == 200:
        summary = response.json()
        stats = summary.get('summary', {})
        print(f"   ✅ Summary retrieved:")
        print(f"      Total: {stats.get('total_printers')}")
        print(f"      Active: {stats.get('active_printers')}")
        print(f"      Inactive: {stats.get('inactive_printers')}")

    # Test TEST ALL
    print("\n5. Testing TEST ALL...")
    response = session.post(f"{BASE_URL}/printer-config/test_all/")
    if response.status_code == 200:
        result = response.json()
        summary = result.get('summary', {})
        print(f"   ✅ Test all completed:")
        print(f"      Successful: {summary.get('successful')}")
        print(f"      Failed: {summary.get('failed')}")

def main():
    print("=" * 60)
    print("PRINTER ACTION BUTTONS TEST")
    print("=" * 60)

    if not login():
        print("❌ Authentication failed")
        return

    test_existing_printers()

    print("\n" + "=" * 60)
    print("✅ ALL TESTS COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    main()