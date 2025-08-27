#!/bin/bash
# Ultimate fix for deployment issues

set -e
cd /opt/restaurant-web

echo "🔥 ULTIMATE FIX - Complete rebuild"

# 1. Stop everything
docker-compose --profile production down --volumes --remove-orphans || true
docker system prune -af || true

# 2. Ensure proper environment
cat > .env.ec2 << 'EOF'
SECRET_KEY=django-prod-key-ultimate-fix
DEBUG=False
USE_COGNITO_AUTH=False
ALLOWED_HOSTS=*
DATABASE_PATH=/opt/restaurant-web/data
DATABASE_NAME=restaurant_prod.sqlite3
DJANGO_SETTINGS_MODULE=backend.settings_ec2
EOF

# 3. Ensure database
mkdir -p data
[ ! -f data/restaurant_prod.sqlite3 ] && touch data/restaurant_prod.sqlite3

# 4. ECR login and pull
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 721063839441.dkr.ecr.us-west-2.amazonaws.com
docker pull 721063839441.dkr.ecr.us-west-2.amazonaws.com/restaurant-web:latest

# 5. Update docker-compose
sed -i 's|image: restaurant-web:latest|image: 721063839441.dkr.ecr.us-west-2.amazonaws.com/restaurant-web:latest|g' docker-compose.yml

# 6. Start fresh
docker-compose --profile production up -d --build --force-recreate

# 7. Check
echo "Waiting 30 seconds..."
sleep 30
docker-compose --profile production ps

# 8. Ultimate test
echo "Testing health endpoint..."
if curl -sf http://localhost:8000/api/v1/health/; then
    echo "✅ ULTIMATE FIX SUCCESSFUL!"
    echo "✅ Your app is running at the EC2 IP!"
else
    echo "Final logs:"
    docker-compose --profile production logs app --tail=50
fi