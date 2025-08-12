#!/bin/bash

# Environment Configuration Script
# Sets up environment files for development, staging, or production

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$PROJECT_ROOT/config/environments"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}==== $1 ====${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 <environment> [options]"
    echo ""
    echo "Environments:"
    echo "  development  - Set up development environment"
    echo "  staging      - Set up staging environment"
    echo "  production   - Set up production environment"
    echo ""
    echo "Options:"
    echo "  --backend-only    Only configure backend"
    echo "  --frontend-only   Only configure frontend"
    echo "  --force          Overwrite existing files"
    echo "  --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 development"
    echo "  $0 production --backend-only"
    echo "  $0 staging --force"
}

# Function to backup existing file
backup_file() {
    local file="$1"
    if [ -f "$file" ]; then
        local backup="${file}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$file" "$backup"
        print_warning "Backed up existing file to $backup"
    fi
}

# Function to configure backend
configure_backend() {
    local env="$1"
    local force="$2"
    
    print_header "Configuring Backend Environment: $env"
    
    local source_file="$CONFIG_DIR/${env}.env"
    local target_file="$PROJECT_ROOT/backend/.env"
    
    if [ ! -f "$source_file" ]; then
        print_error "Source file not found: $source_file"
        return 1
    fi
    
    if [ -f "$target_file" ] && [ "$force" != "true" ]; then
        print_warning "Backend .env file already exists. Use --force to overwrite."
        return 1
    fi
    
    if [ -f "$target_file" ]; then
        backup_file "$target_file"
    fi
    
    cp "$source_file" "$target_file"
    print_status "Backend environment configured for $env"
    
    # Set appropriate permissions
    chmod 600 "$target_file"
    print_status "Set secure permissions on .env file"
}

# Function to configure frontend
configure_frontend() {
    local env="$1"
    local force="$2"
    
    print_header "Configuring Frontend Environment: $env"
    
    local source_file="$CONFIG_DIR/frontend-${env}.env"
    local target_file=""
    
    case "$env" in
        "development")
            target_file="$PROJECT_ROOT/frontend/.env.local"
            ;;
        "staging")
            target_file="$PROJECT_ROOT/frontend/.env.staging"
            ;;
        "production")
            target_file="$PROJECT_ROOT/frontend/.env.production"
            ;;
        *)
            print_error "Unknown environment: $env"
            return 1
            ;;
    esac
    
    if [ ! -f "$source_file" ]; then
        print_error "Source file not found: $source_file"
        return 1
    fi
    
    if [ -f "$target_file" ] && [ "$force" != "true" ]; then
        print_warning "Frontend environment file already exists. Use --force to overwrite."
        return 1
    fi
    
    if [ -f "$target_file" ]; then
        backup_file "$target_file"
    fi
    
    cp "$source_file" "$target_file"
    print_status "Frontend environment configured for $env"
    
    # Set appropriate permissions
    chmod 600 "$target_file"
}

# Function to validate environment
validate_environment() {
    local env="$1"
    
    print_header "Validating Environment Configuration"
    
    # Check backend .env
    local backend_env="$PROJECT_ROOT/backend/.env"
    if [ -f "$backend_env" ]; then
        print_status "✓ Backend .env file exists"
        
        # Check for required variables
        if grep -q "DJANGO_SECRET_KEY=" "$backend_env" && ! grep -q "DJANGO_SECRET_KEY=.*CHANGE" "$backend_env"; then
            print_status "✓ Django secret key is set"
        else
            print_warning "⚠ Django secret key needs to be configured"
        fi
        
        if grep -q "COGNITO_USER_POOL_ID=" "$backend_env" && ! grep -q "COGNITO_USER_POOL_ID=.*YOUR_POOL_ID" "$backend_env"; then
            print_status "✓ Cognito User Pool ID is configured"
        else
            print_warning "⚠ Cognito User Pool ID needs to be configured"
        fi
    else
        print_error "✗ Backend .env file not found"
    fi
    
    # Check frontend env
    local frontend_env=""
    case "$env" in
        "development")
            frontend_env="$PROJECT_ROOT/frontend/.env.local"
            ;;
        "staging")
            frontend_env="$PROJECT_ROOT/frontend/.env.staging"
            ;;
        "production")
            frontend_env="$PROJECT_ROOT/frontend/.env.production"
            ;;
    esac
    
    if [ -f "$frontend_env" ]; then
        print_status "✓ Frontend environment file exists"
        
        if grep -q "VITE_COGNITO_USER_POOL_ID=" "$frontend_env" && ! grep -q "VITE_COGNITO_USER_POOL_ID=.*YOUR_POOL_ID" "$frontend_env"; then
            print_status "✓ Frontend Cognito configuration is set"
        else
            print_warning "⚠ Frontend Cognito configuration needs to be updated"
        fi
    else
        print_error "✗ Frontend environment file not found"
    fi
}

# Function to show configuration summary
show_summary() {
    local env="$1"
    
    print_header "Configuration Summary"
    echo "Environment: $env"
    echo "Backend config: $PROJECT_ROOT/backend/.env"
    
    case "$env" in
        "development")
            echo "Frontend config: $PROJECT_ROOT/frontend/.env.local"
            ;;
        "staging")
            echo "Frontend config: $PROJECT_ROOT/frontend/.env.staging"
            ;;
        "production")
            echo "Frontend config: $PROJECT_ROOT/frontend/.env.production"
            ;;
    esac
    
    echo ""
    print_warning "Remember to:"
    echo "1. Update Cognito configuration with your actual values"
    echo "2. Set secure secret keys for production environments"
    echo "3. Configure database connection strings if needed"
    echo "4. Set up monitoring and logging for production"
}

# Main script logic
main() {
    local environment=""
    local backend_only=false
    local frontend_only=false
    local force=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            development|staging|production)
                environment="$1"
                shift
                ;;
            --backend-only)
                backend_only=true
                shift
                ;;
            --frontend-only)
                frontend_only=true
                shift
                ;;
            --force)
                force=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Validate arguments
    if [ -z "$environment" ]; then
        print_error "Environment must be specified"
        show_usage
        exit 1
    fi
    
    if [ "$backend_only" = true ] && [ "$frontend_only" = true ]; then
        print_error "Cannot specify both --backend-only and --frontend-only"
        exit 1
    fi
    
    # Check if config directory exists
    if [ ! -d "$CONFIG_DIR" ]; then
        print_error "Configuration directory not found: $CONFIG_DIR"
        exit 1
    fi
    
    print_header "Restaurant Web Environment Configuration"
    print_status "Configuring environment: $environment"
    
    # Configure components
    if [ "$frontend_only" != true ]; then
        configure_backend "$environment" "$force"
    fi
    
    if [ "$backend_only" != true ]; then
        configure_frontend "$environment" "$force"
    fi
    
    # Validate configuration
    validate_environment "$environment"
    
    # Show summary
    show_summary "$environment"
    
    print_status "Environment configuration completed!"
}

# Run main function
main "$@"