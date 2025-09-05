#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 EC2 Production Environment Setup Script
# Prepares EC2 instance for automated GitHub Actions deployment
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

# Configuration
readonly DOMAIN="www.xn--elfogndedonsoto-zrb.com"
readonly ALT_DOMAIN="xn--elfogndedonsoto-zrb.com"
readonly APP_DIR="/opt/restaurant-web"
readonly LOG_FILE="/var/log/ec2-production-setup.log"

log() {
    local level=$1; shift
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local color=$NC
    
    case $level in
        INFO)     color=$BLUE ;;
        SUCCESS)  color=$GREEN ;;
        WARNING)  color=$YELLOW ;;
        ERROR)    color=$RED ;;
    esac
    
    printf "${color}[%s]${NC} %s - %s\n" "$level" "$timestamp" "$*" | tee -a "$LOG_FILE"
}

log_info() { log INFO "$@"; }
log_success() { log SUCCESS "$@"; }
log_warning() { log WARNING "$@"; }
log_error() { log ERROR "$@"; exit 1; }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔧 SYSTEM PREPARATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

setup_system() {
    log_info "Setting up EC2 system for production deployment..."
    
    # Update system
    sudo apt-get update -y
    sudo apt-get upgrade -y
    
    # Install essential packages
    sudo apt-get install -y \
        curl \
        wget \
        git \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        python3 \
        python3-pip \
        sqlite3 \
        nginx \
        certbot \
        python3-certbot-nginx \
        fail2ban \
        ufw \
        htop \
        tree \
        jq
    
    log_success "System packages installed successfully"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🐳 DOCKER INSTALLATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

install_docker() {
    log_info "Installing Docker and Docker Compose..."
    
    # Remove old Docker versions
    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add ubuntu user to docker group
    sudo usermod -aG docker ubuntu
    
    # Start and enable Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Install Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Verify installation
    docker --version
    docker-compose --version
    
    log_success "Docker and Docker Compose installed successfully"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ☁️ AWS CLI INSTALLATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

install_aws_cli() {
    log_info "Installing AWS CLI v2..."
    
    # Download and install AWS CLI
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
    
    # Verify installation
    aws --version
    
    log_success "AWS CLI installed successfully"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📁 APPLICATION DIRECTORY SETUP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

setup_app_directory() {
    log_info "Setting up application directory structure..."
    
    # Create application directory
    sudo mkdir -p "$APP_DIR"
    sudo chown ubuntu:ubuntu "$APP_DIR"
    
    # Create subdirectories
    mkdir -p "$APP_DIR"/{data,logs,static,media,backups,docker}
    mkdir -p "$APP_DIR"/data/backups/enterprise
    mkdir -p "$APP_DIR"/logs/enterprise
    
    # Set proper permissions
    chmod 755 "$APP_DIR"
    chmod 750 "$APP_DIR"/data
    chmod 750 "$APP_DIR"/logs
    chmod 750 "$APP_DIR"/backups
    
    # Clone the repository (this will be updated by GitHub Actions)
    if [[ ! -d "$APP_DIR/.git" ]]; then
        git clone https://github.com/your-username/restaurant-web.git "$APP_DIR"
        cd "$APP_DIR"
        git checkout main
        chown -R ubuntu:ubuntu "$APP_DIR"
    fi
    
    log_success "Application directory setup completed"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔒 SSL CERTIFICATE SETUP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

setup_ssl_certificate() {
    log_info "Setting up SSL certificate with Let's Encrypt..."
    
    # Stop nginx if running
    sudo systemctl stop nginx 2>/dev/null || true
    
    # Create temporary nginx configuration
    sudo tee /etc/nginx/sites-available/default > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN $ALT_DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF
    
    # Create web root
    sudo mkdir -p /var/www/html
    sudo chown -R www-data:www-data /var/www/html
    
    # Start nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    # Obtain SSL certificate
    log_info "Obtaining SSL certificate for $DOMAIN and $ALT_DOMAIN..."
    
    if sudo certbot certonly \
        --webroot \
        --webroot-path /var/www/html \
        --email admin@$DOMAIN \
        --agree-tos \
        --non-interactive \
        --domains $DOMAIN,$ALT_DOMAIN; then
        
        log_success "SSL certificate obtained successfully"
        
        # Set up auto-renewal
        sudo systemctl enable certbot.timer
        sudo systemctl start certbot.timer
        
        # Test renewal
        sudo certbot renew --dry-run
        
    else
        log_warning "SSL certificate setup failed, continuing with HTTP setup"
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🛡️ SECURITY CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

setup_security() {
    log_info "Configuring security settings..."
    
    # Configure UFW firewall
    sudo ufw --force reset
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow 'Nginx Full'
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable
    
    # Configure fail2ban
    sudo tee /etc/fail2ban/jail.local > /dev/null << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF
    
    sudo systemctl restart fail2ban
    sudo systemctl enable fail2ban
    
    # Secure SSH configuration
    sudo sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
    sudo sed -i 's/^#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
    sudo systemctl restart sshd
    
    log_success "Security configuration completed"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📊 MONITORING SETUP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

setup_monitoring() {
    log_info "Setting up monitoring and logging..."
    
    # Configure log rotation
    sudo tee /etc/logrotate.d/restaurant-web > /dev/null << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
}
EOF
    
    # Create system monitoring script
    sudo tee /usr/local/bin/system-health-check.sh > /dev/null << 'EOF'
#!/bin/bash
MEMORY_THRESHOLD=85
DISK_THRESHOLD=85

MEMORY_USAGE=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')
DISK_USAGE=$(df / | awk 'NR==2 {print int($3/$2 * 100)}')

if [[ $MEMORY_USAGE -gt $MEMORY_THRESHOLD ]] || [[ $DISK_USAGE -gt $DISK_THRESHOLD ]]; then
    echo "$(date): HIGH RESOURCE USAGE - Memory: ${MEMORY_USAGE}%, Disk: ${DISK_USAGE}%" >> /var/log/resource-alerts.log
fi
EOF
    
    sudo chmod +x /usr/local/bin/system-health-check.sh
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/system-health-check.sh") | crontab -
    
    log_success "Monitoring setup completed"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 MAIN SETUP ORCHESTRATOR  
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

main() {
    echo -e "${BOLD}${BLUE}"
    cat << 'EOF'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 EC2 PRODUCTION ENVIRONMENT SETUP
   Preparing instance for GitHub Actions deployment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    echo -e "${NC}"
    
    # Create log file
    sudo touch "$LOG_FILE"
    sudo chown ubuntu:ubuntu "$LOG_FILE"
    
    log_info "Starting EC2 production environment setup..."
    
    # Execute setup phases
    setup_system
    install_docker
    install_aws_cli
    setup_app_directory
    setup_ssl_certificate
    setup_security
    setup_monitoring
    
    # Final system info
    echo -e "\n${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}✅ EC2 PRODUCTION SETUP COMPLETED SUCCESSFULLY${NC}"
    echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    echo -e "\n${BLUE}📊 SYSTEM INFORMATION:${NC}"
    echo -e "  • Domain: $DOMAIN"
    echo -e "  • Application Directory: $APP_DIR"
    echo -e "  • SSL Certificate: $([ -d "/etc/letsencrypt/live/$DOMAIN" ] && echo "✅ Configured" || echo "❌ Not configured")"
    echo -e "  • Docker: $(docker --version | cut -d' ' -f3)"
    echo -e "  • AWS CLI: $(aws --version | cut -d' ' -f1)"
    echo -e "  • Memory Usage: $(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')%"
    echo -e "  • Disk Usage: $(df / | awk 'NR==2 {print int($3/$2 * 100)}')%"
    
    echo -e "\n${YELLOW}🔧 NEXT STEPS:${NC}"
    echo -e "1. Configure GitHub Secrets (see docs/GITHUB_SECRETS.md)"
    echo -e "2. Update repository URL in this script if needed"
    echo -e "3. Push to main branch to trigger deployment"
    echo -e "4. Monitor deployment logs in GitHub Actions"
    
    echo -e "\n${BLUE}📋 LOGS LOCATION:${NC}"
    echo -e "  • Setup log: $LOG_FILE"
    echo -e "  • Application logs: $APP_DIR/logs/"
    echo -e "  • System alerts: /var/log/resource-alerts.log"
    
    log_success "EC2 production environment is ready for GitHub Actions deployment!"
}

# Execute setup if running directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi