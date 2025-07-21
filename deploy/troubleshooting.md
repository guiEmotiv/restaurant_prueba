# Troubleshooting Guide - Restaurant App on AWS

## Common Issues and Solutions

### 1. Docker Daemon Not Running

**Error**: `Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?`

**Solutions**:
```bash
# Check Docker status
sudo systemctl status docker

# Start Docker if not running
sudo systemctl start docker

# Enable Docker to start on boot
sudo systemctl enable docker

# Verify Docker is working
sudo docker run hello-world
```

### 2. Permission Denied for Docker Commands

**Error**: `permission denied while trying to connect to the Docker daemon socket`

**Solutions**:
```bash
# Add current user to docker group
sudo usermod -a -G docker $USER

# Apply group changes (choose one):
# Option 1: Log out and log back in
# Option 2: Use newgrp
newgrp docker

# Verify groups
groups
```

### 3. .env File Not Found

**Error**: `env file /opt/restaurant-app/.env not found`

**Solutions**:
```bash
# Navigate to application directory
cd /opt/restaurant-app

# Copy example to create .env
sudo cp .env.example .env

# Edit with your actual values
sudo nano .env

# Set proper permissions
sudo chown ec2-user:ec2-user .env
sudo chmod 600 .env
```

### 4. Docker Compose Version Warning

**Warning**: `the attribute 'version' is obsolete`

This is just a warning and can be ignored. We've already removed the version from docker-compose.prod.yml.

### 5. Complete Setup from Scratch

If you're starting fresh on EC2:

```bash
# 1. Connect to EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# 2. Run Docker setup script
cd /opt/restaurant-app
sudo ./deploy/setup-docker.sh

# 3. Log out and back in (or use newgrp)
exit
ssh -i your-key.pem ec2-user@your-ec2-ip

# 4. Create .env file
cd /opt/restaurant-app
cp .env.example .env
nano .env  # Edit with your values

# 5. Build and run
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 6. Run migrations
docker-compose -f docker-compose.prod.yml exec web python manage.py migrate

# 7. Create superuser
docker-compose -f docker-compose.prod.yml exec web python manage.py createsuperuser
```

### 6. Checking Logs

```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs

# Follow logs in real-time
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs web

# Check Django logs
sudo tail -f /opt/restaurant-app/logs/django.log
```

### 7. RDS Connection Issues

**Error**: `could not connect to server: Connection refused`

**Solutions**:
1. Check RDS Security Group allows connections from EC2
2. Verify RDS endpoint in .env file
3. Ensure RDS is publicly accessible (or in same VPC)
4. Test connection:
```bash
# Install PostgreSQL client
sudo yum install postgresql -y

# Test connection
psql -h your-rds-endpoint.amazonaws.com -U postgres -d restaurant_db
```

### 8. Static Files Not Loading

**Error**: Static files return 404

**Solutions**:
```bash
# Collect static files
docker-compose -f docker-compose.prod.yml exec web python manage.py collectstatic --noinput

# Check S3 bucket permissions
# Ensure bucket policy allows public read access
```

### 9. Memory Issues on t3.micro

If the EC2 instance runs out of memory:

```bash
# Check memory usage
free -h

# Add swap space (optional)
sudo dd if=/dev/zero of=/swapfile bs=128M count=8
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

### 10. Restarting Services

```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Restart specific service
docker-compose -f docker-compose.prod.yml restart web

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build
```