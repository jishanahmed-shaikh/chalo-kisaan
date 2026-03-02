#!/usr/bin/env bash
# ============================================================
# Chalo Kisaan Quick Start — Phase 0 (Local Development)
# 
# This script gets the ENTIRE backend running locally WITHOUT AWS.
# Perfect for feature development before AWS integration.
#
# Usage:
#   chmod +x scripts/quickstart.sh
#   ./scripts/quickstart.sh
# ============================================================

set -euo pipefail

echo "🌾 Chalo Kisaan — Quick Start (Phase 0: Local Dev)"
echo ""
echo "This will:"
echo "  1. Start PostgreSQL in Docker"
echo "  2. Run database migrations"
echo "  3. Start FastAPI backend"
echo "  4. Show you the API docs"
echo ""

# ─── Colors ───────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ─── Check Docker ─────────────────────────────────────────────────────────
echo -e "${BLUE}📦 Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Install from: https://www.docker.com/products/docker-desktop/"
    exit 1
fi
echo -e "${GREEN}✓ Docker found${NC}"

# ─── Check Docker Compose ─────────────────────────────────────────────────
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose not found."
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose found${NC}"

# ─── Start PostgreSQL ─────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}🗄  Starting PostgreSQL in Docker...${NC}"
docker compose up -d
echo -e "${GREEN}✓ PostgreSQL started${NC}"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to accept connections..."
for i in {1..30}; do
    if docker exec chalokisaan-postgres pg_isready -U kisaan_admin > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL failed to start"
        exit 1
    fi
    sleep 1
done

# ─── Run Migrations ───────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}🚀 Running database migrations...${NC}"
source venv/bin/activate 2>/dev/null || {
    echo "❌ venv not activated. Run:"
    echo "   python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
}

alembic upgrade head
echo -e "${GREEN}✓ Migrations complete${NC}"

# ─── Show PostgreSQL Info ─────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}📊 PostgreSQL Info:${NC}"
echo "   Host:     localhost"
echo "   Port:     5432"
echo "   Database: chalo_kisaan"
echo "   User:     kisaan_admin"
echo "   Password: changeme"
echo ""
echo -e "${YELLOW}🖥  pgAdmin UI (optional):${NC}"
echo "   URL:      http://localhost:5050"
echo "   Email:    admin@chalokisaan.local"
echo "   Password: admin"
echo ""

# ─── Summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Phase 0 Setup Complete!${NC}"
echo ""
echo -e "${YELLOW}NEXT: Start the FastAPI backend in a NEW terminal:${NC}"
echo ""
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   cp .env.example .env"
echo "   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo -e "${YELLOW}Then:${NC}"
echo ""
echo "   Open API docs:    http://localhost:8000/docs"
echo "   Health check:     curl http://localhost:8000/api/health"
echo ""
echo -e "${YELLOW}To stop PostgreSQL:${NC}"
echo ""
echo "   docker compose down"
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
