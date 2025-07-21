# Production Deployment Guide

This guide provides step-by-step instructions for deploying the Restaurant Management System to production.

## Prerequisites

### System Requirements
- Ubuntu 20.04+ (recommended) or similar Linux distribution
- Docker and Docker Compose installed
- At least 2GB RAM and 20GB disk space
- Node.js 18+ (for frontend deployment)
- AWS CLI v2 (for S3 deployment)

### AWS Resources Required
- **EC2 Instance**: t3.micro or larger
- **RDS Instance**: PostgreSQL db.t3.micro or larger (optional, SQLite fallback available)
- **S3 Bucket**: For static files and frontend hosting
- **IAM User**: With appropriate permissions for S3 and RDS access

## Quick Start

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd restaurant-web
   cp .env.example .env
   ```

2. **Configure Environment**
   Edit `.env` with your production values (see Configuration section)

3. **Deploy Backend**
   ```bash
   ./deploy/deploy.sh
   ```

4. **Deploy Frontend**
   ```bash
   ./deploy/frontend-deploy.sh
   ```

## Detailed Configuration

### Environment Variables (.env file)

#### Critical Variables (Required)
```bash
DJANGO_SECRET_KEY=your-super-secret-key-change-this-in-production
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET_NAME=your-s3-bucket-name
```

#### Database Configuration
**Option 1: PostgreSQL RDS (Recommended for production)**
```bash
RDS_DB_NAME=restaurant_db
RDS_USERNAME=postgres
RDS_PASSWORD=your-secure-db-password
RDS_HOSTNAME=your-rds-endpoint.region.rds.amazonaws.com
RDS_PORT=5432
```

**Option 2: SQLite (Development/Testing)**
Leave RDS variables empty or unset to use SQLite fallback.

#### Domain and SSL
```bash
DOMAIN_NAME=yourdomain.com
EC2_PUBLIC_IP=your-ec2-public-ip
FRONTEND_DOMAIN=yourdomain.com
USE_SSL=true
CLOUDFRONT_DISTRIBUTION_ID=your-cloudfront-distribution-id
```

### AWS Setup

#### 1. Create IAM User
Create an IAM user with the following policies:
- AmazonS3FullAccess
- AmazonRDSFullAccess (if using RDS)
- CloudFrontFullAccess (if using CloudFront)

#### 2. Create S3 Bucket
```bash
aws s3 mb s3://your-bucket-name --region us-east-1
aws s3 website s3://your-bucket-name --index-document index.html --error-document index.html
```

#### 3. Setup RDS (Optional)
```bash
aws rds create-db-instance \
    --db-instance-identifier restaurant-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --master-username postgres \
    --master-user-password your-secure-password \
    --allocated-storage 20 \
    --vpc-security-group-ids sg-xxxxxxxx
```

#### 4. Setup EC2 Instance
- Launch Ubuntu 20.04+ instance
- Configure security groups (ports 22, 80, 443, 8000)
- Install Docker and Docker Compose

## Deployment Scripts

### 1. Backend Deployment (`./deploy/deploy.sh`)

**Features:**
- Automated deployment with health checks
- Database backup before deployment
- Zero-downtime deployment
- Docker container management
- Automatic migrations and static file collection

**Usage:**
```bash
./deploy/deploy.sh [command]

Commands:
  deploy  - Full deployment (default)
  status  - Show application status
  backup  - Create database backup only
  health  - Run health check only
  logs    - Show application logs
  restart - Restart application
```

**Example:**
```bash
# Full deployment
./deploy/deploy.sh

# Check status
./deploy/deploy.sh status

# View logs
./deploy/deploy.sh logs
```

### 2. Frontend Deployment (`./deploy/frontend-deploy.sh`)

**Features:**
- Build optimization and minification
- S3 deployment with proper cache headers
- CloudFront cache invalidation
- Build verification

**Usage:**
```bash
./deploy/frontend-deploy.sh [command]

Commands:
  deploy  - Full frontend deployment (default)
  build   - Build frontend only
  test    - Run tests only
  lint    - Run linting only
  upload  - Upload existing build to S3
  info    - Show deployment information
```

### 3. Database Backup (`./deploy/backup-db.sh`)

**Features:**
- Support for both PostgreSQL and SQLite
- Automated retention management
- S3 backup upload
- Data integrity verification

**Usage:**
```bash
./deploy/backup-db.sh [command]

