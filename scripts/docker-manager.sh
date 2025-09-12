#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RESTAURANT WEB - DOCKER MANAGER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_NAME="restaurant-web"

# Functions
print_usage() {
    echo "Usage: $0 [ENVIRONMENT] [ACTION]"
    echo ""
    echo "ENVIRONMENTS:"
    echo "  dev, development    - Development environment"
    echo "  prod, production    - Production environment"
    echo ""
    echo "ACTIONS:"
    echo "  up                  - Start containers"
    echo "  down                - Stop containers"
    echo "  restart             - Restart containers"
    echo "  logs                - View logs"
    echo "  build               - Build containers"
    echo "  clean               - Clean containers and volumes"
    echo "  status              - Show container status"
    echo ""
    echo "Examples:"
    echo "  $0 dev up          - Start development environment"
    echo "  $0 prod build      - Build production containers"
    echo "  $0 dev logs        - View development logs"
}

print_banner() {
    echo -e "${BLUE}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🍽️  RESTAURANT WEB - Docker Manager"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${NC}"
}

validate_environment() {
    case $1 in
        dev|development)
            ENV="development"
            ENV_FILE=".env"
            COMPOSE_FILE="docker-compose.development.yml"
            CONTAINER_SUFFIX="dev"
            ;;
        prod|production)
            ENV="production"
            ENV_FILE=".env.production"
            COMPOSE_FILE="docker-compose.production.yml"
            CONTAINER_SUFFIX="prod"
            ;;
        *)
            echo -e "${RED}❌ Invalid environment: $1${NC}"
            print_usage
            exit 1
            ;;
    esac
}

check_prerequisites() {
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
        exit 1
    fi

    # Check if environment file exists
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${YELLOW}⚠️  Environment file $ENV_FILE not found.${NC}"
        echo -e "${YELLOW}   Copying from .env.example...${NC}"
        if [ -f ".env.example" ]; then
            cp .env.example "$ENV_FILE"
            echo -e "${GREEN}✅ Created $ENV_FILE from .env.example${NC}"
            echo -e "${YELLOW}⚠️  Please edit $ENV_FILE with your configuration${NC}"
        else
            echo -e "${RED}❌ No .env.example found. Cannot create $ENV_FILE${NC}"
            exit 1
        fi
    fi

    # Check if compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}❌ Docker compose file $COMPOSE_FILE not found.${NC}"
        exit 1
    fi
}

set_environment_vars() {
    export DOCKER_PROJECT_NAME="$PROJECT_NAME"
    export CONTAINER_SUFFIX="$CONTAINER_SUFFIX"
    export COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${CONTAINER_SUFFIX}"
    
    # Load environment variables
    if [ -f "$ENV_FILE" ]; then
        set -a
        source "$ENV_FILE"
        set +a
    fi
}

# Main actions
action_up() {
    echo -e "${GREEN}🚀 Starting $ENV environment...${NC}"
    docker-compose -f "$COMPOSE_FILE" up -d
    echo -e "${GREEN}✅ $ENV environment started${NC}"
    action_status
}

action_down() {
    echo -e "${YELLOW}🛑 Stopping $ENV environment...${NC}"
    docker-compose -f "$COMPOSE_FILE" down
    echo -e "${GREEN}✅ $ENV environment stopped${NC}"
}

action_restart() {
    echo -e "${YELLOW}🔄 Restarting $ENV environment...${NC}"
    docker-compose -f "$COMPOSE_FILE" restart
    echo -e "${GREEN}✅ $ENV environment restarted${NC}"
    action_status
}

action_logs() {
    echo -e "${BLUE}📋 Viewing logs for $ENV environment...${NC}"
    docker-compose -f "$COMPOSE_FILE" logs -f
}

action_build() {
    echo -e "${BLUE}🔨 Building $ENV containers...${NC}"
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    echo -e "${GREEN}✅ $ENV containers built${NC}"
}

action_clean() {
    echo -e "${RED}🧹 Cleaning $ENV environment...${NC}"
    read -p "This will remove all containers and volumes. Continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose -f "$COMPOSE_FILE" down -v --remove-orphans
        docker system prune -f
        echo -e "${GREEN}✅ $ENV environment cleaned${NC}"
    else
        echo -e "${YELLOW}❌ Clean operation cancelled${NC}"
    fi
}

action_status() {
    echo -e "${BLUE}📊 $ENV Environment Status:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    docker-compose -f "$COMPOSE_FILE" ps
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Main script
main() {
    print_banner

    # Check arguments
    if [ $# -lt 2 ]; then
        print_usage
        exit 1
    fi

    ENVIRONMENT=$1
    ACTION=$2

    # Validate and set environment
    validate_environment "$ENVIRONMENT"
    check_prerequisites
    set_environment_vars

    echo -e "${BLUE}📋 Configuration:${NC}"
    echo "   Environment: $ENV"
    echo "   Environment File: $ENV_FILE"
    echo "   Compose File: $COMPOSE_FILE"
    echo "   Project Name: $COMPOSE_PROJECT_NAME"
    echo ""

    # Execute action
    case $ACTION in
        up)
            action_up
            ;;
        down)
            action_down
            ;;
        restart)
            action_restart
            ;;
        logs)
            action_logs
            ;;
        build)
            action_build
            ;;
        clean)
            action_clean
            ;;
        status)
            action_status
            ;;
        *)
            echo -e "${RED}❌ Invalid action: $ACTION${NC}"
            print_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"