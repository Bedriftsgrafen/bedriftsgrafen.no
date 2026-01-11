#!/bin/bash
# =============================================================================
# Bedriftsgrafen Deploy Script
# =============================================================================
#
# Bygger og deployer prod-stacken.
#
# VIKTIG: Kjør database-migrasjoner FØR deploy hvis du har schema-endringer:
#   docker exec -it bedriftsgrafen-backend-dev alembic upgrade head
#
# Bruk: ./scripts/deploy.sh
#
# =============================================================================

set -e

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

echo ""
echo -e "${BLUE}🚀 Bedriftsgrafen Deploy Script${NC}"
echo "================================"
echo ""

# Advarsel om migrasjoner
echo -e "${YELLOW}⚠️  Påminnelse: Hvis du har schema-endringer, kjør først:${NC}"
echo "   docker exec -it bedriftsgrafen-backend-dev alembic upgrade head"
echo ""
read -p "Fortsett med deploy? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Deploy avbrutt.${NC}"
    exit 0
fi

echo ""

# 1. Bygg nye images
echo -e "${YELLOW}🔨 Building prod images...${NC}"
docker compose -f "$COMPOSE_FILE" build

# 2. Restart services
echo ""
echo -e "${YELLOW}♻️  Restarting prod services...${NC}"
docker compose -f "$COMPOSE_FILE" up -d

# 3. Vent på health checks
echo ""
echo -e "${YELLOW}🏥 Waiting for services to be healthy...${NC}"

# Vent på at backend blir healthy (max 60 sek)
for i in {1..30}; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' bedriftsgrafen-backend 2>/dev/null || echo "starting")
    if [ "$STATUS" = "healthy" ]; then
        echo -e "   Backend:  ${GREEN}✅ healthy${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "   Backend:  ${YELLOW}⏳ still starting (check logs)${NC}"
    fi
    sleep 2
done

# 4. Status
echo ""
echo -e "${YELLOW}📊 Service Status:${NC}"
docker compose -f "$COMPOSE_FILE" ps

# 5. Test frontend
echo ""
echo -e "${YELLOW}🧪 Testing endpoints...${NC}"
sleep 3

if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo -e "   Frontend (port 3000): ${GREEN}✅ OK${NC}"
else
    echo -e "   Frontend (port 3000): ${RED}❌ FAILED${NC}"
fi

# Test via internal network (backend health)
if docker exec bedriftsgrafen-frontend curl -sf http://bedriftsgrafen-backend:8000/health > /dev/null 2>&1; then
    echo -e "   Backend (internal):   ${GREEN}✅ OK${NC}"
else
    echo -e "   Backend (internal):   ${YELLOW}⏳ Starting...${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Deploy complete!${NC}"
echo ""
echo "   Prod Frontend: http://localhost:3000"
echo "   Prod Backend:  (kun intern tilgang via frontend)"
echo ""
echo -e "${BLUE}Tips:${NC} For å se logs: docker compose -f docker-compose.prod.yml logs -f"
echo ""
