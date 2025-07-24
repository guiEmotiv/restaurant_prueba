#!/bin/bash

# AWS IAM Manager for Restaurant System
# Dynamic script without hardcoded values

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration - can be overridden with environment variables
PROJECT_NAME="${PROJECT_NAME:-restaurant}"
AWS_REGION="${AWS_REGION:-us-east-1}"
POLICY_PATH="${POLICY_PATH:-/${PROJECT_NAME}/}"
USER_PATH="${USER_PATH:-/${PROJECT_NAME}/}"

# Get AWS account ID dynamically
get_account_id() {
    aws sts get-caller-identity --query Account --output text 2>/dev/null || {
        echo "❌ Cannot get AWS account ID. Check AWS CLI configuration." >&2
        exit 1
    }
}

# Print functions
print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Help function
show_help() {
    cat << 'EOF'
AWS IAM Manager for Restaurant System

Usage: ./aws-iam-manager.sh [COMMAND] [OPTIONS]

Commands:
  create      Create all IAM users and policies
  delete      Delete all IAM users and policies
  list        List existing users and policies
  test        Test current AWS permissions
  help        Show this help

Environment Variables:
  PROJECT_NAME    Project prefix (default: restaurant)
  AWS_REGION      AWS region (default: us-east-1)
  POLICY_PATH     IAM policy path (default: /restaurant/)
  USER_PATH       IAM user path (default: /restaurant/)

Examples:
  ./aws-iam-manager.sh create
  PROJECT_NAME=myapp ./aws-iam-manager.sh create
  ./aws-iam-manager.sh list
  ./aws-iam-manager.sh delete

EOF
}

# Test AWS permissions
test_permissions() {
    print_info "Testing AWS permissions..."
    
    local required_actions=(
        "iam:CreateUser"
        "iam:CreatePolicy"
        "iam:CreateAccessKey"
        "iam:AttachUserPolicy"
        "iam:ListUsers"
        "iam:ListPolicies"
    )
    
    if aws sts get-caller-identity >/dev/null 2>&1; then
        print_status "AWS CLI configured correctly"
        print_info "Account: $(get_account_id)"
        print_info "User: $(aws sts get-caller-identity --query Arn --output text)"
    else
        print_error "AWS CLI not configured or no permissions"
        return 1
    fi
    
    print_info "Note: Some permission checks require actual resource creation to verify"
}

# Define user roles dynamically
get_user_config() {
    cat << EOF
admin:Administrador:Sistema:admin@${PROJECT_NAME}.com:*
mesero1:Carlos:Mesero:mesero1@${PROJECT_NAME}.com:orders,kitchen
mesero2:Ana:Mesero:mesero2@${PROJECT_NAME}.com:orders,kitchen
cajero1:Luis:Cajero:cajero1@${PROJECT_NAME}.com:payments,payment-history
cajero2:María:Cajero:cajero2@${PROJECT_NAME}.com:payments,payment-history
EOF
}

# Generate policy document dynamically
generate_policy() {
    local role=$1
    local account_id=$(get_account_id)
    
    case $role in
        admin)
            cat << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "*",
            "Resource": "*"
        }
    ]
}
EOF
            ;;
        mesero)
            cat << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:${AWS_REGION}:${account_id}:table/${PROJECT_NAME}-orders*",
                "arn:aws:dynamodb:${AWS_REGION}:${account_id}:table/${PROJECT_NAME}-kitchen*"
            ]
        }
    ]
}
EOF
            ;;
        cajero)
            cat << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:${AWS_REGION}:${account_id}:table/${PROJECT_NAME}-payments*"
            ]
        }
    ]
}
EOF
            ;;
        *)
            print_error "Unknown role: $role"
            return 1
            ;;
    esac
}

# Create or update policy
create_policy() {
    local role=$1
    local project_cap="$(echo "${PROJECT_NAME}" | sed 's/./\U&/')"
    local role_cap="$(echo "${role}" | sed 's/.*/\u&/')"
    local policy_name="${project_cap}Policy${role_cap}"
    local policy_doc=$(generate_policy "$role")
    local account_id=$(get_account_id)
    local policy_arn="arn:aws:iam::${account_id}:policy${POLICY_PATH}${policy_name}"
    
    # Create temporary file for policy document
    local temp_file=$(mktemp)
    echo "$policy_doc" > "$temp_file"
    
    # Try to create policy
    if aws iam create-policy \
        --policy-name "$policy_name" \
        --policy-document "file://$temp_file" \
        --path "$POLICY_PATH" \
        --description "Policy for ${PROJECT_NAME} ${role} role" >/dev/null 2>&1; then
        print_status "Created policy: $policy_name"
    else
        print_warning "Policy $policy_name may already exist"
    fi
    
    # Cleanup
    rm -f "$temp_file"
    echo "$policy_arn"
}

