#!/bin/bash
#
# Bedriftsgrafen Services Installation Script
# 
# This script installs and enables all background services for Bedriftsgrafen:
# - Company updates sync (from Brønnøysund)
# - Regnskap (financial statements) sync
# - Geocoding service
#
# Usage: sudo ./install-services.sh
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Bedriftsgrafen Services Installer${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run with sudo${NC}"
   echo "Usage: sudo $0"
   exit 1
fi

# Verify Docker is running
if ! docker info &>/dev/null; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Verify docker compose works
if ! docker compose version &>/dev/null; then
    echo -e "${RED}Error: docker compose not available${NC}"
    exit 1
fi

# Verify the backend container is running
if ! docker ps --format '{{.Names}}' | grep -q "bedriftsgrafen-backend"; then
    echo -e "${YELLOW}Warning: Backend container is not running${NC}"
    echo "Services will start once the container is available"
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Service files to install
SERVICES=(
    "bedriftsgrafen-company-updates.service"
    "bedriftsgrafen-regnskap-sync.service"
    "bedriftsgrafen-geocoding.service"
)

# Stop existing services first (ignore errors if they don't exist)
echo "Stopping existing services..."
for service in "${SERVICES[@]}"; do
    systemctl stop "$service" 2>/dev/null || true
    systemctl disable "$service" 2>/dev/null || true
done

# Create logs directory if it doesn't exist
echo "Ensuring logs directory exists..."
mkdir -p "$PROJECT_ROOT/logs"
chown -R k1sso:k1sso "$PROJECT_ROOT/logs"
chmod 755 "$PROJECT_ROOT/logs"

# Copy service files
echo ""
echo "Installing service files..."
for service in "${SERVICES[@]}"; do
    src="$SCRIPT_DIR/systemd/$service"
    dest="/etc/systemd/system/$service"
    
    if [[ -f "$src" ]]; then
        cp "$src" "$dest"
        chmod 644 "$dest"
        echo -e "  ${GREEN}✓${NC} Installed $service"
    else
        echo -e "  ${RED}✗${NC} Missing $src"
        exit 1
    fi
done

# Reload systemd
echo ""
echo "Reloading systemd daemon..."
systemctl daemon-reload
echo -e "${GREEN}✓ Systemd reloaded${NC}"

# Enable services (start on boot)
echo ""
echo "Enabling services..."
for service in "${SERVICES[@]}"; do
    systemctl enable "$service"
    echo -e "  ${GREEN}✓${NC} Enabled $service"
done

# Start services
echo ""
echo "Starting services..."
for service in "${SERVICES[@]}"; do
    if systemctl start "$service"; then
        echo -e "  ${GREEN}✓${NC} Started $service"
    else
        echo -e "  ${YELLOW}!${NC} Failed to start $service (check logs)"
    fi
done

# Show status
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Service Status:"
echo ""
for service in "${SERVICES[@]}"; do
    status=$(systemctl is-active "$service" 2>/dev/null || echo "unknown")
    if [[ "$status" == "active" ]]; then
        echo -e "  ${GREEN}●${NC} $service: ${GREEN}$status${NC}"
    else
        echo -e "  ${YELLOW}●${NC} $service: ${YELLOW}$status${NC}"
    fi
done

echo ""
echo "Useful commands:"
echo "  View logs:    journalctl -u bedriftsgrafen-company-updates -f"
echo "  Stop:         sudo systemctl stop bedriftsgrafen-company-updates"
echo "  Restart:      sudo systemctl restart bedriftsgrafen-company-updates"
echo "  Status:       sudo systemctl status bedriftsgrafen-company-updates"
echo ""
