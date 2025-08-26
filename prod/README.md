# 🚀 Production Deployment

Ultra-optimized deployment system for Restaurant Web application.

## Quick Start

```bash
# Deploy to production
./prod/deploy.sh deploy

# Health check only
./prod/deploy.sh check
```

## Features

✅ **Single SSH Session** - All operations in one connection  
✅ **Atomic Updates** - Zero downtime frontend deployments  
✅ **Smart Detection** - Only builds/deploys what changed  
✅ **EC2 Optimized** - Minimal memory usage, aggressive cleanup  
✅ **Parallel Operations** - Background cleanup during build  
✅ **Auto-commit** - Commits changes before deploy  

## Architecture

- **Target:** EC2 instance at `ec2-44-248-47-186.us-west-2.compute.amazonaws.com`
- **Path:** `/opt/restaurant-web`
- **Services:** Docker Compose (app + nginx)
- **Database:** SQLite with automatic backups

## Performance

- **Speed:** ~15-30s typical deployment
- **Memory:** 2GB Node.js limit (EC2 optimized)
- **Cleanup:** Keeps only 2 backups, current assets
- **Downtime:** Near-zero with atomic swaps

## What It Does

1. **Detects Changes** - Analyzes git diff for frontend/backend/migrations
2. **Parallel Cleanup** - Frees disk space while building
3. **Smart Build** - Only builds frontend if changed
4. **Atomic Deploy** - Stages → swaps frontend atomically
5. **Health Check** - Verifies deployment success

## Directory Structure

```
prod/
├── deploy.sh    # Single deployment script
└── README.md    # This file
```

## Requirements

- Git, npm, ssh, scp, curl
- SSH key: `ubuntu_fds_key.pem`
- Network access to EC2 instance

---
*Optimized for maximum efficiency and minimal EC2 resource usage*