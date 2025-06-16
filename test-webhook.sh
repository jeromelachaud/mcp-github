#!/bin/bash

echo "🧪 Testing webhook message routing..."

# Test webhook payload
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "opened",
    "number": 999,
    "pull_request": {
      "number": 999,
      "title": "Test PR for duplicate prevention",
      "user": {"login": "testuser"},
      "base": {
        "repo": {
          "name": "test-repo",
          "owner": {"login": "testowner"}
        }
      }
    },
    "repository": {
      "name": "test-repo",
      "owner": {"login": "testowner"}
    }
  }'

echo ""
echo "✅ Test webhook sent"
echo "🔍 Check the service logs to see if messages are routed correctly:"
echo "   tail -f logs/mcp-proxy.log"
echo "   tail -f logs/auto-commenter.log"
echo "   tail -f logs/ai-pr-analyzer.log"
