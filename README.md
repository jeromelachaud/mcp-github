# 🤖 GitHub MCP AI Demo

A prototype demonstrating AI-powered GitHub automation using the Model Context Protocol (MCP).

## 🎯 What it does

When a pull request is opened:

1. **Auto-Commenter** posts a welcome message
2. **AI PR Analyzer** conducts an intelligent code review using Google Gemini
3. **MCP System** stores all data and analysis for future reference
4. **Stakeholders** see immediate value from AI automation

## 🏗️ Architecture

```
GitHub Webhook → Webhook Listener → MCP Proxy ┐
                                              ├→ Auto Commenter
                                              ├→ AI PR Analyzer
                                              └→ MCP Filesystem
```

## 🚀 Quick Start

### 1. Setup Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and fill in your credentials:
# - GITHUB_TOKEN: Get from https://github.com/settings/tokens
# - GEMINI_API_KEY: Get from https://makersuite.google.com/app/apikey
# - NGROK_AUTHTOKEN: Get from https://dashboard.ngrok.com (optional)
```

### 2. Start All Services

```bash
./start-services.sh
```

### 3. Setup GitHub Webhook

- Go to your repo → Settings → Webhooks
- Add webhook URL: `http://your-ngrok-url/webhook`
- Select "Pull requests" events

### 4. Test the System

- Create a pull request
- Watch AI analysis appear automatically! 🎉

## 📊 Services

| Service              | Port | Purpose                                  |
| -------------------- | ---- | ---------------------------------------- |
| **MCP Proxy**        | 8080 | WebSocket server, coordinates everything |
| **Webhook Listener** | 3000 | Receives GitHub webhooks                 |
| **Auto Commenter**   | -    | Posts welcome messages                   |
| **AI PR Analyzer**   | -    | Conducts AI code reviews                 |

## 🤖 AI Features

The AI PR Analyzer provides:

- **Code Quality Assessment** - Overall evaluation
- **Security Analysis** - Potential vulnerabilities
- **Performance Impact** - Resource considerations
- **Best Practice Suggestions** - Improvement recommendations
- **Approval Recommendations** - Merge/change requests

## 📁 Data Storage

All data is stored via MCP in `context-data/`:

- `webhook-*.json` - Raw GitHub webhook data
- `ai-analysis-*.md` - AI code review reports

## 🎯 Stakeholder Value

**For Development Teams:**

- ⚡ Faster code reviews
- 🔍 Consistent quality checks
- 📚 Knowledge sharing
- 🚀 Improved productivity

**For Management:**

- 📊 Development insights
- 🎯 Quality metrics
- 💰 Resource optimization
- 🔮 Predictable delivery

## 🛠️ Technology Stack

- **MCP (Model Context Protocol)** - Data coordination
- **Google Gemini AI** - Code analysis
- **GitHub API** - Repository integration
- **WebSockets** - Real-time communication
- **Node.js** - Service implementation

## 🔧 Development

### Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
```

### View Logs

```bash
tail -f logs/*.log
```

### Stop Services

```bash
./stop-services.sh
```

### Manual Testing

```bash
# Test webhook endpoint
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"action":"opened","pull_request":{"number":1}}'
```

## 🌟 Demo Script for Stakeholders

1. **Show the Problem**: Manual code reviews are slow and inconsistent
2. **Demonstrate Solution**: Create a PR and show instant AI analysis
3. **Highlight Benefits**: Speed, consistency, quality improvement
4. **Show Data**: Historical analysis stored via MCP
5. **Discuss ROI**: Time savings, quality improvements

## 🔮 Future Enhancements

- **Multi-language support** - Python, Java, etc.
- **Custom rules engine** - Company-specific guidelines
- **Integration dashboards** - Metrics and insights
- **Advanced AI models** - Specialized code analysis
- **Team notifications** - Slack, Teams integration

## 📞 Support

For questions or issues, check the logs in `logs/` directory or review the service status.

---

_Built with ❤️ to showcase the power of AI + MCP integration_
