#!/bin/bash

# Script to get the current ngrok tunnel URL
echo "🌐 Ngrok Tunnel Status"
echo ""

# First try to get URL from ngrok's local API
TUNNEL_URL=""
if command -v curl &> /dev/null; then
    TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data['tunnels']:
        print(data['tunnels'][0]['public_url'])
except:
    pass
" 2>/dev/null)
fi

# If API method worked, show the URL
if [ -n "$TUNNEL_URL" ]; then
    echo "✅ Ngrok tunnel is active"
    echo "📡 Public URL: $TUNNEL_URL"
    echo "🎯 Webhook URL: $TUNNEL_URL/webhook"
    echo ""
    echo "🔗 Copy this webhook URL to your GitHub repository settings:"
    echo "   Repository → Settings → Webhooks → Add webhook"
    echo "   Payload URL: $TUNNEL_URL/webhook"
    echo "   Content type: application/json"
    echo "   Events: Pull requests"
    exit 0
fi

# Fallback to log file parsing
if [ -f logs/ngrok.log ]; then
    # Check for errors first
    if grep -q "ERROR:" logs/ngrok.log; then
        echo "❌ Ngrok failed to start"
        echo "Error details:"
        grep "ERROR:" logs/ngrok.log | head -3
        echo ""
        echo "💡 Check your NGROK_AUTHTOKEN in .env file"
        exit 1
    fi
    
    # Try different patterns for ngrok URL extraction
    TUNNEL_URL=$(grep -o 'https://[^[:space:]]*\.ngrok[^[:space:]]*' logs/ngrok.log | head -1)
    
    # Alternative pattern for newer ngrok versions
    if [ -z "$TUNNEL_URL" ]; then
        TUNNEL_URL=$(grep -o 'https://[a-zA-Z0-9-]*\.ngrok-free\.app' logs/ngrok.log | head -1)
    fi
    
    # Another pattern
    if [ -z "$TUNNEL_URL" ]; then
        TUNNEL_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.ngrok\.io' logs/ngrok.log | head -1)
    fi
    
    if [ -n "$TUNNEL_URL" ]; then
        echo "✅ Ngrok tunnel is active"
        echo "📡 Public URL: $TUNNEL_URL"
        echo "🎯 Webhook URL: $TUNNEL_URL/webhook"
        echo ""
        echo "Copy this webhook URL to your GitHub repository settings:"
        echo "Repository → Settings → Webhooks → Add webhook"
        echo "Payload URL: $TUNNEL_URL/webhook"
    else
        echo "❌ No active tunnel found"
        echo "Check if ngrok is running:"
        if ps aux | grep -q "[n]grok"; then
            echo "✅ Ngrok process is running"
            echo "Try accessing ngrok web interface: http://localhost:4040"
        else
            echo "❌ Ngrok process not found"
            echo "Start services with: ./start-services.sh"
        fi
    fi
else
    echo "❌ Ngrok log file not found"
    echo "Start services first with: ./start-services.sh"
fi
