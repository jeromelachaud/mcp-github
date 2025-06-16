#!/bin/bash

# Startup script for GitHub MCP AI Demo
echo "🚀 Starting GitHub MCP AI Demo..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables from .env file
if [ -f .env ]; then
    echo -e "${BLUE}📋 Loading environment variables from .env file...${NC}"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}❌ .env file not found${NC}"
    echo -e "${YELLOW}Copy .env.example to .env and fill in your values:${NC}"
    echo -e "${YELLOW}cp .env.example .env${NC}"
    exit 1
fi

# Function to start a service in background
start_service() {
    local name=$1
    local command=$2
    local log_file=$3

    echo -e "${BLUE}Starting $name...${NC}"
    eval "$command > $log_file 2>&1 &"
    local pid=$!
    echo "$pid" > "/tmp/${name}.pid"
    echo -e "${GREEN}✅ $name started (PID: $pid)${NC}"
}

# Check if required environment variables are set
echo -e "${BLUE}🔍 Validating environment variables...${NC}"

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}❌ GITHUB_TOKEN not set in .env file${NC}"
    echo -e "${YELLOW}Get your token from: https://github.com/settings/tokens${NC}"
    exit 1
fi

if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your_gemini_api_key_here" ]; then
    echo -e "${RED}❌ GEMINI_API_KEY not set in .env file${NC}"
    echo -e "${YELLOW}Get your free API key from: https://makersuite.google.com/app/apikey${NC}"
    exit 1
fi

if [ -z "$NGROK_AUTHTOKEN" ] || [ "$NGROK_AUTHTOKEN" = "your_ngrok_authtoken_here" ]; then
    echo -e "${YELLOW}⚠️  NGROK_AUTHTOKEN not set (optional for local testing)${NC}"
fi

echo -e "${GREEN}✅ Environment variables validated${NC}"

# Create logs directory
mkdir -p logs

# Start services
echo -e "${YELLOW}🔧 Starting MCP services...${NC}"

start_service "mcp-proxy" "node mcp-proxy.js" "logs/mcp-proxy.log"
sleep 2

start_service "webhook-listener" "node webhook-listener.js" "logs/webhook-listener.log"
sleep 1

# Start ngrok tunnel if NGROK_AUTHTOKEN is set
if [ -n "$NGROK_AUTHTOKEN" ] && [ "$NGROK_AUTHTOKEN" != "your_ngrok_authtoken_here" ]; then
    echo -e "${BLUE}🌐 Starting ngrok tunnel...${NC}"
    # Start ngrok with verbose logging
    start_service "ngrok" "ngrok http ${WEBHOOK_LISTENER_PORT:-3000} --log=stdout --log-format=json --log-level=info" "logs/ngrok.log"
    sleep 3
    echo -e "${GREEN}✅ Ngrok tunnel started${NC}"

    # Try to get and display the webhook URL immediately
    WEBHOOK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data['tunnels']:
        print(data['tunnels'][0]['public_url'] + '/webhook')
except:
    pass
" 2>/dev/null)

    if [ -n "$WEBHOOK_URL" ]; then
        echo -e "${BLUE}🎯 Your webhook URL: $WEBHOOK_URL${NC}"
    else
        echo -e "${YELLOW}📡 Run ./get-webhook-url.sh to get your webhook URL${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Ngrok not started (NGROK_AUTHTOKEN not configured)${NC}"
fi

start_service "auto-commenter" "node auto-commenter.mjs" "logs/auto-commenter.log"
sleep 1

start_service "ai-pr-analyzer" "node ai-pr-analyzer.mjs" "logs/ai-pr-analyzer.log"

echo ""
echo -e "${GREEN}🎉 All services started successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
echo "  • MCP Proxy:        http://localhost:${MCP_PROXY_PORT:-8080} (WebSocket)"
echo "  • Webhook Listener: http://localhost:${WEBHOOK_LISTENER_PORT:-3000}/webhook"
if [ -n "$NGROK_AUTHTOKEN" ] && [ "$NGROK_AUTHTOKEN" != "your_ngrok_authtoken_here" ]; then
    echo "  • Ngrok Tunnel:     Check logs/ngrok.log for public URL"
fi
echo "  • Auto Commenter:   Connected to MCP"
echo "  • AI PR Analyzer:   Connected to MCP"
echo ""
echo -e "${YELLOW}📋 To test the system:${NC}"
echo "  1. Create a pull request in your GitHub repo"
if [ -n "$NGROK_AUTHTOKEN" ] && [ "$NGROK_AUTHTOKEN" != "your_ngrok_authtoken_here" ]; then
    echo "  2. Get your ngrok URL: grep 'started tunnel' logs/ngrok.log"
    echo "  3. Configure webhook to point to: https://your-ngrok-url.ngrok.io/webhook"
else
    echo "  2. Configure webhook to point to: http://your-ngrok-url/webhook"
fi
echo "  4. Watch the magic happen! 🪄"
echo ""
echo -e "${BLUE}📁 Logs are available in:${NC}"
echo "  • logs/mcp-proxy.log"
echo "  • logs/webhook-listener.log"
if [ -n "$NGROK_AUTHTOKEN" ] && [ "$NGROK_AUTHTOKEN" != "your_ngrok_authtoken_here" ]; then
    echo "  • logs/ngrok.log (contains your public webhook URL)"
fi
echo "  • logs/auto-commenter.log"
echo "  • logs/ai-pr-analyzer.log"
echo ""
echo -e "${YELLOW}To stop all services, run: ./stop-services.sh${NC}"
