# 🚀 Enterprise Deployment System

## Overview

Ultra-secure, production-grade deployment system for the Restaurant Web Application with comprehensive security, monitoring, and rollback capabilities.

## 🛡️ Security Features

- **Enterprise SSL/HTTPS** with TLS 1.2/1.3 only
- **Security Headers**: CSP, HSTS, X-Frame-Options, etc.
- **Rate Limiting** for API endpoints
- **AWS Credential Protection** with secure handling
- **Container Vulnerability Scanning**
- **Database Integrity Checks**

## 🚀 Usage

### Production Deployment (GitHub Actions - Recommended)
```bash
# Normal deployment
gh workflow run "Enterprise Production Deployment" -f action=deploy

# Emergency rollback  
gh workflow run "Enterprise Production Deployment" -f action=rollback

# Health check only
gh workflow run "Enterprise Production Deployment" -f action=status

# System cleanup
gh workflow run "Enterprise Production Deployment" -f action=cleanup
```

### Manual EC2 Deployment
```bash
# Full deployment
./deploy/enterprise-deploy.sh [ECR_REGISTRY] [ECR_REPOSITORY] deploy

# Rollback
./deploy/enterprise-deploy.sh [ECR_REGISTRY] [ECR_REPOSITORY] rollback

# Status check
./deploy/enterprise-deploy.sh [ECR_REGISTRY] [ECR_REPOSITORY] status
```

## 📊 Monitoring

The system performs comprehensive health checks on:
- API endpoints (10+ critical endpoints)
- SSL certificate validity
- Container health status
- System resource usage
- Database integrity

## 🔄 Rollback Process

Automatic rollback is triggered if:
- Health checks fail after deployment
- Container startup fails
- Critical endpoints are unreachable
- SSL configuration fails

## 📝 Logs

All deployment activities are logged to:
- `/opt/restaurant-web/logs/enterprise/deploy_[TIMESTAMP].log`

## ⚙️ System Requirements

- Docker and Docker Compose
- AWS CLI configured
- Valid SSL certificates (for HTTPS)
- Minimum 2GB RAM, 10GB disk space