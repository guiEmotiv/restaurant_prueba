"""
Custom CORS middleware to ensure proper headers are set
"""

class CustomCORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Set CORS headers for all responses
        origin = request.META.get('HTTP_ORIGIN', '')
        
        # List of allowed origins
        allowed_origins = [
            'http://www.xn--elfogndedonsoto-zrb.com',
            'https://www.xn--elfogndedonsoto-zrb.com',
            'http://xn--elfogndedonsoto-zrb.com',
            'https://xn--elfogndedonsoto-zrb.com',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
        ]
        
        if origin in allowed_origins:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Credentials'] = 'true'
        
        # Handle preflight requests
        if request.method == 'OPTIONS':
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
            response['Access-Control-Allow-Headers'] = ', '.join([
                'accept',
                'accept-encoding',
                'authorization',
                'content-type',
                'dnt',
                'origin',
                'user-agent',
                'x-csrftoken',
                'x-requested-with',
                'cache-control',
                'pragma',
                'expires',
                'Expires',
                'Cache-Control',
                'Pragma',
            ])
            response['Access-Control-Max-Age'] = '86400'  # 24 hours
        
        return response