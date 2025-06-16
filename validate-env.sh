#!/bin/bash

# Environment validation script
echo "🔍 GitHub MCP AI Demo - Environment Validation"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load .env if it exists
if [ -f .env ]; then
    echo -e "${BLUE}📋 Loading .env file...${NC}"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}❌ .env file not found${NC}"
    echo -e "${YELLOW}Run: cp .env.example .env${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🧪 Checking environment variables...${NC}"

# Check GITHUB_TOKEN
if [ -n "$GITHUB_TOKEN" ] && [ "$GITHUB_TOKEN" != "your_github_token_here" ]; then
    echo -e "${GREEN}✅ GITHUB_TOKEN is set${NC}"
else
    echo -e "${RED}❌ GITHUB_TOKEN not set or using placeholder${NC}"
    echo -e "${YELLOW}   Get from: https://github.com/settings/tokens${NC}"
fi

# Check GEMINI_API_KEY
if [ -n "$GEMINI_API_KEY" ] && [ "$GEMINI_API_KEY" != "your_gemini_api_key_here" ]; then
    echo -e "${GREEN}✅ GEMINI_API_KEY is set${NC}"
else
    echo -e "${RED}❌ GEMINI_API_KEY not set or using placeholder${NC}"
    echo -e "${YELLOW}   Get from: https://makersuite.google.com/app/apikey${NC}"
fi

# Check NGROK_AUTHTOKEN (optional)
if [ -n "$NGROK_AUTHTOKEN" ] && [ "$NGROK_AUTHTOKEN" != "your_ngrok_authtoken_here" ]; then
    echo -e "${GREEN}✅ NGROK_AUTHTOKEN is set${NC}"
else
    echo -e "${YELLOW}⚠️  NGROK_AUTHTOKEN not set (optional for local testing)${NC}"
    echo -e "${YELLOW}   Get from: https://dashboard.ngrok.com/get-started/your-authtoken${NC}"
fi

echo ""
echo -e "${BLUE}🔧 Checking ports...${NC}"

# Check if ports are available
check_port() {
    local port=$1
    local name=$2
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $port ($name) is already in use${NC}"
    else
        echo -e "${GREEN}✅ Port $port ($name) is available${NC}"
    fi
}

check_port "${MCP_PROXY_PORT:-8080}" "MCP Proxy"
check_port "${WEBHOOK_LISTENER_PORT:-3000}" "Webhook Listener"

echo ""
echo -e "${BLUE}📦 Checking dependencies...${NC}"

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ Node modules installed${NC}"
else
    echo -e "${RED}❌ Node modules not found${NC}"
    echo -e "${YELLOW}   Run: npm install${NC}"
fi

# Check if ngrok is installed
if command -v ngrok &> /dev/null; then
    echo -e "${GREEN}✅ Ngrok is installed${NC}"
else
    echo -e "${YELLOW}⚠️  Ngrok not found (optional for public webhooks)${NC}"
    echo -e "${YELLOW}   Install from: https://ngrok.com/download${NC}"
fi

# Check if context-data directory exists
if [ -d "context-data" ]; then
    echo -e "${GREEN}✅ Context data directory exists${NC}"
else
    echo -e "${YELLOW}⚠️  Context data directory not found (will be created automatically)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Environment validation complete!${NC}"
echo -e "${YELLOW}To start the services, run: ./start-services.sh${NC}"
