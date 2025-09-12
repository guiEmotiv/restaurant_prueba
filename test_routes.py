#!/usr/bin/env python3
"""
Test specific API routes after successful login
"""
import requests
import json

def test_api_routes():
    session = requests.Session()

    # Login first
    print("🔐 Logging in as admin...")
    csrf_response = session.get("http://localhost:8000/csrf/")
    csrf_token = csrf_response.json()['csrfToken']

    headers = {'X-CSRFToken': csrf_token}
    login_data = {'username': 'admin', 'password': 'admin123'}
    login_response = session.post(
        "http://localhost:8000/api/v1/auth/login/",
        json=login_data,
        headers=headers
    )

    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return

    print("✅ Login successful")

    # Test different route patterns
    test_routes = [
        # API routes from router
        'units/',
        'zones/',
        'tables/',
        'containers/',
        'groups/',
        'ingredients/',
        'recipes/',
        'orders/',
        'payments/',
        # Config routes with prefix
        'config/units/',
        'config/zones/',
        'config/tables/',
        'config/containers/',
        # Inventory routes with prefix
        'inventory/groups/',
        'inventory/ingredients/',
        'inventory/recipes/',
    ]

    print(f"\n🧪 Testing {len(test_routes)} API routes...")

    working_routes = []

    for route in test_routes:
        try:
            url = f"http://localhost:8000/api/v1/{route}"
            response = session.get(url, headers=headers)

            if response.status_code == 200:
                working_routes.append(route)
                try:
                    data = response.json()
                    count = len(data) if isinstance(data, list) else "N/A"
                    print(f"   ✅ {route}: {response.status_code} ({count} items)")
                except:
                    print(f"   ✅ {route}: {response.status_code} (non-JSON response)")
            else:
                print(f"   ❌ {route}: {response.status_code}")
                if response.status_code == 404:
                    print(f"      Route not found")
                elif response.status_code == 403:
                    print(f"      Permission denied")
                else:
                    try:
                        error_data = response.json()
                        print(f"      Error: {error_data}")
                    except:
                        print(f"      Raw response: {response.text[:100]}")

        except Exception as e:
            print(f"   ❌ {route}: Exception - {e}")

    print(f"\n📊 Results:")
    print(f"   Working routes: {len(working_routes)}")
    print(f"   Failed routes: {len(test_routes) - len(working_routes)}")

    if working_routes:
        print(f"\n✅ Working routes:")
        for route in working_routes:
            print(f"   - {route}")

if __name__ == "__main__":
    test_api_routes()