# EC2 + SQLite + Docker Deployment Guide

**Simple, reliable production deployment for Restaurant Management System**

## 🎯 Overview

This deployment strategy uses:

- **AWS EC2** - Ubuntu server
- **SQLite** - Simple, reliable database
- **Docker** - Containerized application
- **Local Storage** - No external dependencies

**Benefits:**

- ✅ **Simple setup** - Minimal configuration required
- ✅ **Cost effective** - Single EC2 instance
- ✅ **Reliable** - SQLite is proven and stable
- ✅ **Easy maintenance** - Everything in one place
- ✅ **Quick deployment** - One command deployment

## 🚀 Quick Start (5 minutes)

### Step 1: Launch EC2 Instance

```bash
# AWS Console > EC2 > Launch Instance
# - AMI: Ubuntu 22.04 LTS
# - Instance Type: t3.micro (free tier)
# - Key Pair: Create new or use existing
# - Security Group: Allow ports 22, 80, 8000
```

### Step 2: Connect and Setup Server

```bash
# Connect to your instance
ssh -i your-key.pem ubuntu@your-ec2-ip
chmod 400 ~/Downloads/ubuntu_fds_key.pem
ssh -i ubuntu_fds_key.pem ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com

# Clone repository
sudo mkdir -p /opt/restaurant-app
sudo chown ubuntu:ubuntu /opt/restaurant-app
cd /opt/restaurant-app
git clone https://github.com/your-username/restaurant-web.git .
sudo git clone https://github.com/guiEmotiv/restaurant-web .

# Run automated setup
sudo ./deploy/ec2-setup.sh

# Logout and login to apply Docker group
exit
ssh -i your-key.pem ubuntu@your-ec2-ip
cd /opt/restaurant-app
```

### Step 3: Configure and Deploy

```bash
# Create environment file
sudo cp .env.example .env
nano .env  # Edit DJANGO_SECRET_KEY and EC2_PUBLIC_IP

# Deploy application
sudo ./deploy/ec2-deploy.sh
```

### Step 4: Access Your Application

```
🎉 Done! Access your app at: http://your-ec2-ip:8000
http://44.248.47.186:8000
```

## 📋 Detailed Setup

### Prerequisites

- AWS account with EC2 access
- SSH key pair for EC2 access
- Basic command line knowledge

### EC2 Instance Configuration

#### Recommended Specifications

- **Instance Type**: t3.micro (1 vCPU, 1 GB RAM)
- **Storage**: 8 GB gp2 (free tier)
- **OS**: Ubuntu 22.04 LTS
- **Network**: Default VPC with public subnet

#### Security Group Rules

```bash
# SSH Access
Type: SSH
Protocol: TCP
Port: 22
Source: Your IP

# HTTP Access (optional for nginx)
Type: HTTP
Protocol: TCP
Port: 80
Source: 0.0.0.0/0

# Application Access
Type: Custom TCP
Protocol: TCP
Port: 8000
Source: 0.0.0.0/0
```

### Environment Configuration

#### Minimal Configuration (.env)

```bash
# Required
DJANGO_SECRET_KEY=your-secure-secret-key-here
EC2_PUBLIC_IP=your-ec2-public-ip

# Optional
DOMAIN_NAME=yourdomain.com
USE_HTTPS=false
```

#### Complete Configuration

```bash
# Required Settings
DJANGO_SECRET_KEY=your-secure-secret-key-here
EC2_PUBLIC_IP=your-ec2-public-ip

# Server Settings
DOMAIN_NAME=yourdomain.com
USE_HTTPS=false

# Admin User (auto-created on first run)
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@restaurant.local
DJANGO_SUPERUSER_PASSWORD=secure_admin_password

# Email Settings (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
EMAIL_USE_TLS=true

# Timezone
TIME_ZONE=America/Lima
```

### Deployment Commands

#### Main Deployment Script

```bash
./deploy/ec2-deploy.sh [command]

# Available commands:
deploy   # Full deployment (default)
status   # Show application status
logs     # Show application logs (follow mode)
restart  # Restart application
stop     # Stop application
backup   # Create manual backup
shell    # Open Django shell
help     # Show help message
```

#### Common Operations

```bash
# Deploy new version
./deploy/ec2-deploy.sh deploy

# Check status
./deploy/ec2-deploy.sh status

# View logs
./deploy/ec2-deploy.sh logs

# Create backup
./deploy/ec2-deploy.sh backup

# Access Django shell
./deploy/ec2-deploy.sh shell

# Create admin user manually
docker exec -it restaurant_web_ec2 python manage.py createsuperuser
```

## 📁 File Structure

```
/opt/restaurant-app/           # Application root
├── data/                      # SQLite database
│   └── db.sqlite3
├── logs/                      # Application logs
│   ├── django.log
│   ├── access.log
│   └── error.log
├── staticfiles/              # Static assets
├── media/                    # Uploaded files
├── backups/                  # Automated backups
├── .env                      # Environment configuration
├── docker-compose.ec2.yml    # Docker Compose config
└── deploy/                   # Deployment scripts
    ├── ec2-deploy.sh
    └── ec2-setup.sh
```

## 🔒 Security Best Practices

### 1. Server Security

```bash
# Update system regularly
sudo apt update && sudo apt upgrade -y

# Check firewall status
sudo ufw status

# Monitor failed login attempts
sudo fail2ban-client status sshd
```

### 2. Application Security

```bash
# Use strong secret key
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'

# Restrict allowed hosts in production
DOMAIN_NAME=yourdomain.com
```

### 3. Database Security

```bash
# Database is automatically secured inside Docker container
# Regular backups are created automatically

# Check database size
ls -lh /opt/restaurant-app/data/db.sqlite3

# Manual backup
./deploy/ec2-deploy.sh backup
```

## 📊 Monitoring and Maintenance

### Health Monitoring

```bash
# Application health
./deploy/ec2-deploy.sh status

# System resources
htop
df -h
free -h

# Docker resources
docker stats
docker system df
```

### Log Management

```bash
# Application logs
tail -f /opt/restaurant-app/logs/django.log

# Docker logs
docker logs -f restaurant_web_ec2

# System logs
journalctl -u docker -f
```

### Backup Management

```bash
# Automated backups (daily)
ls -la /opt/restaurant-app/backups/

# Manual backup
./deploy/ec2-deploy.sh backup

# Restore from backup
# 1. Stop application
./deploy/ec2-deploy.sh stop
# 2. Replace database file
cp /opt/restaurant-app/backups/backup_YYYYMMDD_HHMMSS.tar.gz /tmp/
cd /tmp && tar -xzf backup_YYYYMMDD_HHMMSS.tar.gz
cp data/db.sqlite3 /opt/restaurant-app/data/
# 3. Start application
./deploy/ec2-deploy.sh deploy
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check logs
docker logs restaurant_web_ec2

# Check Docker Compose
docker-compose -f docker-compose.ec2.yml ps

# Rebuild container
docker-compose -f docker-compose.ec2.yml build --no-cache web
```

#### 2. Permission Issues

```bash
# Fix ownership
sudo chown -R ubuntu:ubuntu /opt/restaurant-app

# Check Docker group
groups $USER
# If 'docker' not in groups, logout and login again
```

#### 3. Port Already in Use

```bash
# Check what's using port 8000
sudo netstat -tlnp | grep :8000

# Kill process if needed
sudo kill -9 $(sudo lsof -t -i:8000)
```

#### 4. Database Issues

```bash
# Check database file
ls -la /opt/restaurant-app/data/db.sqlite3

# Recreate database
./deploy/ec2-deploy.sh stop
rm /opt/restaurant-app/data/db.sqlite3
./deploy/ec2-deploy.sh deploy
```

### Log Locations

- Application: `/opt/restaurant-app/logs/django.log`
- Docker: `docker logs restaurant_web_ec2`
- System: `/var/log/syslog`
- Setup: `/var/log/ec2-setup.log`

## 🚀 Scaling and Optimization

### Performance Optimization

```bash
# Increase swap for small instances
sudo swapon --show
free -h

# Monitor resource usage
htop
iostat 1

# Optimize Docker resources
docker system prune -f
```

### Database Optimization

```bash
# SQLite database optimization is automatic
# For large datasets, consider PostgreSQL migration

# Check database size
du -sh /opt/restaurant-app/data/

# Database integrity check
docker exec restaurant_web_ec2 python manage.py dbshell
# In SQLite shell: PRAGMA integrity_check;
```

### Horizontal Scaling (Future)

For scaling beyond single instance:

1. Use AWS Application Load Balancer
2. Deploy multiple EC2 instances
3. Use AWS RDS PostgreSQL for shared database
4. Implement session storage (Redis/Memcached)

## 💰 Cost Estimation

### AWS Free Tier (First 12 months)

- **EC2 t3.micro**: 750 hours/month (Free)
- **EBS Storage**: 30 GB (Free)
- **Data Transfer**: 1 GB outbound (Free)

**Monthly Cost**: $0 (Free tier)

### After Free Tier

- **EC2 t3.micro**: ~$8.50/month
- **EBS 8GB**: ~$0.80/month
- **Data Transfer**: ~$0.09/GB

**Estimated Monthly Cost**: ~$10-15

## 📞 Support

### Getting Help

1. Check logs: `./deploy/ec2-deploy.sh logs`
2. Check status: `./deploy/ec2-deploy.sh status`
3. Review this guide
4. Check GitHub issues

### Useful Resources

- [Django Documentation](https://docs.djangoproject.com/)
- [Docker Documentation](https://docs.docker.com/)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [Ubuntu Server Guide](https://ubuntu.com/server/docs)

---

**Remember**: Always test deployments in a staging environment first!
