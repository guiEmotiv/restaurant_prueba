#!/bin/bash
# EC2 Initial Setup Script for Restaurant Web
# Run this script once on a new EC2 instance (Ubuntu/Amazon Linux compatible)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🏗️  Restaurant Web EC2 Initial Setup${NC}"
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
fi

# Update system
echo -e "${YELLOW}📦 Updating system packages...${NC}"
if [[ "$OS" == "Ubuntu"* ]]; then
    sudo apt update -y
    sudo apt upgrade -y
else
    sudo yum update -y
fi
echo -e "${GREEN}✅ System updated${NC}"

# Install basic utilities
echo -e "${YELLOW}🔧 Installing basic utilities...${NC}"
if [[ "$OS" == "Ubuntu"* ]]; then
    sudo apt install -y \
        git \
        curl \
        wget \
        unzip \
        htop \
        tree \
        jq \
        bc \
        ca-certificates \
        gnupg \
        lsb-release
else
    sudo yum install -y \
        git \
        curl \
        wget \
        unzip \
        htop \
        tree \
        jq \
        bc
fi
echo -e "${GREEN}✅ Basic utilities installed${NC}"

# Install Docker
echo -e "${YELLOW}🐳 Installing Docker...${NC}"
if [[ "$OS" == "Ubuntu"* ]]; then
    # Ubuntu Docker installation
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl start docker
    sudo systemctl enable docker
else
    # Amazon Linux Docker installation
    sudo yum install -y docker
    sudo systemctl start docker
    sudo systemctl enable docker
fi

# Add current user to docker group
sudo usermod -a -G docker $USER
echo -e "${GREEN}✅ Docker installed${NC}"

# Install Docker Compose (standalone for compatibility)
echo -e "${YELLOW}🐙 Installing Docker Compose...${NC}"
COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | jq -r .tag_name)
sudo curl -L "https://github.com/docker/compose/releases/download/$COMPOSE_VERSION/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create symlink for easy access
sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
echo -e "${GREEN}✅ Docker Compose installed${NC}"

# Install AWS CLI
echo -e "${YELLOW}☁️  Installing AWS CLI...${NC}"
if [[ "$OS" == "Ubuntu"* ]]; then
    # Check if already installed via apt
    if ! command -v aws &> /dev/null; then
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        sudo ./aws/install
        rm -rf aws awscliv2.zip
    fi
else
    # Amazon Linux
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
fi
echo -e "${GREEN}✅ AWS CLI installed${NC}"

# Install Node.js (for frontend builds if needed)
echo -e "${YELLOW}📦 Installing Node.js...${NC}"
if [[ "$OS" == "Ubuntu"* ]]; then
    # Ubuntu Node.js installation
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    # Amazon Linux Node.js installation
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs
fi
echo -e "${GREEN}✅ Node.js installed${NC}"

# Create application directory
echo -e "${YELLOW}📁 Creating application directories...${NC}"
sudo mkdir -p /opt/restaurant-web/{data,backups,logs,nginx/conf.d}
sudo chown -R $USER:$USER /opt/restaurant-web
echo -e "${GREEN}✅ Directories created${NC}"

# Setup log rotation for Docker
echo -e "${YELLOW}📝 Setting up log rotation...${NC}"
sudo tee /etc/logrotate.d/docker > /dev/null <<EOF
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
    create 644 root root
}
EOF
echo -e "${GREEN}✅ Log rotation configured${NC}"

# Setup basic firewall rules (optional)
echo -e "${YELLOW}🔥 Setting up basic firewall...${NC}"
if command -v ufw &> /dev/null; then
    sudo ufw --force enable
    sudo ufw allow 22/tcp    # SSH
    sudo ufw allow 80/tcp    # HTTP
    sudo ufw allow 443/tcp   # HTTPS
    sudo ufw allow 8000/tcp  # Django dev server
    echo -e "${GREEN}✅ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠️  UFW not available, skipping firewall setup${NC}"
fi

# Create useful aliases
echo -e "${YELLOW}⚙️  Creating useful aliases...${NC}"
tee ~/.bash_aliases > /dev/null <<EOF
# Restaurant Web aliases
alias rw-logs='docker-compose -f /opt/restaurant-web/docker-compose.yml logs -f'
alias rw-shell='docker-compose -f /opt/restaurant-web/docker-compose.yml exec app bash'
alias rw-django='docker-compose -f /opt/restaurant-web/docker-compose.yml exec app python manage.py shell'
alias rw-migrate='docker-compose -f /opt/restaurant-web/docker-compose.yml exec app python manage.py migrate'
alias rw-static='docker-compose -f /opt/restaurant-web/docker-compose.yml exec app python manage.py collectstatic --noinput'
alias rw-restart='cd /opt/restaurant-web && docker-compose restart'
alias rw-status='docker ps --filter name=restaurant'
alias rw-backup='sudo cp /opt/restaurant-web/data/*.sqlite3 /opt/restaurant-web/backups/backup-$(date +%Y%m%d-%H%M%S).sqlite3'

# Docker aliases
alias dps='docker ps'
alias dpa='docker ps -a'
alias di='docker images'
alias dc='docker-compose'
alias dcl='docker-compose logs -f'
alias dce='docker-compose exec'

# System aliases
alias ll='ls -la'
alias df='df -h'
alias du='du -h'
alias free='free -h'
EOF

# Source aliases
echo "source ~/.bash_aliases" >> ~/.bashrc
echo -e "${GREEN}✅ Aliases created${NC}"

