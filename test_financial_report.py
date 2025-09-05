import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings_prod')
django.setup()

from operation.views_financiero import DashboardFinancieroViewSet
from django.test import RequestFactory
import traceback

print("🔍 TESTING DASHBOARD FINANCIERO REPORT SPECIFICALLY")
print("=" * 55)

try:
    # Create the viewset
    viewset = DashboardFinancieroViewSet()
    
    print("✅ ViewSet created successfully")
    
    # Create a mock request with the exact parameters from the error
    factory = RequestFactory()
    request = factory.get('/api/v1/dashboard-financiero/report/', {
        'date': '2025-09-05', 
        'period': 'month'
    })
    
    print("✅ Mock request created with parameters:")
    print(f"   date: {request.GET.get('date')}")
    print(f"   period: {request.GET.get('period')}")
    
    # Test the period calculation method first
    print("\n🔍 Testing _calculate_period_dates method...")
    try:
        period_info = viewset._calculate_period_dates('month', '2025-09-05')
        print(f"✅ Period info calculated:")
        print(f"   start_date: {period_info['start_date']}")
        print(f"   end_date: {period_info['end_date']}")
        print(f"   total_days: {period_info['total_days']}")
    except Exception as pe:
        print(f"❌ Period calculation error: {pe}")
        print(traceback.format_exc())
        exit(1)
    
    # Test the dashboard view query method
    print("\n🔍 Testing _query_dashboard_view method...")
    try:
        dashboard_data = viewset._query_dashboard_view(period_info)
        print(f"✅ Dashboard data retrieved:")
        print(f"   total_orders: {dashboard_data['summary']['total_orders']}")
        print(f"   total_revenue: {dashboard_data['summary']['total_revenue']}")
        print(f"   categories: {len(dashboard_data['category_breakdown'])}")
        print(f"   dishes: {len(dashboard_data['top_dishes'])}")
        print(f"   sales_days: {len(dashboard_data['sales_by_day'])}")
    except Exception as de:
        print(f"❌ Dashboard query error: {de}")
        print(traceback.format_exc())
        exit(1)
    
    # Now test the full report method
    print("\n🔍 Testing full report method...")
    try:
        response = viewset.report(request)
        print(f"✅ Report method executed successfully")
        print(f"   Status code: {response.status_code}")
        if hasattr(response, 'data'):
            data = response.data
            print(f"   Response keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
            if isinstance(data, dict) and 'summary' in data:
                print(f"   Summary: {data['summary']}")
    except Exception as re:
        print(f"❌ Report method error: {re}")
        print(f"\n📋 Full traceback:")
        print(traceback.format_exc())
        
        # Let's also test the SQL query manually with the exact same parameters
        print(f"\n🔍 Testing SQL query manually...")
        try:
            from django.db import connection
            cursor = connection.cursor()
            
            # Use the same query from the _query_dashboard_view method
            params = [period_info['start_date'], period_info['end_date']]
            print(f"SQL parameters: {params}")
            
            query = """
                SELECT 
                    order_id, order_total, order_status, waiter, operational_date,
                    item_id, quantity, unit_price, total_price, total_with_container, item_status, is_takeaway,
                    recipe_name, category_name, category_id,
                    payment_method, payment_amount
                FROM dashboard_operativo_view
                WHERE operational_date BETWEEN ? AND ? AND order_status = 'PAID'
                ORDER BY operational_date DESC, order_id, item_id
            """
            
            cursor.execute(query, params)
            result = cursor.fetchall()
            cursor.close()
            print(f"✅ SQL query executed successfully: {len(result)} records")
            if result:
                print(f"   Sample record: {result[0]}")
                
        except Exception as sql_error:
            print(f"❌ SQL query error: {sql_error}")
            print(traceback.format_exc())

except Exception as main_error:
    print(f"❌ Main test error: {main_error}")
    print(traceback.format_exc())

print(f"\n🏁 Test completed")