# Create user with access key
create_user() {
    local user_config=$1
    IFS=':' read -r username first_name last_name email permissions <<< "$user_config"
    
    local full_username="${PROJECT_NAME}-${username}"
    local role=""
    
    # Determine role from username
    case $username in
        admin*) role="admin" ;;
        mesero*) role="mesero" ;;
        cajero*) role="cajero" ;;
        *) print_error "Cannot determine role for $username"; return 1 ;;
    esac
    
    print_info "Creating user: $full_username ($role)"
    
    # Create user
    if aws iam create-user \
        --user-name "$full_username" \
        --path "$USER_PATH" >/dev/null 2>&1; then
        print_status "User $full_username created"
    else
        print_warning "User $full_username may already exist"
    fi
    
    # Create access key
    local credentials=$(aws iam create-access-key --user-name "$full_username" 2>/dev/null || echo "")
    if [ -n "$credentials" ]; then
        local access_key=$(echo "$credentials" | jq -r '.AccessKey.AccessKeyId' 2>/dev/null || echo "")
        local secret_key=$(echo "$credentials" | jq -r '.AccessKey.SecretAccessKey' 2>/dev/null || echo "")
        
        if [ -n "$access_key" ] && [ -n "$secret_key" ]; then
            echo "   Access Key: $access_key"
            echo "   Secret Key: $secret_key"
        fi
    fi
    
    # Add tags
    aws iam tag-user --user-name "$full_username" --tags \
        Key=Role,Value="$role" \
        Key=System,Value="$PROJECT_NAME" \
        Key=FirstName,Value="$first_name" \
        Key=LastName,Value="$last_name" \
        Key=Email,Value="$email" \
        Key=CreatedBy,Value="aws-iam-manager" \
        Key=CreatedDate,Value="$(date -u +%Y-%m-%dT%H:%M:%SZ)" 2>/dev/null || true
    
    # Attach policy
    local policy_arn=$(create_policy "$role")
    if aws iam attach-user-policy \
        --user-name "$full_username" \
        --policy-arn "$policy_arn" 2>/dev/null; then
        print_status "Attached policy to $full_username"
    else
        print_warning "Could not attach policy to $full_username"
    fi
    
    echo ""
}

# Create all users and policies
create_all() {
    local project_name_cap="$(echo "${PROJECT_NAME}" | sed 's/.*/\u&/')"
    print_info "Creating IAM users and policies for ${project_name_cap} system"
    echo "=============================================="
    
    test_permissions || return 1
    
    print_info "Account: $(get_account_id)"
    print_info "Region: $AWS_REGION"
    print_info "Policy Path: $POLICY_PATH"
    print_info "User Path: $USER_PATH"
    echo ""
    
    # Create users
    while IFS= read -r user_config; do
        [ -n "$user_config" ] && create_user "$user_config"
    done <<< "$(get_user_config)"
    
    print_status "IAM setup completed!"
    echo ""
    echo "⚠️  IMPORTANT: Save the access keys shown above!"
    echo "   These credentials will not be shown again."
    echo ""
    echo "🔍 Verify users created:"
    echo "   aws iam list-users --path-prefix '$USER_PATH'"
}

# List existing resources
list_resources() {
    local project_name_cap="$(echo "${PROJECT_NAME}" | sed 's/.*/\u&/')"
    print_info "Listing ${project_name_cap} IAM resources"
    echo "==============================="
    
    echo ""
    print_info "Users:"
    aws iam list-users --path-prefix "$USER_PATH" --query 'Users[].{UserName:UserName,CreateDate:CreateDate}' --output table 2>/dev/null || print_warning "No users found or no permissions"
    
    echo ""
    print_info "Policies:"
    aws iam list-policies --path-prefix "$POLICY_PATH" --scope Local --query 'Policies[].{PolicyName:PolicyName,CreateDate:CreateDate}' --output table 2>/dev/null || print_warning "No policies found or no permissions"
}

# Delete all resources
delete_all() {
    local project_name_cap="$(echo "${PROJECT_NAME}" | sed 's/.*/\u&/')"
    print_warning "This will delete ALL ${project_name_cap} IAM users and policies!"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        print_info "Operation cancelled"
        return 0
    fi
    
    print_info "Deleting ${project_name_cap} IAM resources..."
    
    # Delete users
    local users=$(aws iam list-users --path-prefix "$USER_PATH" --query 'Users[].UserName' --output text 2>/dev/null || echo "")
    for user in $users; do
        print_info "Deleting user: $user"
        
        # Detach policies
        local policies=$(aws iam list-attached-user-policies --user-name "$user" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
        for policy_arn in $policies; do
            aws iam detach-user-policy --user-name "$user" --policy-arn "$policy_arn" 2>/dev/null || true
        done
        
        # Delete access keys
        local access_keys=$(aws iam list-access-keys --user-name "$user" --query 'AccessKeyMetadata[].AccessKeyId' --output text 2>/dev/null || echo "")
        for key in $access_keys; do
            aws iam delete-access-key --user-name "$user" --access-key-id "$key" 2>/dev/null || true
        done
        
        # Delete user
        aws iam delete-user --user-name "$user" 2>/dev/null || true
        print_status "Deleted user: $user"
    done
    
    # Delete policies
    local account_id=$(get_account_id)
    local policies=$(aws iam list-policies --path-prefix "$POLICY_PATH" --scope Local --query 'Policies[].PolicyName' --output text 2>/dev/null || echo "")
    for policy in $policies; do
        local policy_arn="arn:aws:iam::${account_id}:policy${POLICY_PATH}${policy}"
        print_info "Deleting policy: $policy"
        aws iam delete-policy --policy-arn "$policy_arn" 2>/dev/null || true
        print_status "Deleted policy: $policy"
    done
    
    print_status "Cleanup completed!"
}

# Main script logic
main() {
    local command=${1:-help}
    
    case $command in
        create)
            create_all
            ;;
        delete)
            delete_all
            ;;
        list)
            list_resources
            ;;
        test)
            test_permissions
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Check dependencies
if ! command -v aws >/dev/null 2>&1; then
    print_error "AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    print_warning "jq not found. Some features may not work properly."
    print_info "Install jq for better JSON parsing: brew install jq (macOS) or apt-get install jq (Ubuntu)"
fi

# Run main function
main "$@"