# Create environment template
echo -e "${YELLOW}📄 Creating environment template...${NC}"
tee /opt/restaurant-web/.env.template > /dev/null <<EOF
# Restaurant Web Environment Configuration
# Copy this to .env.ec2 and update with your values

# AWS Cognito Configuration
AWS_REGION=us-west-2
COGNITO_USER_POOL_ID=your-user-pool-id
COGNITO_APP_CLIENT_ID=your-app-client-id

# Database Configuration
DATABASE_PATH=/opt/restaurant-web/data
DATABASE_NAME=restaurant_prod.sqlite3

# Django Configuration
DEBUG=False
USE_COGNITO_AUTH=True
SECRET_KEY=your-super-secret-key-here
ALLOWED_HOSTS=localhost,your-domain.com,your-ec2-ip

# Domain Configuration (optional)
DOMAIN_NAME=your-domain.com
EC2_PUBLIC_IP=your-ec2-ip

# Email Configuration (optional)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@domain.com
EMAIL_HOST_PASSWORD=your-email-password
EOF
echo -e "${GREEN}✅ Environment template created${NC}"

# Create backup script
echo -e "${YELLOW}💾 Creating backup script...${NC}"
tee /opt/restaurant-web/backup.sh > /dev/null <<'EOF'
#!/bin/bash
# Backup script for Restaurant Web

BACKUP_DIR="/opt/restaurant-web/backups"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="$BACKUP_DIR/backup-$DATE"

# Create backup directory
mkdir -p "$BACKUP_PATH"

# Backup database
if [ -f "/opt/restaurant-web/data/restaurant_prod.sqlite3" ]; then
    cp "/opt/restaurant-web/data/restaurant_prod.sqlite3" "$BACKUP_PATH/"
    echo "✅ Database backed up"
fi

# Backup environment files
if [ -f "/opt/restaurant-web/.env.ec2" ]; then
    cp "/opt/restaurant-web/.env.ec2" "$BACKUP_PATH/"
    echo "✅ Environment file backed up"
fi

# Compress backup
cd "$BACKUP_DIR"
tar -czf "backup-$DATE.tar.gz" "backup-$DATE"
rm -rf "backup-$DATE"

echo "✅ Backup completed: backup-$DATE.tar.gz"

# Keep only last 7 backups
ls -t backup-*.tar.gz | tail -n +8 | xargs -r rm
echo "✅ Old backups cleaned up"
EOF

chmod +x /opt/restaurant-web/backup.sh
echo -e "${GREEN}✅ Backup script created${NC}"

# Setup cron job for automated backups
echo -e "${YELLOW}⏰ Setting up automated backups...${NC}"
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/restaurant-web/backup.sh >> /opt/restaurant-web/logs/backup.log 2>&1") | crontab -
echo -e "${GREEN}✅ Daily backups scheduled at 2:00 AM${NC}"

# Create deployment info script
tee /opt/restaurant-web/info.sh > /dev/null <<'EOF'
#!/bin/bash
# Display deployment information

echo "🏗️  Restaurant Web Deployment Info"
echo "=================================="
echo ""

echo "📊 System Information:"
echo "  OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "  Kernel: $(uname -r)"
echo "  Uptime: $(uptime -p)"
echo "  Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "  Disk: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')"
echo ""

echo "🐳 Docker Information:"
echo "  Version: $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
echo "  Compose: $(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)"
echo "  Running containers: $(docker ps | wc -l | awk '{print $1-1}')"
echo ""

echo "🏃 Application Status:"
if docker ps | grep -q restaurant; then
    echo "  Status: ✅ Running"
    echo "  Containers:"
    docker ps --filter name=restaurant --format "    - {{.Names}}: {{.Status}}"
else
    echo "  Status: ❌ Not running"
fi
echo ""

echo "📁 Storage Information:"
echo "  Data directory: /opt/restaurant-web/data"
if [ -f "/opt/restaurant-web/data/restaurant_prod.sqlite3" ]; then
    echo "  Database size: $(du -h /opt/restaurant-web/data/restaurant_prod.sqlite3 | cut -f1)"
fi
echo "  Backups: $(ls /opt/restaurant-web/backups/*.tar.gz 2>/dev/null | wc -l) files"
echo "  Logs directory: /opt/restaurant-web/logs"
echo ""

echo "🔧 Quick Commands:"
echo "  View logs: rw-logs"
echo "  Shell access: rw-shell"
echo "  Django shell: rw-django"
echo "  Restart app: rw-restart"
echo "  Create backup: rw-backup"
EOF

chmod +x /opt/restaurant-web/info.sh
echo -e "${GREEN}✅ Info script created${NC}"

# Final message
echo ""
echo -e "${GREEN}🎉 EC2 setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "${BLUE}1. Copy .env.template to .env.ec2 and configure your settings${NC}"
echo -e "${BLUE}2. Configure AWS credentials: aws configure${NC}"
echo -e "${BLUE}3. Deploy your application: ./scripts/deploy-ec2.sh${NC}"
echo -e "${BLUE}4. Check deployment info: /opt/restaurant-web/info.sh${NC}"
echo ""
echo -e "${BLUE}🔧 Useful files:${NC}"
echo -e "${BLUE}  Environment template: /opt/restaurant-web/.env.template${NC}"
echo -e "${BLUE}  Backup script: /opt/restaurant-web/backup.sh${NC}"
echo -e "${BLUE}  Info script: /opt/restaurant-web/info.sh${NC}"
echo ""
echo -e "${YELLOW}⚠️  Remember to logout and login again to apply Docker group changes!${NC}"