#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# Frontend Deployment Script for Restaurant Management System
# Builds React app and deploys to S3 with CloudFront invalidation
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
FRONTEND_DIR="frontend"
BUILD_DIR="$FRONTEND_DIR/dist"
LOG_FILE="/var/log/frontend-deployment.log"

# Functions
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}" | tee -a "$LOG_FILE"
}

check_requirements() {
    log "Checking frontend deployment requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js first."
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed. Please install npm first."
    fi
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed. Please install AWS CLI first."
    fi
    
    # Check if frontend directory exists
    if [[ ! -d "$FRONTEND_DIR" ]]; then
        error "Frontend directory not found: $FRONTEND_DIR"
    fi
    
    # Check package.json
    if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
        error "package.json not found in $FRONTEND_DIR"
    fi
    
    # Check .env file for AWS credentials
    if [[ ! -f .env ]]; then
        error "Environment file .env not found. Please create it from .env.example"
    fi
    
    # Load environment variables
    set -a
    source .env
    set +a
    
    # Check AWS credentials (optional for S3 deployment)
    if [[ -n "${AWS_ACCESS_KEY_ID:-}" ]] && [[ -n "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
        if [[ -z "${AWS_S3_BUCKET_NAME:-}" ]]; then
            error "AWS credentials found but AWS_S3_BUCKET_NAME not found in .env file"
        fi
        info "AWS credentials configured - S3 deployment available"
    else
        info "AWS credentials not configured - local deployment only"
    fi
    
    log "✓ All requirements met"
}

install_dependencies() {
    log "Installing frontend dependencies..."
    
    cd "$FRONTEND_DIR"
    
    # Check if node_modules exists and package-lock.json is newer
    if [[ -f package-lock.json ]] && [[ -d node_modules ]]; then
        if [[ package-lock.json -nt node_modules ]]; then
            warning "package-lock.json is newer than node_modules, running clean install"
            rm -rf node_modules
            npm ci
        else
            info "Dependencies are up to date"
        fi
    else
        npm ci
    fi
    
    cd ..
    log "✓ Dependencies installed"
}

run_tests() {
    log "Running frontend tests..."
    
    cd "$FRONTEND_DIR"
    
    # Check if test script exists
    if npm run --silent 2>/dev/null | grep -q "test"; then
        npm run test -- --passWithNoTests --watchAll=false
        log "✓ Tests passed"
    else
        warning "No test script found, skipping tests"
    fi
    
    cd ..
}

lint_code() {
    log "Running code linting..."
    
    cd "$FRONTEND_DIR"
    
    # Check if lint script exists
    if npm run --silent 2>/dev/null | grep -q "lint"; then
        npm run lint
        log "✓ Linting passed"
    else
        warning "No lint script found, skipping linting"
    fi
    
    cd ..
}

build_frontend() {
    log "Building frontend application..."
    
    cd "$FRONTEND_DIR"
    
    # Clean previous build
    if [[ -d dist ]]; then
        rm -rf dist
        info "Cleaned previous build"
    fi
    
    # Set production environment variables for build
    export NODE_ENV=production
    export VITE_API_URL="${BACKEND_API_URL:-http://localhost:8000}"
    
    # Build the application
    npm run build
    
    # Verify build was successful
    if [[ ! -d dist ]] || [[ -z "$(ls -A dist)" ]]; then
        error "Build failed - dist directory is empty or doesn't exist"
    fi
    
    cd ..
    log "✓ Frontend build completed"
}

deploy_to_s3() {
    # Check if AWS is configured
    if [[ -z "${AWS_ACCESS_KEY_ID:-}" ]] || [[ -z "${AWS_SECRET_ACCESS_KEY:-}" ]] || [[ -z "${AWS_S3_BUCKET_NAME:-}" ]]; then
        warning "AWS not configured - skipping S3 deployment"
        info "Frontend build is available at: $BUILD_DIR"
        return 0
    fi
    
    log "Deploying to S3..."
    
    # Configure AWS CLI with credentials from .env
    export AWS_ACCESS_KEY_ID
    export AWS_SECRET_ACCESS_KEY
    export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
    
    # Sync build files to S3
    info "Uploading files to S3 bucket: $AWS_S3_BUCKET_NAME"
    
    # Upload with appropriate cache headers
    aws s3 sync "$BUILD_DIR" "s3://$AWS_S3_BUCKET_NAME/frontend" \
        --delete \
        --cache-control "public,max-age=31536000" \
        --exclude "*.html" \
        --exclude "service-worker.js" \
        --exclude "manifest.json"
    
    # Upload HTML files with shorter cache duration
    aws s3 sync "$BUILD_DIR" "s3://$AWS_S3_BUCKET_NAME/frontend" \
        --delete \
        --cache-control "public,max-age=0,must-revalidate" \
        --include "*.html" \
        --include "service-worker.js" \
        --include "manifest.json"
    
    # Set website configuration
    aws s3 website "s3://$AWS_S3_BUCKET_NAME" \
        --index-document index.html \
        --error-document index.html
    
    log "✓ Files uploaded to S3"
}

invalidate_cloudfront() {
    log "Invalidating CloudFront cache..."
    
    # Check if CloudFront distribution ID is set
    if [[ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
        aws cloudfront create-invalidation \
            --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
            --paths "/*" \
            --query 'Invalidation.Id' \
            --output text
        log "✓ CloudFront cache invalidated"
    else
        warning "CLOUDFRONT_DISTRIBUTION_ID not set, skipping cache invalidation"
        info "Your site will be available at: https://$AWS_S3_BUCKET_NAME.s3.amazonaws.com/frontend/index.html"
    fi
}

verify_deployment() {
    log "Verifying deployment..."
    
    # Check if index.html exists in S3
    if aws s3 ls "s3://$AWS_S3_BUCKET_NAME/frontend/index.html" >/dev/null 2>&1; then
        log "✓ index.html found in S3"
    else
        error "index.html not found in S3 bucket"
    fi
    
    # Get S3 website URL
    local s3_website_url="https://$AWS_S3_BUCKET_NAME.s3.amazonaws.com/frontend/index.html"
    
    # Test if the website is accessible
    if curl -s -o /dev/null -w "%{http_code}" "$s3_website_url" | grep -q "200"; then
        log "✓ Website is accessible"
        info "Frontend deployed successfully!"
        info "URL: $s3_website_url"
    else
        warning "Website may not be immediately accessible (S3 propagation delay)"
        info "URL: $s3_website_url"
    fi
}

show_deployment_info() {
    log "=== Frontend Deployment Info ==="
    info "S3 Bucket: $AWS_S3_BUCKET_NAME"
    info "Frontend URL: https://$AWS_S3_BUCKET_NAME.s3.amazonaws.com/frontend/index.html"
    
    if [[ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
        info "CloudFront Distribution: $CLOUDFRONT_DISTRIBUTION_ID"
        info "CloudFront URL: https://$(aws cloudfront get-distribution --id "$CLOUDFRONT_DISTRIBUTION_ID" --query 'Distribution.DomainName' --output text)"
    fi
    
    info "Build size:"
    du -sh "$BUILD_DIR" 2>/dev/null || echo "Build directory not found"
    
    info "Build files:"
    ls -la "$BUILD_DIR" 2>/dev/null || echo "Build directory not found"
}

# Main deployment process
main() {
    log "Starting frontend deployment..."
    
    check_requirements
    install_dependencies
    lint_code
    run_tests
    build_frontend
    deploy_to_s3
    invalidate_cloudfront
    verify_deployment
    show_deployment_info
    
    log "🚀 Frontend deployment completed successfully!"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "build")
        check_requirements
        install_dependencies
        lint_code
        build_frontend
        log "✓ Build completed"
        ;;
    "test")
        check_requirements
        install_dependencies
        run_tests
        ;;
    "lint")
        check_requirements
        install_dependencies
        lint_code
        ;;
    "upload")
        if [[ ! -d "$BUILD_DIR" ]]; then
            error "Build directory not found. Run 'build' first."
        fi
        check_requirements
        deploy_to_s3
        invalidate_cloudfront
        verify_deployment
        ;;
    "info")
        show_deployment_info
        ;;
    *)
        echo "Usage: $0 [deploy|build|test|lint|upload|info]"
        echo ""
        echo "Commands:"
        echo "  deploy  - Full frontend deployment (default)"
        echo "  build   - Build frontend only"
        echo "  test    - Run tests only"
        echo "  lint    - Run linting only"
        echo "  upload  - Upload existing build to S3"
        echo "  info    - Show deployment information"
        exit 1
        ;;
esac