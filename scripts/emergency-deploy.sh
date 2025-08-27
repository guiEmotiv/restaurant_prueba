#!/bin/bash
# Emergency deployment - Build and run locally on EC2

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }

cd /opt/restaurant-web || error "Not on EC2"

log "🚨 EMERGENCY DEPLOYMENT - Building locally"

# Step 1: Stop everything
log "Stopping all services..."
docker-compose --profile production down --remove-orphans || true
docker system prune -af || true

# Step 2: Clone latest code
log "Getting latest code..."
git pull origin main || {
    log "Git pull failed, using existing code"
}

# Step 3: Build frontend
log "Building frontend..."
if [ -d "frontend" ]; then
    cd frontend
    npm install || log "npm install failed"
    npm run build || log "npm build failed"
    cd ..
fi

# Step 4: Create improved Dockerfile
log "Creating optimized Dockerfile..."
cat > Dockerfile << 'EOF'
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy frontend build if exists
COPY frontend/dist/ ./frontend/dist/ || true

# Create directories
RUN mkdir -p /app/data /app/logs /app/staticfiles

# Environment
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=backend.settings_ec2

# Create entrypoint script
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Starting Django application..."\n\
python manage.py migrate --noinput || true\n\
python manage.py collectstatic --noinput || true\n\
exec gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 120 --access-logfile - backend.wsgi:application\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

EXPOSE 8000

CMD ["/app/entrypoint.sh"]
EOF

# Step 5: Build Docker image locally
log "Building Docker image..."
docker build -t restaurant-web:emergency .

# Step 6: Update docker-compose to use local image
log "Updating docker-compose..."
cat > docker-compose.override.yml << 'EOF'
version: '3.8'

services:
  app:
    image: restaurant-web:emergency
    environment:
      - DEBUG=False
      - USE_COGNITO_AUTH=False
      - SECRET_KEY=django-insecure-emergency-key-change-this
      - ALLOWED_HOSTS=*
      - DATABASE_PATH=/opt/restaurant-web/data
      - DATABASE_NAME=restaurant_prod.sqlite3
EOF

# Step 7: Ensure database exists
mkdir -p data
if [ ! -f data/restaurant_prod.sqlite3 ]; then
    touch data/restaurant_prod.sqlite3
fi

# Step 8: Start services
log "Starting services..."
docker-compose --profile production up -d

# Step 9: Wait and check
log "Waiting for services to start..."
sleep 30

# Step 10: Check status
docker-compose --profile production ps

# Step 11: Test health endpoint
if curl -f -s http://localhost:8000/api/v1/health/; then
    log "✅ EMERGENCY DEPLOYMENT SUCCESSFUL!"
else
    log "⚠️  Services started but health check failed"
    docker-compose --profile production logs app --tail=50
fi

log "🌐 Access your application at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'your-ec2-ip')"