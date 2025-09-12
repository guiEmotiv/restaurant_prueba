#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 PRODUCTION DEPLOYMENT ORCHESTRATOR - OPTIMIZED v2.0
# Restaurant Web Application - Efficient & Clean Deployment
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔧 CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

readonly DEPLOY_ID="$(date +%Y%m%d_%H%M%S)"
export SSH_KEY="./ubuntu_fds_key.pem"
export PROD_SERVER="ubuntu@44.248.47.186"
export REMOTE_DIR="/home/ubuntu/restaurant-web"
export DOMAIN="www.xn--elfogndedonsoto-zrb.com"

# Performance settings
export MIN_FREE_SPACE_GB=2
export MIN_FREE_MEMORY_MB=500
export MAX_DOCKER_LOG_SIZE="50m"

# Colors - Export for use in child scripts
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export NC='\033[0m'

# Scripts directory
readonly SCRIPTS_DIR="./scripts/prod"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📝 LOGGING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_info() { printf "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_success() { printf "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_warning() { printf "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }
log_error() { printf "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; exit 1; }
log_deploy() { printf "${CYAN}[DEPLOY]${NC} $(date '+%Y-%m-%d %H:%M:%S') - %s\n" "$*"; }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔧 UTILITY FUNCTIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Clean server resources before deployment
clean_server_resources() {
    log_deploy "🧹 Cleaning server resources..."
    
    # Check current resource usage
    log_info "Checking server resources..."
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << 'EOF'
        export PATH=/usr/bin:/bin:/usr/sbin:/sbin
        echo "📊 Current Resource Usage:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Memory info
        echo "💾 Memory:"
        /usr/bin/free -h | /bin/grep -E "^Mem|^Swap"
        
        # Disk usage
        echo -e "\n💿 Disk Usage:"
        /bin/df -h / | /bin/grep -v Filesystem
        
        # Docker disk usage
        echo -e "\n🐳 Docker Disk Usage:"
        /usr/bin/docker system df 2>/dev/null || echo "Docker not running"
EOF
    
    # Clean Docker resources
    log_info "Cleaning Docker resources..."
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << 'EOF'
        export PATH=/usr/bin:/bin:/usr/sbin:/sbin
        set -e
        
        # Stop all containers gracefully
        if [[ $(/usr/bin/docker ps -q | /usr/bin/wc -l) -gt 0 ]]; then
            echo "Stopping running containers..."
            /usr/bin/docker stop $(/usr/bin/docker ps -q) 2>/dev/null || true
        fi
        
        # Remove stopped containers
        echo "Removing stopped containers..."
        /usr/bin/docker container prune -f 2>/dev/null || true
        
        # Remove unused images (keep last 2 versions)
        echo "Removing old Docker images..."
        /usr/bin/docker images | /bin/grep restaurant-web | /usr/bin/tail -n +3 | /usr/bin/awk '{print $3}' | /usr/bin/xargs -r /usr/bin/docker rmi -f 2>/dev/null || true
        
        # Remove dangling images
        /usr/bin/docker image prune -f 2>/dev/null || true
        
        # Remove unused volumes (careful - preserves named volumes)
        echo "Cleaning unused volumes..."
        /usr/bin/docker volume prune -f 2>/dev/null || true
        
        # Remove build cache older than 24h
        echo "Cleaning build cache..."
        /usr/bin/docker builder prune -f --filter "until=24h" 2>/dev/null || true
        
        # Clean Docker logs
        echo "Truncating Docker logs..."
        /usr/bin/find /var/lib/docker/containers -name "*.log" -exec /usr/bin/truncate -s 0 {} \; 2>/dev/null || true
EOF
    
    # Clean system resources
    log_info "Cleaning system resources..."
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << 'EOF'
        # Clean apt cache
        sudo apt-get clean 2>/dev/null || true
        sudo apt-get autoremove -y 2>/dev/null || true
        
        # Clean journal logs older than 2 days
        sudo journalctl --vacuum-time=2d 2>/dev/null || true
        
        # Clean temp files
        find /tmp -type f -mtime +2 -delete 2>/dev/null || true
        
        # Clean npm/yarn cache if exists
        npm cache clean --force 2>/dev/null || true
        yarn cache clean 2>/dev/null || true
EOF
    
    # Verify resources after cleaning
    log_info "Resources after cleaning:"
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" << 'EOF'
        echo "━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "📊 Resources After Cleaning:"
        free -h | grep "^Mem"
        df -h / | grep -v Filesystem
        docker system df 2>/dev/null | head -n 2 || echo "Docker cleaned"
EOF
    
    # Check if we have enough resources
    local free_space=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" \
        "df / | tail -1 | awk '{print int(\$4/1024/1024)}'")
    local free_memory=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" \
        "free -m | grep '^Mem' | awk '{print \$4}'")
    
    if [[ $free_space -lt $MIN_FREE_SPACE_GB ]]; then
        log_error "Insufficient disk space: ${free_space}GB (need ${MIN_FREE_SPACE_GB}GB)"
    fi
    
    if [[ $free_memory -lt $MIN_FREE_MEMORY_MB ]]; then
        log_warning "Low memory: ${free_memory}MB (recommended ${MIN_FREE_MEMORY_MB}MB)"
    fi
    
    log_success "✅ Server resources cleaned successfully"
}

execute_phase() {
    local phase_num="$1"
    local phase_name="$2"
    local script_path="$SCRIPTS_DIR/${phase_num}-${phase_name}.sh"
    
    if [[ ! -f "$script_path" ]]; then
        log_error "Script not found: $script_path"
    fi
    
    if [[ ! -x "$script_path" ]]; then
        chmod +x "$script_path"
    fi
    
    log_deploy "Executing Phase $phase_num: $phase_name"
    
    # Source the script to execute its function
    source "$script_path"
    
    # Call the main function from the script
    local function_name=""
    case "$phase_name" in
        "validate") function_name="validate_environment";;
        "build-frontend") function_name="build_frontend";;
        "prepare-server") function_name="prepare_server";;
        "deploy-git") function_name="deploy_with_git";;
        "deploy-containers") function_name="deploy_containers";;
        "validate") function_name="validate_deployment";;
    esac
    
    if [[ -n "$function_name" ]] && declare -f "$function_name" > /dev/null; then
        "$function_name"
    else
        log_error "Function $function_name not found in $script_path"
    fi
}

