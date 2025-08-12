#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# 🛡️ PRE-COMMIT SECURITY VALIDATION SCRIPT
# ═══════════════════════════════════════════════════════════════════════════════
# 
# Este script valida que no se commiteen archivos sensibles
# Uso: ./pre-commit-validate.sh
# 
# ═══════════════════════════════════════════════════════════════════════════════

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛡️ Security Validation - Restaurant Web${NC}"
echo "═══════════════════════════════════════════════════════════════"

# Flag to track if any issues found
ISSUES_FOUND=0

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. CHECK FOR SENSITIVE FILES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${YELLOW}🔍 Checking for sensitive files...${NC}"

# Files that should NEVER be committed
FORBIDDEN_PATTERNS=(
    "*.pem"
    "*.ppk" 
    "*_key.pem"
    "*_rsa"
    "*id_rsa*"
    ".env.ec2"
    ".env.production"
    ".env.prod"
    "*credentials*"
    "*.sqlite3"
    "restaurant_*.db"
    "*.log"
)

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    files=$(git diff --cached --name-only | grep -E "$pattern")
    if [ ! -z "$files" ]; then
        echo -e "${RED}❌ FORBIDDEN FILE DETECTED: $files${NC}"
        echo -e "   Pattern: $pattern"
        ISSUES_FOUND=1
    fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. CHECK FOR SECRETS IN CONTENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${YELLOW}🔍 Checking for secrets in file content...${NC}"

# Patterns that indicate secrets
SECRET_PATTERNS=(
    "DJANGO_SECRET_KEY=.*[a-zA-Z0-9]{20,}"
    "password.*=.*[a-zA-Z0-9]{8,}"
    "secret.*=.*[a-zA-Z0-9]{16,}"
    "api_key.*=.*[a-zA-Z0-9]{16,}"
    "private_key"
    "BEGIN.*PRIVATE.*KEY"
    "ssh-rsa.*"
    "ssh-ed25519.*"
)

for file in $(git diff --cached --name-only); do
    if [ -f "$file" ]; then
        for pattern in "${SECRET_PATTERNS[@]}"; do
            if grep -q -E "$pattern" "$file" 2>/dev/null; then
                # Exclude example files
                if [[ ! "$file" =~ \.example$ ]] && [[ ! "$file" =~ template ]] && [[ ! "$file" =~ SECURITY\.md$ ]]; then
                    echo -e "${RED}❌ POTENTIAL SECRET FOUND in $file${NC}"
                    echo -e "   Pattern: $pattern"
                    ISSUES_FOUND=1
                fi
            fi
        done
    fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. CHECK FILE SIZES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${YELLOW}📏 Checking file sizes...${NC}"

MAX_FILE_SIZE=5242880  # 5MB in bytes

for file in $(git diff --cached --name-only); do
    if [ -f "$file" ]; then
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        if [ "$size" -gt $MAX_FILE_SIZE ]; then
            echo -e "${YELLOW}⚠️ LARGE FILE: $file ($(($size / 1024 / 1024))MB)${NC}"
            echo -e "   Consider if this file should be committed"
        fi
    fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. CHECK .gitignore COVERAGE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${YELLOW}📝 Validating .gitignore coverage...${NC}"

# Required patterns in .gitignore
REQUIRED_GITIGNORE_PATTERNS=(
    "*.pem"
    ".env.ec2" 
    "*.sqlite3"
    "*credentials*"
    "*.log"
)

for pattern in "${REQUIRED_GITIGNORE_PATTERNS[@]}"; do
    if ! grep -q "$pattern" .gitignore 2>/dev/null; then
        echo -e "${YELLOW}⚠️ Missing in .gitignore: $pattern${NC}"
    fi
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. ENVIRONMENT VARIABLES CHECK
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${YELLOW}🔧 Checking environment files...${NC}"

# Check if .env.dev exists and has safe values
if [ -f ".env.dev" ]; then
    if grep -q "USE_COGNITO_AUTH=False" .env.dev; then
        echo -e "${GREEN}✅ .env.dev has safe development settings${NC}"
    else
        echo -e "${YELLOW}⚠️ .env.dev should have USE_COGNITO_AUTH=False for development${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ .env.dev not found - should exist for development${NC}"
fi

# Check that .env.ec2 is NOT being committed
if git diff --cached --name-only | grep -q ".env.ec2"; then
    echo -e "${RED}❌ .env.ec2 should NOT be committed (contains production secrets)${NC}"
    ISSUES_FOUND=1
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. FINAL RESULT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n═══════════════════════════════════════════════════════════════"

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ SECURITY VALIDATION PASSED${NC}"
    echo -e "${GREEN}Safe to commit!${NC}"
    exit 0
else
    echo -e "${RED}❌ SECURITY ISSUES FOUND${NC}"
    echo -e "${RED}Please fix the issues above before committing.${NC}"
    echo -e "\n${BLUE}💡 Quick fixes:${NC}"
    echo -e "   • Remove sensitive files: git reset HEAD <file>"
    echo -e "   • Update .gitignore and re-stage files"
    echo -e "   • Use .env.credentials.example as template"
    echo -e "   • Never commit production credentials"
    exit 1
fi