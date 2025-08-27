# 🚀 Restaurant Web - Deployment Guide

## 📋 Overview

This project uses automated CI/CD with GitHub Actions for deployment to AWS EC2. Every push to `main` triggers an automatic deployment with email notifications and version tagging.

### 📋 Architecture Overview

```
GitHub Repository
    ↓ (Push to branch)
GitHub Actions
    ↓ (Build & Test)
AWS ECR (Docker Registry)
    ↓ (Deploy)
AWS EC2 Instances
```

## 🔧 Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

### AWS Configuration
```bash
AWS_ACCESS_KEY_ID          # AWS Access Key for ECR and EC2 access
AWS_SECRET_ACCESS_KEY      # AWS Secret Access Key
AWS_REGION                 # Default: us-west-2
```

### EC2 Instance Configuration
```bash
EC2_DEV_HOST              # Development EC2 IP address or hostname
EC2_PROD_HOST             # Production EC2 IP address or hostname
EC2_USERNAME              # EC2 username (usually 'ec2-user' for Amazon Linux)
EC2_SSH_PRIVATE_KEY       # Private SSH key for EC2 access (PEM format)
EC2_SSH_PORT              # SSH port (default: 22)
```

### AWS Cognito Configuration
```bash
COGNITO_USER_POOL_ID      # AWS Cognito User Pool ID
COGNITO_APP_CLIENT_ID     # AWS Cognito Application Client ID
```

### Django Configuration
```bash
DJANGO_SECRET_KEY         # Django secret key for production
```

### Domain Configuration (Optional)
```bash
DOMAIN_NAME               # Your domain name (e.g., restaurant.com)
```


## 📦 ECR Repository Setup

1. Create an ECR repository:
```bash
aws ecr create-repository --repository-name restaurant-web --region us-west-2
```

2. Note the repository URI for your workflows.

## 🏗️ EC2 Instance Setup

### Initial Setup (Run once per instance)

1. **Connect to your EC2 instance:**
```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
```

2. **Run the setup script:**
```bash
curl -sSL https://raw.githubusercontent.com/yourusername/restaurant-web/main/scripts/setup-ec2.sh | bash
```

3. **Configure environment:**
```bash
cd /opt/restaurant-web
cp .env.template .env.ec2
nano .env.ec2  # Edit with your configuration
```

4. **Configure AWS credentials:**
```bash
aws configure
```

### Manual Deployment (Optional)

If you need to deploy manually:

```bash
# Development
./scripts/deploy-ec2.sh -e dev

# Production (with confirmation)
./scripts/deploy-ec2.sh -e prod

# Production (force, no confirmation)
./scripts/deploy-ec2.sh -e prod -f
```

## 🔄 Deployment Workflows

### Automatic Deployment (Every Push to Main)

```bash
# Make changes
git add .
git commit -m "feat: add new feature"
git push origin main

# Automatic process:
# 1. Run tests (backend + frontend)
# 2. Build Docker image
# 3. Push to ECR
# 4. Deploy to EC2
# 5. Docker cleanup (old images/containers)
# 6. Database backup (keep last 10)
# 7. Run migrations
# 8. Health check
# 9. GitHub email notification (automatic)
```

### Release Deployment (Version Tags)

```bash
# For major releases
git tag -a v2.0.0 -m "Major release: New ordering system"
git push origin v2.0.0

# This triggers the same process but with release version
```

## 🏷️ Version Management

### Automatic Version Tags

Every successful deployment creates a Git tag automatically:

```bash
# Format for automatic deployments
deploy-prod-20240827-143022-abc1234

# Format for release versions
v1.0.0
v2.1.3
```

### Viewing Deployment History

```bash
# List all deployment tags
git tag -l "deploy-*"

# List all release versions
git tag -l "v*"

# View details of a specific deployment
git show deploy-prod-20240827-143022-abc1234
```

## 📧 Email Notifications

GitHub automatically envía notificaciones por email cuando:
- ✅ **Deployment exitoso**: Notificación de éxito
- ❌ **Deployment fallido**: Notificación de error con detalles