check_prerequisites() {
    log_info "🔍 Checking prerequisites..."
    
    # Check if scripts directory exists
    [[ -d "$SCRIPTS_DIR" ]] || log_error "Scripts directory not found: $SCRIPTS_DIR"
    
    # Check if all required scripts exist
    local required_scripts=(
        "01-validate"
        "02-build-frontend"
        "03-prepare-server" 
        "04-deploy-git"
        "05-deploy-containers"
        "06-validate"
    )
    
    for script in "${required_scripts[@]}"; do
        [[ -f "$SCRIPTS_DIR/$script.sh" ]] || log_error "Required script missing: $SCRIPTS_DIR/$script.sh"
    done
    
    log_success "All prerequisites checked"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 MAIN EXECUTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🚀 PRODUCTION DEPLOYMENT - OPTIMIZED v2.0"
    echo "   Restaurant Web Application - Efficient & Clean"  
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    log_deploy "Deployment started: $(date '+%Y-%m-%d %H:%M:%S')"
    log_deploy "Deploy ID: $DEPLOY_ID"
    log_deploy "Target: $DOMAIN"
    log_deploy "Architecture: Optimized Modular (7 phases)"
    
    # Check prerequisites
    check_prerequisites
    
    # PHASE 0: Clean server resources FIRST
    log_deploy "🧹 PHASE 0: Server Resource Cleanup"
    clean_server_resources
    
    # Execute deployment phases
    execute_phase "01" "validate"
    execute_phase "02" "build-frontend"  
    execute_phase "03" "prepare-server"
    execute_phase "04" "deploy-git"
    execute_phase "05" "deploy-containers"
    
    # Final validation
    log_deploy "Starting final validation..."
    if execute_phase "06" "validate"; then
        log_success "🎉 DEPLOYMENT SUCCESSFUL!"
        echo ""
        echo "🌐 Application: https://$DOMAIN/"
        echo "🔧 Admin: https://$DOMAIN/admin/"
        echo "📊 API: https://$DOMAIN/api/v1/"
        echo "📋 Deploy ID: $DEPLOY_ID"
        echo ""
        
        # Show final resource usage
        log_info "📊 Final Resource Status:"
        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROD_SERVER" \
            "free -h | grep '^Mem' && df -h / | grep -v Filesystem && docker ps --format 'table {{.Names}}\t{{.Status}}'"
        
        exit 0
    else
        log_warning "⚠️ DEPLOYMENT COMPLETED WITH WARNINGS"
        echo "📋 Deploy ID: $DEPLOY_ID"
        exit 1
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎮 COMMAND LINE OPTIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

show_help() {
    cat << EOF
🚀 Production Deployment Script - Optimized v2.0

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --help, -h          Show this help message
    --phase PHASE       Execute only a specific phase (0-6)
    --list-phases       List all available phases
    --dry-run          Show what would be executed without running
    --clean-only        Only clean server resources and exit
    --skip-clean        Skip resource cleanup phase

PHASES:
    0  clean-resources    Server resource cleanup (memory, disk, docker)
    1  validate           Environment validation
    2  build-frontend     Frontend build process  
    3  prepare-server     Server preparation and cleanup
    4  deploy-git         Git deployment and file sync
    5  deploy-containers  Docker build and deployment
    6  validate          Post-deployment validation

EXAMPLES:
    $0                    # Full deployment with cleanup
    $0 --clean-only       # Only clean server resources
    $0 --skip-clean       # Deploy without cleanup
    $0 --phase 0          # Only clean resources
    $0 --phase 2          # Only build frontend
    $0 --list-phases      # Show all phases
    $0 --dry-run          # Show execution plan

TARGET: $DOMAIN
SERVER: $PROD_SERVER
EOF
}

list_phases() {
    echo "Available deployment phases:"
    echo "  00-clean-resources    🧹  Server resource cleanup"
    echo "  01-validate.sh        🛡️  Environment validation"
    echo "  02-build-frontend.sh  🏗️  Frontend build process"  
    echo "  03-prepare-server.sh  🚀  Server preparation"
    echo "  04-deploy-git.sh      📦  Git deployment"
    echo "  05-deploy-containers.sh 🐳  Docker deployment"
    echo "  06-validate.sh        ✅  Post-deployment validation"
}

# Parse command line arguments
SKIP_CLEAN=false
CLEAN_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --phase)
            if [[ -n "${2:-}" ]] && [[ "$2" =~ ^[0-6]$ ]]; then
                PHASE="$2"
                shift 2
            else
                log_error "Invalid phase number. Use 0-6."
            fi
            ;;
        --list-phases)
            list_phases
            exit 0
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-clean)
            SKIP_CLEAN=true
            shift
            ;;
        --clean-only)
            CLEAN_ONLY=true
            shift
            ;;
        *)
            log_error "Unknown option: $1. Use --help for usage."
            ;;
    esac