Commands:
  backup          - Create database backup (default)
  status          - Show backup status and statistics
  restore <file>  - Restore from backup file
  cleanup         - Remove old backups
  list            - List available backups
```

## Security Considerations

### 1. Environment Variables
- Never commit `.env` files to version control
- Use strong, unique passwords
- Rotate credentials regularly
- Use AWS IAM roles when possible

### 2. Django Security
- Set `DEBUG=false` in production
- Use strong `DJANGO_SECRET_KEY`
- Configure proper `ALLOWED_HOSTS`
- Enable SSL/HTTPS (`USE_SSL=true`)

### 3. Database Security
- Use RDS with encryption at rest
- Configure proper security groups
- Use strong database passwords
- Enable automated backups

### 4. Infrastructure Security
- Keep EC2 instances updated
- Use security groups to limit access
- Enable CloudTrail for auditing
- Monitor with CloudWatch

## Monitoring and Maintenance

### 1. Application Logs
```bash
# View application logs
docker logs restaurant_web_prod -f

# View deployment logs
tail -f /var/log/deployment.log
```

### 2. Health Checks
```bash
# Check application health
./deploy/deploy.sh health

# Check container status
docker ps
docker stats
```

### 3. Database Maintenance
```bash
# Create manual backup
./deploy/backup-db.sh

# Check database status
docker exec restaurant_web_prod python manage.py dbshell
```

### 4. System Resources
```bash
# Check disk usage
df -h

# Check memory usage
free -h

# Check Docker resources
docker system df
```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start
```bash
# Check logs
docker logs restaurant_web_prod

# Check Docker Compose status
docker-compose -f docker-compose.prod.yml ps

# Rebuild container
docker-compose -f docker-compose.prod.yml build --no-cache web
```

#### 2. Database Connection Issues
```bash
# Test database connection
docker exec restaurant_web_prod python manage.py dbshell

# Check environment variables
docker exec restaurant_web_prod env | grep RDS
```

#### 3. Static Files Not Loading
```bash
# Collect static files manually
docker exec restaurant_web_prod python manage.py collectstatic --noinput

# Check S3 bucket permissions
aws s3 ls s3://your-bucket-name/static/
```

#### 4. Frontend Not Loading
```bash
# Check S3 bucket contents
aws s3 ls s3://your-bucket-name/frontend/

# Rebuild and redeploy frontend
./deploy/frontend-deploy.sh build
./deploy/frontend-deploy.sh upload
```

### Log Locations
- Application logs: `/var/log/django/django.log`
- Deployment logs: `/var/log/deployment.log`
- Frontend deployment logs: `/var/log/frontend-deployment.log`
- Backup logs: `/var/log/backup.log`

### Recovery Procedures

#### 1. Rollback Deployment
```bash
# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Restore from backup
./deploy/backup-db.sh restore /opt/backups/latest_backup.json.gz

# Start with previous image
docker-compose -f docker-compose.prod.yml up -d
```

#### 2. Database Recovery
```bash
# List available backups
./deploy/backup-db.sh list

# Restore specific backup
./deploy/backup-db.sh restore /opt/backups/django_data_20240101_120000.json.gz
```

## Performance Optimization

### 1. Database Optimization
- Enable PostgreSQL connection pooling
- Configure appropriate `shared_buffers` and `effective_cache_size`
- Regular VACUUM and ANALYZE operations

### 2. Application Optimization
- Use Django caching framework
- Configure Gunicorn worker processes based on CPU cores
- Implement database query optimization

### 3. Infrastructure Optimization
- Use CloudFront CDN for static files
- Configure proper S3 cache headers
- Monitor resource usage and scale accordingly

## Scaling Considerations

### 1. Horizontal Scaling
- Use AWS Application Load Balancer
- Deploy multiple EC2 instances
- Configure shared PostgreSQL RDS instance

### 2. Vertical Scaling
- Upgrade EC2 instance type
- Increase RDS instance resources
- Optimize Docker container resources

### 3. Database Scaling
- Use RDS read replicas
- Implement database connection pooling
- Consider database partitioning for large datasets

## Support

For issues and support:
1. Check the troubleshooting section above
2. Review application and deployment logs
3. Verify configuration in `.env` file
4. Test individual components with provided scripts

Remember to always test deployments in a staging environment before deploying to production.