**No requiere configuración adicional** - GitHub usa tu email del perfil automáticamente.

## 🧹 Limpieza Automática

Cada deployment ejecuta limpieza automática en EC2 para evitar acumulación:

- **Docker Images**: Elimina imágenes antigas (>24h)
- **Docker Containers**: Limpia contenedores no utilizados
- **Volumes**: Remueve volúmenes huérfanos
- **Database Backups**: Mantiene solo los últimos 10 backups

## 🌿 Branch Strategy

```
main branch (production)
    ↓
    Deploy to PROD EC2 (manual approval)

dev branch (development)
    ↓
    Deploy to DEV EC2 (automatic)

feature branches
    ↓
    Create PR to dev → Test & Review
```

## 📊 Monitoring and Logs

### Application Logs
```bash
# View application logs
docker logs restaurant-web-app -f

# View nginx logs (if using)
docker logs restaurant-nginx -f

# View all services
docker-compose logs -f
```

### System Status
```bash
# Run info script
/opt/restaurant-web/info.sh

# Check Docker containers
docker ps

# Check system resources
htop
df -h
```

### Backup Management
```bash
# Manual backup
/opt/restaurant-web/backup.sh

# List backups
ls -la /opt/restaurant-web/backups/

# Restore from backup
cd /opt/restaurant-web
docker-compose down
cp backups/backup-YYYYMMDD-HHMMSS.tar.gz ./
tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz
cp backup-YYYYMMDD-HHMMSS/restaurant_prod.sqlite3 data/
docker-compose up -d
```

## 🚨 Troubleshooting

### Deployment Fails

1. **Check GitHub Actions logs:**
   - Go to Actions tab in GitHub
   - Click on failed workflow
   - Check individual step logs

2. **Check EC2 instance:**
```bash
# SSH to instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Check Docker status
docker ps
docker logs restaurant-web-app

# Check disk space
df -h

# Check system logs
sudo journalctl -u docker
```

3. **Common fixes:**
```bash
# Restart Docker
sudo systemctl restart docker

# Clean Docker system
docker system prune -f

# Update deployment scripts
curl -sSL https://raw.githubusercontent.com/yourusername/restaurant-web/main/scripts/deploy-ec2.sh -o /opt/restaurant-web/deploy-ec2.sh
chmod +x /opt/restaurant-web/deploy-ec2.sh
```

### Database Issues

1. **Backup before fixing:**
```bash
/opt/restaurant-web/backup.sh
```

2. **Reset migrations (if needed):**
```bash
docker-compose exec app python manage.py migrate --fake-initial
```

3. **Restore from backup:**
```bash
docker-compose down
cp backups/latest-backup.sqlite3 data/restaurant_prod.sqlite3
docker-compose up -d
```

## 🔒 Security Best Practices

### EC2 Security Groups
- **SSH (22):** Only from your IP
- **HTTP (80):** Open to internet
- **HTTPS (443):** Open to internet
- **Django Dev (8000):** Only for development instances

### SSH Key Management
- Use separate keys for dev and prod
- Rotate keys regularly
- Never commit keys to repository

### Environment Variables
- Never commit secrets to repository
- Use different values for dev/prod
- Rotate secrets regularly

### Docker Security
- Keep images updated
- Don't run containers as root
- Use specific image tags, not 'latest'
- Regular security scans

## 📞 Support

If you encounter issues:

1. Check this documentation
2. Review GitHub Actions logs
3. Check EC2 instance logs
4. Contact the development team

## 🔄 Updates

To update deployment scripts:

```bash
# Update from repository
cd /opt/restaurant-web
curl -sSL https://raw.githubusercontent.com/yourusername/restaurant-web/main/scripts/deploy-ec2.sh -o deploy-ec2.sh
curl -sSL https://raw.githubusercontent.com/yourusername/restaurant-web/main/scripts/setup-ec2.sh -o setup-ec2.sh
chmod +x *.sh
```