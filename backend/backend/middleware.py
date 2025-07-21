"""
Custom middleware for debugging API requests in production
"""
import logging

logger = logging.getLogger(__name__)

class APIDebugMiddleware:
    """Debug middleware to log all API requests"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        # Log request details
        if request.path.startswith('/api/'):
            logger.info(f"API Request: {request.method} {request.path} from {request.META.get('REMOTE_ADDR')}")
            print(f"[API DEBUG] {request.method} {request.path} from {request.META.get('REMOTE_ADDR')}")
        
        response = self.get_response(request)
        
        # Log response status
        if request.path.startswith('/api/'):
            logger.info(f"API Response: {response.status_code} for {request.path}")
            print(f"[API DEBUG] Response: {response.status_code} for {request.path}")
            
        return response