#!/usr/bin/env python3
"""Test script to verify printer management action buttons"""

import requests
import json
import time

BASE_URL = "http://192.168.1.43:8000/api/v1"

def get_csrf_token():
    """Get CSRF token for authenticated requests"""
    response = requests.get(f"{BASE_URL.replace('/api/v1', '')}/csrf/")
    if response.status_code == 200:
        return response.json().get('csrfToken')
    return None

def test_create_printer(csrf_token):
    """Test creating a new printer configuration"""
    print("\n1. Testing CREATE printer...")

    headers = {'X-CSRFToken': csrf_token, 'Content-Type': 'application/json'}
    cookies = {'csrftoken': csrf_token}

    printer_data = {
        'name': 'Test USB Printer',
        'usb_port': '/dev/usb/lp0',
        'baud_rate': 9600,
        'paper_width_mm': 80,
        'is_active': True
    }

    response = requests.post(
        f"{BASE_URL}/printer-config/",
        json=printer_data,
        headers=headers,
        cookies=cookies
    )

    if response.status_code == 201:
        printer = response.json()
        print(f"   ✅ Printer created: {printer['name']} (ID: {printer['id']})")
        return printer['id']
    else:
        print(f"   ❌ Failed to create printer: {response.status_code}")
        print(f"      {response.text}")
        return None

def test_printer_actions(printer_id, csrf_token):
    """Test all printer action buttons"""
    headers = {'X-CSRFToken': csrf_token}
    cookies = {'csrftoken': csrf_token}

    # Test DEACTIVATE
    print("\n2. Testing DEACTIVATE printer...")
    response = requests.post(
        f"{BASE_URL}/printer-config/{printer_id}/deactivate/",
        headers=headers,
        cookies=cookies
    )
    if response.status_code == 200:
        print(f"   ✅ Printer deactivated")
    else:
        print(f"   ❌ Failed to deactivate: {response.status_code}")

    time.sleep(1)

    # Test ACTIVATE
    print("\n3. Testing ACTIVATE printer...")
    response = requests.post(
        f"{BASE_URL}/printer-config/{printer_id}/activate/",
        headers=headers,
        cookies=cookies
    )
    if response.status_code == 200:
        print(f"   ✅ Printer activated")
    else:
        print(f"   ❌ Failed to activate: {response.status_code}")

    time.sleep(1)

    # Test CONNECTION
    print("\n4. Testing TEST CONNECTION...")
    response = requests.post(
        f"{BASE_URL}/printer-config/{printer_id}/test_connection/",
        headers=headers,
        cookies=cookies
    )
    if response.status_code == 200:
        result = response.json()
        if result.get('test_result', {}).get('success'):
            print(f"   ✅ Test successful - Printer is working!")
        else:
            print(f"   ⚠️  Test failed: {result.get('test_result', {}).get('error')}")
    else:
        print(f"   ❌ Failed to test: {response.status_code}")

    time.sleep(1)

    # Test STATUS SUMMARY
    print("\n5. Testing STATUS SUMMARY...")
    response = requests.get(
        f"{BASE_URL}/printer-config/status_summary/",
        headers=headers,
        cookies=cookies
    )
    if response.status_code == 200:
        summary = response.json()
        stats = summary.get('summary', {})
        print(f"   ✅ Status summary retrieved:")
        print(f"      Total printers: {stats.get('total_printers', 0)}")
        print(f"      Active printers: {stats.get('active_printers', 0)}")
        print(f"      Inactive printers: {stats.get('inactive_printers', 0)}")
    else:
        print(f"   ❌ Failed to get summary: {response.status_code}")

    time.sleep(1)

    # Test TEST ALL
    print("\n6. Testing TEST ALL printers...")
    response = requests.post(
        f"{BASE_URL}/printer-config/test_all/",
        headers=headers,
        cookies=cookies
    )
    if response.status_code == 200:
        result = response.json()
        summary = result.get('summary', {})
        print(f"   ✅ Test all completed:")
        print(f"      Tested: {summary.get('total_tested', 0)}")
        print(f"      Successful: {summary.get('successful', 0)}")
        print(f"      Failed: {summary.get('failed', 0)}")
    else:
        print(f"   ❌ Failed to test all: {response.status_code}")

    return printer_id

def test_delete_printer(printer_id, csrf_token):
    """Test deleting a printer"""
    print("\n7. Testing DELETE printer...")

    headers = {'X-CSRFToken': csrf_token}
    cookies = {'csrftoken': csrf_token}

    response = requests.delete(
        f"{BASE_URL}/printer-config/{printer_id}/",
        headers=headers,
        cookies=cookies
    )

    if response.status_code == 204:
        print(f"   ✅ Printer deleted successfully")
        return True
    else:
        print(f"   ❌ Failed to delete: {response.status_code}")
        return False

def main():
    print("=" * 60)
    print("PRINTER MANAGEMENT ACTIONS TEST")
    print("=" * 60)

    # Get CSRF token
    csrf_token = get_csrf_token()
    if not csrf_token:
        print("❌ Failed to get CSRF token")
        return

    print(f"✅ Got CSRF token")

    # Create test printer
    printer_id = test_create_printer(csrf_token)

    if printer_id:
        # Test all actions
        test_printer_actions(printer_id, csrf_token)

        # Delete test printer
        test_delete_printer(printer_id, csrf_token)

    print("\n" + "=" * 60)
    print("TEST COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    main()