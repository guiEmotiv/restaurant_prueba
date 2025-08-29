#!/bin/bash
set -e

ECR_REGISTRY="${1:-}"
ECR_REPOSITORY="${2:-}"
ACTION="${3:-deploy}"

[ -z "$ECR_REGISTRY" ] && exit 1
[ -z "$ECR_REPOSITORY" ] && exit 1

case "$ACTION" in
  "status") sudo docker ps; exit 0 ;;
  "logs") sudo docker logs app; exit 0 ;;
  "restart") sudo docker restart app nginx; exit 0 ;;
esac

mkdir -p data

cat > .env << 'EOF'
DEBUG=False
ALLOWED_HOSTS=*
DATABASE_PATH=/opt/restaurant-web/data
DATABASE_NAME=restaurant.prod.sqlite3
EOF

# Create docker-compose with nginx + Let's Encrypt
cat > docker/docker-compose.prod.yml << EOF
services:
  app:
    image: ${ECR_REGISTRY}/${ECR_REPOSITORY}:latest
    container_name: restaurant-web-app
    ports:
      - '8000:8000'
    volumes:
      - ./data:/opt/restaurant-web/data
    env_file: 
      - /opt/restaurant-web/.env
    restart: unless-stopped
    profiles: [production]
    networks: [restaurant-network]

  nginx:
    image: nginx:alpine
    container_name: restaurant-web-nginx
    ports: ['80:80', '443:443']
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
    depends_on: [app]
    restart: unless-stopped
    profiles: [production]
    networks: [restaurant-network]

  certbot:
    image: certbot/certbot
    container_name: restaurant-web-certbot
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt
      - /var/www/certbot:/var/www/certbot
    command: certonly --webroot --webroot-path=/var/www/certbot --email admin@xn--elfogndedonsoto-zrb.com --agree-tos --no-eff-email -d xn--elfogndedonsoto-zrb.com -d www.xn--elfogndedonsoto-zrb.com
    profiles: [ssl-setup]

networks:
  restaurant-network:
    driver: bridge
EOF

mkdir -p docker/nginx/conf.d
cp nginx/conf.d/default.conf docker/nginx/conf.d/

aws ecr get-login-password --region us-west-2 | sudo docker login --username AWS --password-stdin "$ECR_REGISTRY"
sudo docker pull "$ECR_REGISTRY/$ECR_REPOSITORY:latest"

sudo docker stop $(sudo docker ps -q) 2>/dev/null || true
sudo docker rm $(sudo docker ps -a -q) 2>/dev/null || true
sudo docker-compose -f docker/docker-compose.prod.yml --profile production down || true

echo "🚀 Starting services..."
sudo docker-compose -f docker/docker-compose.prod.yml --profile production up -d

echo "🔐 Setting up SSL certificate..."
sudo mkdir -p /var/www/certbot
sudo docker-compose -f docker/docker-compose.prod.yml --profile ssl-setup up certbot --remove-orphans

sleep 10
sudo docker-compose -f docker/docker-compose.prod.yml --profile production restart nginx

sleep 15
curl -sf http://localhost/api/v1/health/ >/dev/null && echo "✅ https://www.xn--elfogndedonsoto-zrb.com/"