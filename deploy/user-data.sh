#!/bin/bash

# EC2 User Data Script for Amazon Linux 2
# This script sets up the server for the restaurant application

# Update system
yum update -y

# Install Docker
amazon-linux-extras install docker -y
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Git
yum install git -y

# Create application directory
mkdir -p /opt/restaurant-app
cd /opt/restaurant-app

# Clone repository (replace with your actual repository)
# git clone https://github.com/your-username/restaurant-web.git .

# For now, create directory structure
mkdir -p backend frontend deploy

# Create environment file (you'll need to update this with actual values)
cat > .env << EOF
DJANGO_SECRET_KEY=your-production-secret-key-here
DEBUG=0
DOMAIN_NAME=your-domain.com
RDS_DB_NAME=restaurant_db
RDS_USERNAME=postgres
RDS_PASSWORD=your-secure-password
RDS_HOSTNAME=your-rds-endpoint.amazonaws.com
RDS_PORT=5432
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_DEFAULT_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name
FRONTEND_DOMAIN=your-cloudfront-domain.cloudfront.net
USE_SSL=true
TIME_ZONE=America/Lima
EOF

# Set proper permissions
chown -R ec2-user:ec2-user /opt/restaurant-app

# Create systemd service for the application
cat > /etc/systemd/system/restaurant-app.service << EOF
[Unit]
Description=Restaurant Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/restaurant-app
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0
User=ec2-user
Group=ec2-user

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
systemctl enable restaurant-app.service

# Create log rotation
cat > /etc/logrotate.d/restaurant-app << EOF
/opt/restaurant-app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ec2-user ec2-user
}
EOF

# Install CloudWatch agent for monitoring (optional but recommended)
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

echo "EC2 setup completed. Please:"
echo "1. Update the .env file with your actual credentials"
echo "2. Upload your application code"
echo "3. Run: sudo systemctl start restaurant-app"