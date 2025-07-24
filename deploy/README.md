# Deployment Scripts

This directory contains all deployment and AWS management scripts for the Restaurant Management System.

## 📁 Files Overview

### Core Deployment
- **`ec2-deploy.sh`** - Main EC2 deployment script with automatic migration conflict resolution
- **`ec2-setup.sh`** - Initial EC2 server setup
- **`clean-production-data.sh`** - Clean production database data
- **`clean-ec2-space.sh`** - Clean EC2 disk space

### AWS IAM Management
- **`aws-iam-manager.sh`** - Complete AWS IAM user and policy management
- **`aws-credentials.env`** - AWS credentials file (🚨 **NOT COMMITTED TO GIT**)

### Documentation
- **`EC2-DEPLOYMENT-GUIDE.md`** - Complete EC2 deployment guide
- **`AWS-IAM-SETUP.md`** - AWS IAM setup documentation

### Utilities
- **`test-api.sh`** - API testing script

## 🚀 Quick Start

### 1. Deploy to EC2
```bash
# On your EC2 instance
./deploy/ec2-deploy.sh clean  # For first time or migration issues
# OR
./deploy/ec2-deploy.sh        # For normal deployment
```

### 2. AWS IAM Management
```bash
# Create all IAM users and policies
./deploy/aws-iam-manager.sh create

# List existing resources
./deploy/aws-iam-manager.sh list

# Delete all resources (⚠️ Destructive!)
./deploy/aws-iam-manager.sh delete

# Test AWS permissions
./deploy/aws-iam-manager.sh test
```

### 3. Use AWS Credentials
```bash
# On EC2, source the credentials
source deploy/aws-credentials.env

# Verify variables are loaded
echo $AWS_ACCESS_KEY_ID_ADMIN_SYSTEM
```

## 🔧 Configuration

### Environment Variables
```bash
# AWS IAM Manager
PROJECT_NAME=restaurant    # Project prefix
AWS_REGION=us-east-1      # AWS region
POLICY_PATH=/restaurant/  # IAM policy path
USER_PATH=/restaurant/    # IAM user path

# EC2 Deployment
EC2_PUBLIC_IP=<your-ip>   # EC2 public IP (auto-detected)
```

## 👥 Created AWS Users

| User | Role | Access |
|------|------|--------|
| `restaurant-admin-system` | Admin | Full access to all resources |
| `restaurant-mesero-carlos` | Mesero | Orders & Kitchen DynamoDB tables |
| `restaurant-mesero-ana` | Mesero | Orders & Kitchen DynamoDB tables |
| `restaurant-cajero-luis` | Cajero | Payments DynamoDB tables |
| `restaurant-cajero-maria` | Cajero | Payments DynamoDB tables |

## 🛡️ Security Notes

- **Never commit `aws-credentials.env`** - Already in `.gitignore`
- AWS credentials are role-specific with minimal required permissions
- All scripts use `set -euo pipefail` for robust error handling
- Migration conflicts are automatically detected and resolved

## 🔍 Troubleshooting

### Migration Conflicts
```bash
./deploy/ec2-deploy.sh clean  # Automatically fixes migration issues
```

### AWS Permission Issues
```bash
./deploy/aws-iam-manager.sh test  # Check current AWS permissions
```

### Container Issues
```bash
./deploy/ec2-deploy.sh logs    # View container logs
./deploy/ec2-deploy.sh status  # Check status
./deploy/ec2-deploy.sh restart # Restart containers
```

## 📝 Script Features

### `ec2-deploy.sh`
- ✅ Automatic migration conflict detection
- ✅ Database backup before cleanup
- ✅ Health check monitoring
- ✅ Multiple IP detection methods
- ✅ Robust error handling

### `aws-iam-manager.sh`
- ✅ Dynamic configuration (no hardcoded values)
- ✅ Role-based policy generation
- ✅ Automatic credential extraction
- ✅ Clean resource management
- ✅ Comprehensive error handling

All scripts are designed to be efficient, secure, and maintainable.