done

# Execute based on options
if [[ "$CLEAN_ONLY" == "true" ]]; then
    # Only clean server resources
    log_deploy "🧹 Running server cleanup only..."
    check_prerequisites
    clean_server_resources
    log_success "✅ Server cleanup completed successfully"
    exit 0
elif [[ -n "${PHASE:-}" ]]; then
    # Execute single phase
    check_prerequisites
    case "$PHASE" in
        0) clean_server_resources;;
        1) execute_phase "01" "validate";;
        2) execute_phase "02" "build-frontend";;
        3) execute_phase "03" "prepare-server";;
        4) execute_phase "04" "deploy-git";;
        5) execute_phase "05" "deploy-containers";;
        6) execute_phase "06" "validate";;
    esac
elif [[ "${DRY_RUN:-false}" == "true" ]]; then
    # Show what would be executed
    echo "🔍 Dry run - execution plan:"
    list_phases
    echo ""
    echo "Target: $DOMAIN"
    echo "Server: $PROD_SERVER"
    echo "Deploy ID: $DEPLOY_ID"
    echo "Skip Clean: $SKIP_CLEAN"
else
    # Execute full deployment with conditional cleanup
    if [[ "$SKIP_CLEAN" == "true" ]]; then
        # Modified main without cleanup
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🚀 PRODUCTION DEPLOYMENT - OPTIMIZED v2.0 (No Cleanup)"
        echo "   Restaurant Web Application - Efficient & Clean"  
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        log_deploy "Deployment started: $(date '+%Y-%m-%d %H:%M:%S')"
        log_deploy "Deploy ID: $DEPLOY_ID"
        log_deploy "Target: $DOMAIN"
        log_warning "⚠️ Skipping resource cleanup phase"
        
        check_prerequisites
        
        # Execute deployment phases without cleanup
        execute_phase "01" "validate"
        execute_phase "02" "build-frontend"  
        execute_phase "03" "prepare-server"
        execute_phase "04" "deploy-git"
        execute_phase "05" "deploy-containers"
        
        # Final validation
        log_deploy "Starting final validation..."
        if execute_phase "06" "validate"; then
            log_success "🎉 DEPLOYMENT SUCCESSFUL!"
            echo ""
            echo "🌐 Application: https://$DOMAIN/"
            echo "📋 Deploy ID: $DEPLOY_ID"
            exit 0
        else
            log_warning "⚠️ DEPLOYMENT COMPLETED WITH WARNINGS"
            exit 1
        fi
    else
        # Execute full deployment with cleanup
        main "$@"
    fi
fi