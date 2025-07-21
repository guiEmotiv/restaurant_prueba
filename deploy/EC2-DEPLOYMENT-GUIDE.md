# 🚀 EC2 Production Deployment Guide

## Restaurant Management System - AWS EC2 Deployment

This guide provides step-by-step instructions for deploying the Restaurant Management System on AWS EC2 using Docker and SQLite.

---

## 📋 Prerequisites

- AWS Account with EC2 access
- SSH Key Pair (.pem file)
- Basic knowledge of AWS EC2 and command line

---

## 🎯 Step 1: Launch EC2 Instance

### 1.1 Create EC2 Instance
1. Open AWS EC2 Console
2. Click "Launch Instance"
3. Choose **Ubuntu Server 22.04 LTS (HVM)**
4. Select **t3.micro** (or larger for production)
5. Configure Key Pair (create new or use existing)
6. Configure Security Group:
   - **SSH (22)**: Your IP only
   - **HTTP (80)**: 0.0.0.0/0
   - **HTTPS (443)**: 0.0.0.0/0 (optional)
7. Launch instance

### 1.2 Connect to Instance
```bash
# Make key file secure
chmod 400 your-key.pem

# Connect to EC2
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

## 🔧 Step 2: Server Setup

### 2.1 Run Setup Script
```bash
# Download and run setup script
wget https://raw.githubusercontent.com/your-username/restaurant-web/main/deploy/ec2-setup.sh
chmod +x ec2-setup.sh
./ec2-setup.sh
```

### 2.2 Manual Setup (if needed)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in
exit
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

## 📦 Step 3: Deploy Application

### 3.1 Get Application Code
```bash
# Clone repository
git clone https://github.com/your-username/restaurant-web.git
cd restaurant-web
```

### 3.2 Configure Environment
```bash
# Copy environment template
cp .env.ec2 .env.ec2.local

# Generate Django secret key
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Get EC2 public IP
curl http://169.254.169.254/latest/meta-data/public-ipv4

# Edit environment file
nano .env.ec2.local
```

**Required Configuration:**
```env
DJANGO_SECRET_KEY=your-generated-secret-key
EC2_PUBLIC_IP=your-ec2-public-ip
DJANGO_SUPERUSER_PASSWORD=secure-password
```

### 3.3 Deploy Application
```bash
# Make script executable
chmod +x deploy/ec2-deploy.sh

# Deploy application
./deploy/ec2-deploy.sh
```

---

## 🎉 Step 4: Verify Deployment

### 4.1 Check Application Status
```bash
# Check status
./deploy/ec2-deploy.sh status

# View logs
./deploy/ec2-deploy.sh logs
```

### 4.2 Access Application
Open your browser and navigate to:
- **Application**: `http://YOUR_EC2_PUBLIC_IP`
- **Admin Panel**: `http://YOUR_EC2_PUBLIC_IP/admin/`
- **API Documentation**: `http://YOUR_EC2_PUBLIC_IP/api/`

---

## 🛠️ Management Commands

### Application Management
```bash
# View status
./deploy/ec2-deploy.sh status

# View logs (follow)
./deploy/ec2-deploy.sh logs

# Restart application
./deploy/ec2-deploy.sh restart

# Stop application
./deploy/ec2-deploy.sh stop

# Create database backup
./deploy/ec2-deploy.sh backup
```

### Direct Docker Commands
```bash
# View containers
docker ps

# View logs
docker logs restaurant_web_ec2

# Execute commands in container
docker exec -it restaurant_web_ec2 python manage.py shell
docker exec -it restaurant_web_ec2 python manage.py createsuperuser
```

---

## 🔒 Security Recommendations

### 1. Environment Variables
- Never commit `.env.ec2.local` to version control
- Use strong passwords for admin accounts
- Regularly rotate secret keys

### 2. EC2 Security
- Restrict SSH access to your IP only
- Keep system packages updated
- Consider using a custom SSH port
- Enable AWS CloudWatch monitoring

### 3. Application Security
- Set up HTTPS with Let's Encrypt (optional)
- Configure proper backup strategy
- Monitor application logs
- Set up alerts for failures

---

## 🔄 Updates and Maintenance

### Application Updates
```bash
# Pull latest changes
git pull origin main

# Redeploy
./deploy/ec2-deploy.sh
```

### System Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker
sudo apt install docker-ce docker-ce-cli containerd.io

# Restart application after system updates
./deploy/ec2-deploy.sh restart
```

---

## 🚨 Troubleshooting

### Common Issues

**1. Container Won't Start**
```bash
# Check logs
docker logs restaurant_web_ec2

# Rebuild without cache
docker-compose -f docker-compose.ec2.yml build --no-cache
./deploy/ec2-deploy.sh
```

**2. Permission Denied for Docker**
```bash
# Check if user is in docker group
groups $USER

# If not in docker group
sudo usermod -aG docker $USER
# Log out and back in
```

**3. Port Already in Use**
```bash
# Check what's using port 80
sudo netstat -tlnp | grep :80

# Kill process if necessary
sudo kill -9 $(sudo lsof -t -i:80)
```

**4. Database Issues**
```bash
# Access container and check database
docker exec -it restaurant_web_ec2 bash
python manage.py migrate
python manage.py shell
```

### Log Files
- **Application logs**: `docker logs restaurant_web_ec2`
- **Django logs**: `./data/django.log` (in container)
- **System logs**: `/var/log/syslog`

---

## 💰 Cost Estimation

### AWS Free Tier (First 12 months)
- **EC2 t3.micro**: 750 hours/month (Free)
- **Storage**: 30GB EBS (Free)
- **Data Transfer**: 15GB/month (Free)

**Monthly Cost**: $0 (Free tier)

### After Free Tier
- **EC2 t3.micro**: ~$8.50/month
- **Storage**: ~$3.00/month (30GB)
- **Data Transfer**: ~$0.09/GB

**Estimated Cost**: $12-20/month

---

## 📞 Support

### Getting Help
1. Check logs: `./deploy/ec2-deploy.sh logs`
2. Verify configuration: `cat .env.ec2.local`
3. Check this guide for common issues
4. Create an issue on GitHub

### Useful Resources
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [Docker Documentation](https://docs.docker.com/)
- [Django Deployment Guide](https://docs.djangoproject.com/en/stable/howto/deployment/)

---

## ✅ Deployment Checklist

- [ ] EC2 instance launched and configured
- [ ] Security groups properly configured
- [ ] SSH access working
- [ ] Docker and Docker Compose installed
- [ ] Application code deployed
- [ ] Environment variables configured
- [ ] Application running and accessible
- [ ] Admin panel accessible
- [ ] SSL certificate configured (optional)
- [ ] Monitoring and alerts set up
- [ ] Backup strategy implemented

---

**🎉 Your Restaurant Management System is now running on AWS EC2!**