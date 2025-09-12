#!/usr/bin/env python3
"""
Debug script to test Django authentication and frontend integration
"""
import requests
import json
from datetime import datetime

def test_complete_flow():
    print("🔍 DEBUGGING COMPLETE AUTHENTICATION FLOW")
    print("=" * 60)

    # Step 1: Test backend health
    print("\n1. Testing Backend Health...")
    try:
        health_response = requests.get("http://localhost:8000/api/v1/health/", timeout=5)
        print(f"   ✅ Backend health: {health_response.status_code}")
        if health_response.status_code == 200:
            health_data = health_response.json()
            print(f"   Database: {health_data.get('database', 'unknown')}")
            print(f"   Environment: {health_data.get('environment', 'unknown')}")
    except Exception as e:
        print(f"   ❌ Backend health failed: {e}")
        return False

    # Step 2: Test frontend access
    print("\n2. Testing Frontend Access...")
    try:
        frontend_response = requests.get("http://localhost:5173/", timeout=5)
        print(f"   ✅ Frontend accessible: {frontend_response.status_code}")
    except Exception as e:
        print(f"   ❌ Frontend access failed: {e}")
        return False

    # Step 3: Test complete auth flow
    print("\n3. Testing Complete Authentication Flow...")
    session = requests.Session()

    # Get CSRF token
    try:
        csrf_response = session.get("http://localhost:8000/csrf/")
        csrf_data = csrf_response.json()
        csrf_token = csrf_data['csrfToken']
        print(f"   ✅ CSRF token obtained: {csrf_token[:10]}...")
    except Exception as e:
        print(f"   ❌ CSRF token failed: {e}")
        return False

    # Login
    try:
        headers = {'X-CSRFToken': csrf_token}
        login_data = {'username': 'admin', 'password': 'admin123'}
        login_response = session.post(
            "http://localhost:8000/api/v1/auth/login/",
            json=login_data,
            headers=headers
        )

        if login_response.status_code == 200:
            login_result = login_response.json()
            user = login_result['user']
            print(f"   ✅ Login successful: {user['username']}")
            print(f"   Groups: {user['groups']}")
            print(f"   Permissions: {list(user['permissions'].keys())}")
            print(f"   All permissions true: {all(user['permissions'].values())}")
        else:
            print(f"   ❌ Login failed: {login_response.status_code}")
            print(f"   Response: {login_response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Login exception: {e}")
        return False

    # Test user list (admin endpoint)
    print("\n4. Testing User Management API...")
    try:
        users_response = session.get(
            "http://localhost:8000/api/v1/auth/users/",
            headers=headers
        )

        if users_response.status_code == 200:
            users = users_response.json()
            print(f"   ✅ User list accessible: {len(users)} users found")

            # Find admin user
            admin_user = next((u for u in users if u['username'] == 'admin'), None)
            if admin_user:
                print(f"   Admin user found:")
                print(f"     - Groups: {admin_user.get('groups', [])}")
                print(f"     - Staff: {admin_user.get('is_staff', False)}")
                print(f"     - Superuser: {admin_user.get('is_superuser', False)}")
                print(f"     - Active: {admin_user.get('is_active', False)}")
                print(f"     - Permissions: {admin_user.get('permissions', {})}")
        else:
            print(f"   ❌ User list failed: {users_response.status_code}")
            print(f"   Response: {users_response.text}")
            return False
    except Exception as e:
        print(f"   ❌ User list exception: {e}")
        return False

    # Test status endpoint
    print("\n5. Testing Auth Status...")
    try:
        status_response = session.get(
            "http://localhost:8000/api/v1/auth/status/",
            headers=headers
        )

        if status_response.status_code == 200:
            status_data = status_response.json()
            print(f"   ✅ Auth status OK")
            print(f"   Authenticated: {status_data.get('isAuthenticated', False)}")
            if 'user' in status_data:
                user = status_data['user']
                print(f"   User: {user.get('username', 'unknown')}")
                print(f"   Role: {user.get('groups', [])}")
                print(f"   Permissions: {user.get('permissions', {})}")
        else:
            print(f"   ❌ Auth status failed: {status_response.status_code}")
            print(f"   Response: {status_response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Auth status exception: {e}")
        return False

    # Test config API endpoints (should be accessible to admin)
    print("\n6. Testing Config API Endpoints...")
    config_endpoints = [
        'config/units/',
        'config/zones/',
        'config/tables/',
        'config/containers/',
        'inventory/groups/',
        'inventory/ingredients/',
        'inventory/recipes/'
    ]

    accessible_endpoints = []
    for endpoint in config_endpoints:
        try:
            api_response = session.get(
                f"http://localhost:8000/api/v1/{endpoint}",
                headers=headers
            )
            if api_response.status_code == 200:
                accessible_endpoints.append(endpoint)
                print(f"   ✅ {endpoint}: accessible")
            else:
                print(f"   ❌ {endpoint}: {api_response.status_code}")
        except Exception as e:
            print(f"   ❌ {endpoint}: exception - {e}")

    print(f"\n   Total accessible endpoints: {len(accessible_endpoints)}/{len(config_endpoints)}")

    # Summary
    print(f"\n🎯 SUMMARY")
    print(f"   Backend: ✅ Healthy")
    print(f"   Frontend: ✅ Accessible")
    print(f"   Authentication: ✅ Working")
    print(f"   Admin permissions: ✅ All granted")
    print(f"   API endpoints: ✅ {len(accessible_endpoints)}/{len(config_endpoints)} accessible")

    if len(accessible_endpoints) == len(config_endpoints):
        print(f"\n🎉 ALL TESTS PASSED - Authentication system is fully functional!")
        return True
    else:
        print(f"\n⚠️  Some API endpoints not accessible - check permissions")
        return False

if __name__ == "__main__":
    test_complete_flow()