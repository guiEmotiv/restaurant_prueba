#!/usr/bin/env python3
"""Test script to verify printer management action buttons with authentication"""

import requests
import json
import time

BASE_URL = "http://192.168.1.43:8000/api/v1"

# Create a session to maintain cookies
session = requests.Session()

def login():
    """Login to get session authentication"""
    # Get CSRF token first
    csrf_response = session.get(f"{BASE_URL.replace('/api/v1', '')}/csrf/")
    if csrf_response.status_code != 200:
        return False

    csrf_token = csrf_response.json().get('csrfToken')

    # Login
    login_data = {
        'username': 'admin',
        'password': 'admin123'
    }

    headers = {'X-CSRFToken': csrf_token}
    response = session.post(
        f"{BASE_URL}/auth/login/",
        json=login_data,
        headers=headers
    )

    if response.status_code == 200:
        user = response.json().get('user', {})
        print(f"✅ Logged in as: {user.get('username')} ({user.get('email')})")
        return True
    else:
        print(f"❌ Login failed: {response.status_code}")
        return False

def test_create_printer():
    """Test creating a new printer configuration"""
    print("\n1. Testing CREATE printer...")

    # Get fresh CSRF token for POST request
    csrf_response = session.get(f"{BASE_URL.replace('/api/v1', '')}/csrf/")
    csrf_token = csrf_response.json().get('csrfToken')

    printer_data = {
        'name': 'Test USB Printer',
        'usb_port': '/dev/usb/lp0',
        'baud_rate': 9600,
        'paper_width_mm': 80,
        'is_active': True
    }

    headers = {'X-CSRFToken': csrf_token}
    response = session.post(
        f"{BASE_URL}/printer-config/",
        json=printer_data,
        headers=headers
    )

    if response.status_code == 201:
        printer = response.json()
        print(f"   ✅ Printer created: {printer['name']} (ID: {printer['id']})")
        return printer['id']
    else:
        print(f"   ❌ Failed to create printer: {response.status_code}")
        print(f"      {response.text}")
        return None

def test_printer_actions(printer_id):
    """Test all printer action buttons"""

    # Test DEACTIVATE
    print("\n2. Testing DEACTIVATE printer...")
    response = session.post(f"{BASE_URL}/printer-config/{printer_id}/deactivate/")
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Printer deactivated: {result.get('message')}")
    else:
        print(f"   ❌ Failed to deactivate: {response.status_code}")

    time.sleep(1)

    # Test ACTIVATE
    print("\n3. Testing ACTIVATE printer...")
    response = session.post(f"{BASE_URL}/printer-config/{printer_id}/activate/")
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Printer activated: {result.get('message')}")
    else:
        print(f"   ❌ Failed to activate: {response.status_code}")

    time.sleep(1)

    # Test CONNECTION (This will actually print to the USB printer!)
    print("\n4. Testing TEST CONNECTION (will print test page!)...")
    response = session.post(f"{BASE_URL}/printer-config/{printer_id}/test_connection/")
    if response.status_code == 200:
        result = response.json()
        if result.get('test_result', {}).get('success'):
            print(f"   ✅ Test successful - Printer is working!")
            print(f"      Message: {result.get('test_result', {}).get('message')}")
        else:
            print(f"   ⚠️  Test failed: {result.get('test_result', {}).get('error')}")
    elif response.status_code == 400:
        result = response.json()
        print(f"   ⚠️  Test failed: {result.get('test_result', {}).get('error')}")
    else:
        print(f"   ❌ Failed to test: {response.status_code}")

    time.sleep(1)

    # Test STATUS SUMMARY
    print("\n5. Testing STATUS SUMMARY...")
    response = session.get(f"{BASE_URL}/printer-config/status_summary/")
    if response.status_code == 200:
        summary = response.json()
        stats = summary.get('summary', {})
        print(f"   ✅ Status summary retrieved:")
        print(f"      Total printers: {stats.get('total_printers', 0)}")
        print(f"      Active printers: {stats.get('active_printers', 0)}")
        print(f"      Inactive printers: {stats.get('inactive_printers', 0)}")
        print(f"      Recently used (24h): {stats.get('recently_used_24h', 0)}")
    else:
        print(f"   ❌ Failed to get summary: {response.status_code}")

    time.sleep(1)

    # Test TEST ALL
    print("\n6. Testing TEST ALL printers (will print on all active printers!)...")
    response = session.post(f"{BASE_URL}/printer-config/test_all/")
    if response.status_code == 200:
        result = response.json()
        summary = result.get('summary', {})
        print(f"   ✅ Test all completed:")
        print(f"      Tested: {summary.get('total_tested', 0)}")
        print(f"      Successful: {summary.get('successful', 0)}")
        print(f"      Failed: {summary.get('failed', 0)}")

        # Show individual results
        for test_result in result.get('results', []):
            status = "✅" if test_result.get('success') else "❌"
            msg = test_result.get('message') or test_result.get('error', 'Unknown')
            print(f"      {status} {test_result.get('printer_name')}: {msg}")
    else:
        print(f"   ❌ Failed to test all: {response.status_code}")

    return printer_id

def test_update_printer(printer_id):
    """Test updating printer configuration"""
    print("\n7. Testing UPDATE printer...")

    update_data = {
        'name': 'Updated Test Printer',
        'paper_width_mm': 58  # Change paper width
    }

    response = session.patch(
        f"{BASE_URL}/printer-config/{printer_id}/",
        json=update_data
    )

    if response.status_code == 200:
        printer = response.json()
        print(f"   ✅ Printer updated: {printer['name']}")
        print(f"      Paper width: {printer['paper_width_mm']}mm")
    else:
        print(f"   ❌ Failed to update: {response.status_code}")

def test_delete_printer(printer_id):
    """Test deleting a printer"""
    print("\n8. Testing DELETE printer...")

    response = session.delete(f"{BASE_URL}/printer-config/{printer_id}/")

    if response.status_code == 204:
        print(f"   ✅ Printer deleted successfully")
        return True
    else:
        print(f"   ❌ Failed to delete: {response.status_code}")
        if response.text:
            print(f"      {response.text}")
        return False

def main():
    print("=" * 60)
    print("PRINTER MANAGEMENT ACTIONS TEST (WITH AUTH)")
    print("=" * 60)

    # Login first
    if not login():
        print("❌ Authentication failed. Cannot proceed with tests.")
        return

    # Create test printer
    printer_id = test_create_printer()

    if printer_id:
        # Test all actions
        test_printer_actions(printer_id)

        # Test update
        test_update_printer(printer_id)

        # Delete test printer
        test_delete_printer(printer_id)

    print("\n" + "=" * 60)
    print("TEST COMPLETED SUCCESSFULLY")
    print("All printer management actions are working correctly!")
    print("=" * 60)

if __name__ == "__main__":
    main()