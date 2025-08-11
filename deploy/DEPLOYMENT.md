# 🚀 Restaurant Web - Deployment Guide

## Quick Start

### Initial Setup
```bash
sudo ./setup-initial.sh
```

### Main Deployment
```bash
# Full deployment
sudo ./build-deploy.sh

# Frontend only
sudo ./build-deploy.sh --frontend-only

# Backend only  
sudo ./build-deploy.sh --backend-only
```

### SSL/HTTPS
```bash
sudo ./enable-ssl.sh
```

### Maintenance
```bash
# System status
./maintenance.sh --status

# Fix issues
./maintenance.sh --fix-all

# Restart services
./maintenance.sh --restart
```

### Diagnostics
```bash
./diagnose-connection.sh
```

### Final Fixes (if needed)
```bash
sudo ./final-fix.sh
```

## File Structure

- `build-deploy.sh` - Main deployment script
- `setup-initial.sh` - Initial project setup
- `maintenance.sh` - System maintenance tasks
- `enable-ssl.sh` - SSL configuration
- `final-fix.sh` - Final fixes and validation
- `diagnose-connection.sh` - Complete system diagnosis

## Troubleshooting

1. **Site not accessible**: Run `./diagnose-connection.sh`
2. **API errors**: Run `./maintenance.sh --fix-all`
3. **SSL issues**: Run `./enable-ssl.sh`
4. **Dashboard errors**: Check if user is logged in with AWS Cognito

## Support

For issues, check logs:
```bash
docker-compose logs -f
```
