# 🚀 Restaurant Web Deployment Scripts

Optimized deployment scripts for EC2 production environment.

## 📋 Available Scripts

### 🎯 Main Scripts

- **`setup-ec2-complete.sh`** - Master script with interactive menu
- **`deploy-optimized.sh`** - Optimized deployment with minimal resource usage
- **`cleanup-ec2.sh`** - Free up disk space and clean system
- **`configure-cognito.sh`** - Configure AWS Cognito authentication

### 🔧 Utility Scripts

- **`setup-node-version.sh`** - Install/update Node.js to compatible version
- **`setup-cognito-dependencies-ec2.sh`** - Legacy Cognito setup (deprecated)

## 🚀 Quick Start

### For First Time Setup
```bash
sudo ./deploy/setup-ec2-complete.sh
# Choose option 1: Complete setup
```

### For Regular Updates
```bash
cd /opt/restaurant-web
git pull origin main
./deploy/deploy-optimized.sh
```

### If Low on Disk Space
```bash
sudo ./deploy/cleanup-ec2.sh
```

## 📊 Script Details

### setup-ec2-complete.sh
Interactive master script with options:
1. **Complete setup** - Full first-time setup
2. **Quick cleanup and deploy** - Fast update
3. **Only cleanup** - Free disk space
4. **Only configure Cognito** - Authentication setup
5. **Only deploy** - Application deployment
6. **Setup Node.js** - Install/update Node.js

### deploy-optimized.sh
Efficient deployment process:
- ✅ Disk space validation
- ✅ Minimal npm installs (production only)
- ✅ Optimized Vite builds
- ✅ Docker container management
- ✅ Health checks

### cleanup-ec2.sh
Comprehensive cleanup:
- 🧹 Docker system cleanup
- 📦 npm cache clearing
- 🗂️ node_modules removal
- 🐍 Python cache cleanup
- 📝 Log file cleanup
- 🔧 Git optimization

### configure-cognito.sh
Safe Cognito configuration:
- 🔐 Interactive credential input
- 📄 Environment file updates
- ✅ Input validation
- 🔒 Option to disable authentication

## 🔐 AWS Cognito Setup

### Required AWS Resources
1. **Cognito User Pool** with username sign-in
2. **App Client** (public, no secret)
3. **User Groups**: `administradores`, `meseros`
4. **Users** assigned to appropriate groups

### Configuration Values
- **AWS Region**: Where your Cognito resources are located
- **User Pool ID**: Format `region_poolId` (e.g., `us-west-2_abcd1234`)
- **App Client ID**: Long alphanumeric string

## 📁 Environment Files

Scripts automatically update:
- `backend/.env` - Django backend configuration
- `frontend/.env` - React frontend configuration

## 🐛 Troubleshooting

### Low Disk Space
```bash
df -h  # Check available space
sudo ./deploy/cleanup-ec2.sh
```

### Node.js Version Issues
```bash
node --version  # Check current version
./deploy/setup-node-version.sh  # Update if needed
```

### Build Failures
```bash
# Clean and rebuild
rm -rf frontend/node_modules frontend/package-lock.json
./deploy/deploy-optimized.sh
```

### Cognito Authentication Issues
```bash
# Reconfigure Cognito
./deploy/configure-cognito.sh
# Or disable temporarily (option 2)
```

## 📊 Resource Requirements

### Minimum EC2 Requirements
- **Instance**: t3.micro or larger
- **Storage**: 8GB+ available disk space
- **Memory**: 1GB+ RAM
- **Node.js**: v20+ (automatically installed)

### Optimizations Included
- Production-only npm installs
- Aggressive cleanup routines
- Docker resource management
- Efficient build processes
- Health check validations

## 🔒 Security Notes

- Scripts never expose sensitive credentials in logs
- Environment files are created with proper permissions
- Interactive prompts for sensitive data
- Option to disable authentication for testing

## 📞 Support

If you encounter issues:
1. Check disk space with `df -h`
2. Review script output for specific errors
3. Run cleanup script before retrying
4. Ensure proper AWS Cognito configuration