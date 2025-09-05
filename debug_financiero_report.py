import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_prod')
django.setup()

from django.test import RequestFactory
from django.http import HttpRequest
from datetime import datetime, date
import traceback

print("🐛 DEBUGGING DASHBOARD FINANCIERO REPORT ERROR")
print("=" * 50)

try:
    # Import the view
    from operation.views_financiero import FinancialReportView
    
    print("✅ View imported successfully")
    
    # Create a mock request
    factory = RequestFactory()
    request = factory.get('/api/v1/dashboard-financiero/report/', {'date': '2025-09-05', 'period': 'month'})
    
    print("✅ Mock request created")
    
    # Create view instance
    view = FinancialReportView()
    view.request = request
    
    print("✅ View instance created")
    
    # Try to call the get method directly
    print("\n🔍 Testing view.get() method...")
    
    response = view.get(request)
    print(f"✅ Response received: {response.status_code}")
    print(f"Response content: {response.content[:500]}...")
    
except Exception as e:
    print(f"❌ Error occurred: {e}")
    print(f"\n📋 Full traceback:")
    print(traceback.format_exc())
    
    # Let's try to test the specific SQL query that might be failing
    print(f"\n🔍 Testing SQL queries manually...")
    try:
        from django.db import connection
        cursor = connection.cursor()
        
        # Test the query that might be in the financial report
        test_queries = [
            "SELECT operational_date, SUM(total_with_container) FROM dashboard_operativo_view WHERE operational_date BETWEEN '2025-09-01' AND '2025-09-30' GROUP BY operational_date",
            "SELECT * FROM dashboard_operativo_view WHERE operational_date = '2025-09-05' LIMIT 1",
            "SELECT COUNT(*) FROM dashboard_operativo_view WHERE operational_date BETWEEN '2025-09-01' AND '2025-09-30'"
        ]
        
        for i, query in enumerate(test_queries, 1):
            try:
                print(f"\n{i}. Testing: {query[:60]}...")
                cursor.execute(query)
                result = cursor.fetchall()
                print(f"✅ Query {i} success: {len(result)} records")
                if result:
                    print(f"   Sample: {result[0] if result else 'No data'}")
            except Exception as qe:
                print(f"❌ Query {i} failed: {qe}")
        
        cursor.close()
        
    except Exception as db_error:
        print(f"❌ Database test failed: {db_error}")

print(f"\n🏁 Debug completed")