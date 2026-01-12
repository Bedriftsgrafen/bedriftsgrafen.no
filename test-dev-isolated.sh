#!/bin/bash
# =============================================================================
# Dev Environment Safety Test - Host Network Mode (Refactored)
# =============================================================================
# This script verifies that the dev environment starts in isolation without 
# disrupting host SSH connectivity.
# =============================================================================

set -e

# Load environment variables if available
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Configuration & Defaults
DEV_API_PORT=${API_PORT_DEV:-8001}
FRONTEND_PORT=${FRONTEND_PORT_DEV:-5173}
DB_PORT=${DATABASE_PORT:-5432}
SSH_PORT=${SSH_PORT:-22}
COMPOSE_DEV="docker-compose.dev.yml"
COMPOSE_PROD="docker-compose.prod.yml"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "Dev Environment Isolation Test"
echo "=========================================="

# 1. Helper: Polling Function
wait_for_port() {
    local port=$1
    local name=$2
    local timeout=${3:-30}
    echo -n "⏳ Waiting for $name on port $port... "
    for i in $(seq 1 $timeout); do
        if nc -zv localhost "$port" >/dev/null 2>&1; then
            echo -e "${GREEN}Ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    echo -e "${RED}Failed!${NC}"
    return 1
}

# 2. Helper: SSH Verification (Real connection attempt)
verify_ssh() {
    echo -n "� Verifying SSH isolation... "
    # Try to connect via SSH using a short timeout. 
    # Even if login fails, a 'Permission denied' means the network is alive.
    if ssh -o ConnectTimeout=3 -o BatchMode=yes -o StrictHostKeyChecking=no localhost exit 2>&1 | grep -q "Permission denied\|Connection closed\|closed by remote"; then
        echo -e "${GREEN}Passed (SSH is alive)${NC}"
        return 0
    else
        # If port 22 is open but SSH command failed completely (timeout/reset)
        if nc -zv localhost "$SSH_PORT" >/dev/null 2>&1; then
             echo -e "${GREEN}Passed (Port $SSH_PORT open)${NC}"
             return 0
        fi
        echo -e "${RED}FAILED (SSH isolation breached!)${NC}"
        return 1
    fi
}

# 3. Pre-flight Checks
echo -e "\n${YELLOW}🔍 Pre-flight checks...${NC}"

if ! docker compose -f "$COMPOSE_PROD" ps | grep -q "bedriftsgrafen-db.*Up"; then
    echo -e "${RED}❌ ERROR: Prod database is not running!${NC}"
    exit 1
fi

if nc -zv localhost "$DEV_API_PORT" >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port $DEV_API_PORT already in use - stopping old dev...${NC}"
    docker compose -f "$COMPOSE_DEV" down 2>/dev/null || true
fi

# 4. Start Dev Environment
echo -e "\n${YELLOW}🚀 Starting dev environment...${NC}"
docker compose -f "$COMPOSE_DEV" up -d --build

# 5. Immediate Isolation Test
echo ""
if ! verify_ssh; then
    echo -e "${RED}❌ CRITICAL: SSH access lost! Emergency shutdown...${NC}"
    docker compose -f "$COMPOSE_DEV" down
    exit 1
fi

# 6. Verify Network Mode (Robust check)
echo -n "🔍 Verifying Host Network Mode... "
NET_MODE=$(docker inspect bedriftsgrafen-backend-dev --format='{{.HostConfig.NetworkMode}}')
if [ "$NET_MODE" == "host" ]; then
    echo -e "${GREEN}Verified (host mode)${NC}"
else
    echo -e "${RED}FAILED (Mode: $NET_MODE)${NC}"
    docker compose -f "$COMPOSE_DEV" down
    exit 1
fi

# 7. Wait for services
wait_for_port "$DEV_API_PORT" "Backend API"
wait_for_port "$FRONTEND_PORT" "Frontend" 60

# 8. Stress Test (Single restart)
echo -e "\n${YELLOW}🔄 Reliability Test (Restarting)...${NC}"
docker compose -f "$COMPOSE_DEV" restart >/dev/null
sleep 2 # Small breather for Docker to re-bind
if verify_ssh; then
    echo -e "${GREEN}✅ SSH stable through restart${NC}"
else
    echo -e "${RED}❌ SSH failed after restart${NC}"
    exit 1
fi

# Summary
echo -e "\n=========================================="
echo -e "${GREEN}✅ DEV ENVIRONMENT IS ISOLATED AND SECURE${NC}"
echo -e "=========================================="
echo "Access points:"
echo "  - Backend:  http://localhost:$DEV_API_PORT/health"
echo "  - Frontend: http://localhost:$FRONTEND_PORT"
echo ""
echo "Command to stop:"
echo "  docker compose -f $COMPOSE_DEV down"
echo ""
