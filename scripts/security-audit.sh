#!/bin/bash
# Local Security Audit Script for Bedriftsgrafen.no
# Run comprehensive security checks locally before pushing code

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
GITLEAKS_IMAGE="ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f"

# Track overall status
OVERALL_STATUS=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🛡️  Bedriftsgrafen Security Audit${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    local status=$1
    local message=$2
    if [ "$status" -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $message"
    else
        echo -e "${RED}✗${NC} $message"
        OVERALL_STATUS=1
    fi
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

#############################################
# 1. FRONTEND SECURITY AUDIT
#############################################
echo -e "\n${BLUE}═══ Frontend Security ═══${NC}\n"

if [ -d "frontend" ]; then
    cd frontend
    
    # npm audit
    if command_exists npm; then
        print_info "Running npm audit..."
        if npm audit --audit-level=moderate; then
            print_status 0 "npm audit: No vulnerabilities found"
        else
            print_status 1 "npm audit: Vulnerabilities detected"
            print_warning "Run 'npm audit fix' to fix automatically"
        fi
    else
        print_warning "npm not found - skipping frontend audit"
    fi
    
    cd ..
else
    print_warning "Frontend directory not found"
fi

#############################################
# 2. BACKEND SECURITY AUDIT
#############################################
echo -e "\n${BLUE}═══ Backend Security ═══${NC}\n"

if [ -d "backend" ]; then
    cd backend
    
    # Check if venv exists
    if [ -f ".venv/bin/python" ]; then
        PYTHON_CMD=".venv/bin/python"
        PIP_CMD=".venv/bin/pip"
    elif command_exists python3; then
        PYTHON_CMD="python3"
        PIP_CMD="pip3"
    else
        print_warning "Python not found - skipping backend audit"
        cd ..
        PYTHON_CMD=""
    fi
    
    if [ -n "$PYTHON_CMD" ]; then
        # pip-audit
        if $PYTHON_CMD -m pip show pip-audit >/dev/null 2>&1; then
            print_info "Running pip-audit..."
            if $PYTHON_CMD -m pip_audit; then
                print_status 0 "pip-audit: No vulnerabilities found"
            else
                print_status 1 "pip-audit: Vulnerabilities detected"
            fi
        else
            print_warning "pip-audit not installed - Install with: pip install pip-audit"
        fi
        
        # Bandit SAST
        if $PYTHON_CMD -m pip show bandit >/dev/null 2>&1; then
            print_info "Running Bandit SAST..."
            if $PYTHON_CMD -m bandit -r . -x ./.venv -lll -q; then
                print_status 0 "Bandit: No security issues found"
            else
                print_status 1 "Bandit: Security issues detected"
            fi
        else
            print_warning "bandit not installed - Install with: pip install bandit"
        fi
    fi
    
    cd ..
else
    print_warning "Backend directory not found"
fi

#############################################
# 3. DOCKER IMAGE SCANNING
#############################################
echo -e "\n${BLUE}═══ Docker Security ═══${NC}\n"

if command_exists trivy; then
    print_info "Running Trivy container image scan..."
    
    # Check if Docker images exist
    if command_exists docker; then
        # Scan backend image if it exists
        if docker images | grep -q bedriftsgrafen-backend; then
            if trivy image --exit-code 1 --ignore-unfixed --severity CRITICAL,HIGH bedriftsgrafen-backend:latest; then
                print_status 0 "Trivy (backend): No CRITICAL/HIGH vulnerabilities"
            else
                print_status 1 "Trivy (backend): Vulnerabilities detected"
            fi
        else
            print_info "Backend Docker image not found - build it first"
        fi
        
        # Scan frontend image if it exists
        if docker images | grep -q bedriftsgrafen-frontend; then
            if trivy image --exit-code 1 --ignore-unfixed --severity CRITICAL,HIGH bedriftsgrafen-frontend:latest; then
                print_status 0 "Trivy (frontend): No CRITICAL/HIGH vulnerabilities"
            else
                print_status 1 "Trivy (frontend): Vulnerabilities detected"
            fi
        else
            print_info "Frontend Docker image not found - build it first"
        fi
    else
        print_warning "Docker not found - cannot scan images"
    fi
else
    print_warning "Trivy not installed - Install from: https://aquasecurity.github.io/trivy/"
fi

#############################################
# 4. SECRET DETECTION
#############################################
echo -e "\n${BLUE}═══ Secret Detection ═══${NC}\n"

if command_exists gitleaks; then
    print_info "Running gitleaks secret detection..."
    if gitleaks git --gitleaks-ignore-path .gitleaksignore --no-banner --redact --verbose .; then
        print_status 0 "gitleaks: No secrets detected"
    else
        print_status 1 "gitleaks: Potential secrets detected"
    fi
elif command_exists docker; then
    print_info "Running gitleaks secret detection with Docker..."
    if docker run --rm \
        --volume "$PWD:/repo:ro" \
        "$GITLEAKS_IMAGE" \
        git --gitleaks-ignore-path /repo/.gitleaksignore --no-banner --redact --verbose /repo; then
        print_status 0 "gitleaks: No secrets detected"
    else
        print_status 1 "gitleaks: Potential secrets detected"
    fi
else
    print_warning "gitleaks and Docker not found - skipping secret detection"
fi

if command_exists detect-secrets; then
    print_info "Running detect-secrets scan..."
    if detect-secrets scan --baseline .secrets.baseline; then
        print_status 0 "detect-secrets: No new secrets detected"
    else
        print_status 1 "detect-secrets: New secrets detected"
    fi
else
    print_warning "detect-secrets not installed - Install with: pip install detect-secrets"
fi

#############################################
# SUMMARY
#############################################
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}✓ Security audit completed successfully!${NC}"
else
    echo -e "${YELLOW}⚠ Security audit completed with warnings${NC}"
    echo -e "${YELLOW}  Review the issues above and address critical vulnerabilities${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Fail automation when an installed scanner finds a security issue.
exit "$OVERALL_STATUS"
