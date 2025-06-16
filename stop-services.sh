#!/bin/bash

# Stop script for GitHub MCP AI Demo
echo "🛑 Stopping GitHub MCP AI Demo services..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to stop a service
stop_service() {
    local name=$1
    local pid_file="/tmp/${name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${YELLOW}Stopping $name (PID: $pid)...${NC}"
            kill "$pid"
            rm "$pid_file"
            echo -e "${GREEN}✅ $name stopped${NC}"
        else
            echo -e "${RED}⚠️  $name process not found${NC}"
            rm "$pid_file"
        fi
    else
        echo -e "${YELLOW}⚠️  No PID file found for $name${NC}"
    fi
}

# Stop all services
stop_service "ai-pr-analyzer"
stop_service "auto-commenter"
stop_service "ngrok"
stop_service "webhook-listener"
stop_service "mcp-proxy"

echo ""
echo -e "${GREEN}🏁 All services stopped!${NC}"

# Clean up temporary files
if [ -f "/tmp/ngrok-temp.yml" ]; then
    rm "/tmp/ngrok-temp.yml"
    echo -e "${BLUE}🧹 Cleaned up temporary ngrok config${NC}"
fi
