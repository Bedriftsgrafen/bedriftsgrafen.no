#!/bin/bash
# =============================================================================
# Bedriftsgrafen Deploy Script
# =============================================================================
#
# Bygger og deployer prod-stacken.
#
# Scriptet bygger nytt backend-image, kjører Alembic fra det nybygde imaget,
# og restarter deretter backend/worker.
#
# Bruk: ./scripts/deploy.sh
#
# =============================================================================

set -Eeuo pipefail

# Auto-detect project directory from script location
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="docker-compose.prod.yml"

# Farger
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$PROJECT_DIR"

show_failure_logs() {
    local service="$1"
    echo -e "${YELLOW}Recent ${service} logs:${NC}" >&2
    docker compose -f "$COMPOSE_FILE" logs --tail=80 "$service" >&2 || true
}

wait_for_healthy() {
    local service="$1"
    local container="$2"
    local display_name="$3"
    local status="missing"

    # The compose health check permits a 40-second start period followed by
    # three 30-second intervals. Allow 180 seconds before failing the deploy.
    for _ in {1..90}; do
        status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container" 2>/dev/null || echo "missing")"
        if [ "$status" = "healthy" ]; then
            echo -e "   ${display_name}: ${GREEN}✅ healthy${NC}"
            return 0
        fi
        sleep 2
    done

    echo -e "   ${display_name}: ${RED}❌ ${status} after 180 seconds${NC}" >&2
    show_failure_logs "$service"
    return 1
}

check_container_endpoint() {
    local service="$1"
    local container="$2"
    local display_name="$3"

    if docker exec "$container" curl -fsS --max-time 10 http://localhost:8000/health/ready >/dev/null; then
        echo -e "   ${display_name}: ${GREEN}✅ OK${NC}"
        return 0
    fi

    echo -e "   ${display_name}: ${RED}❌ FAILED${NC}" >&2
    show_failure_logs "$service"
    return 1
}

env_file_value() {
    local key="$1"
    local line=""
    local value=""

    if [ ! -f .env ]; then
        return 1
    fi

    line="$(grep -E "^${key}=" .env | tail -n 1 || true)"
    if [ -z "$line" ]; then
        return 1
    fi

    value="${line#*=}"
    value="${value%$'\r'}"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    printf '%s' "$value"
}

check_brreg_egress_config() {
    local enabled=""
    local rate=""
    local burst=""

    enabled="$(env_file_value "BRREG_EGRESS_GUARD_ENABLED" || true)"
    enabled="${enabled:-true}"

    case "${enabled,,}" in
        0|false|no|off)
            echo -e "${YELLOW}⚠️  BRREG_EGRESS_GUARD_ENABLED=${enabled}; global Brreg egress guard is disabled.${NC}"
            return 0
            ;;
    esac

    rate="$(env_file_value "BRREG_EGRESS_RATE_PER_SECOND" || true)"
    burst="$(env_file_value "BRREG_EGRESS_BURST" || true)"

    if [ -z "$rate" ] || [ -z "$burst" ]; then
        echo -e "${RED}❌ Missing Brreg egress guard config in .env.${NC}" >&2
        echo "   Set BRREG_EGRESS_RATE_PER_SECOND and BRREG_EGRESS_BURST, or explicitly set BRREG_EGRESS_GUARD_ENABLED=false." >&2
        return 1
    fi
}

run_database_migrations() {
    echo ""
    echo -e "${YELLOW}🧱 Ensuring migration dependencies are healthy...${NC}"
    docker compose -f "$COMPOSE_FILE" up -d db redis
    wait_for_healthy "db" "bedriftsgrafen-db" "Database"
    wait_for_healthy "redis" "bedriftsgrafen-redis" "Redis"

    echo ""
    echo -e "${YELLOW}🧬 Running database migrations...${NC}"
    docker compose -f "$COMPOSE_FILE" run --rm --no-deps backend alembic upgrade head
}

echo ""
echo -e "${BLUE}🚀 Bedriftsgrafen Deploy Script${NC}"
echo "================================"
echo ""

# Advarsel om migrasjoner
echo -e "${YELLOW}⚠️  Database-migrasjoner kjøres automatisk etter build og før restart.${NC}"
echo ""
read -p "Fortsett med deploy? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Deploy avbrutt.${NC}"
    exit 0
fi

echo ""

# Preflight
check_brreg_egress_config

# 1. Bygg nye images
echo -e "${YELLOW}🔨 Building prod images...${NC}"
docker compose -f "$COMPOSE_FILE" build

# 2. Run migrations from the newly built backend image
run_database_migrations

# 3. Restart services
echo ""
echo -e "${YELLOW}♻️  Restarting prod services...${NC}"
docker compose -f "$COMPOSE_FILE" up -d

# 4. Vent på health checks
echo ""
echo -e "${YELLOW}🏥 Waiting for services to be healthy...${NC}"

wait_for_healthy "backend" "bedriftsgrafen-backend" "Backend"
wait_for_healthy "backend-worker" "bedriftsgrafen-worker" "Worker"

# 5. Status
echo ""
echo -e "${YELLOW}📊 Service Status:${NC}"
docker compose -f "$COMPOSE_FILE" ps

# 6. Test frontend
echo ""
echo -e "${YELLOW}🧪 Testing endpoints...${NC}"
sleep 3

if curl -fsS --max-time 10 http://localhost:3000 > /dev/null; then
    echo -e "   Frontend (port 3000): ${GREEN}✅ OK${NC}"
else
    echo -e "   Frontend (port 3000): ${RED}❌ FAILED${NC}"
    show_failure_logs "frontend"
    exit 1
fi

check_container_endpoint "backend" "bedriftsgrafen-backend" "Backend readiness"
check_container_endpoint "backend-worker" "bedriftsgrafen-worker" "Worker readiness"

echo ""
echo -e "${GREEN}🎉 Deploy complete!${NC}"
echo ""
echo "   Prod Frontend: http://localhost:3000"
echo "   Prod Backend:  (kun intern tilgang via frontend)"
echo ""
echo -e "${BLUE}Tips:${NC} For å se logs: docker compose -f docker-compose.prod.yml logs -f"
echo ""
