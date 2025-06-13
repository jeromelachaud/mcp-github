import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import WebSocket from "ws";

// Load environment variables
dotenv.config();

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "ws://localhost:8080";

if (!GITHUB_TOKEN) {
  console.error("Error: GITHUB_TOKEN not set in environment variables");
  process.exit(1);
}

if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
  console.error("Error: Please set GEMINI_API_KEY environment variable");
  console.error(
    "Get your free API key from: https://makersuite.google.com/app/apikey"
  );
  process.exit(1);
}

// Initialize services
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Connect to MCP WebSocket proxy
const mcpSocket = new WebSocket(MCP_SERVER_URL);

mcpSocket.on("open", () => {
  console.log("🤖 AI PR Analyzer connected to MCP WebSocket proxy");

  // Identify this client to the MCP proxy
  const identity = {
    type: "client-identity",
    clientType: "ai-analyzer",
    clientName: "AI PR Analyzer",
  };
  mcpSocket.send(JSON.stringify(identity));
});

mcpSocket.on("message", async (data) => {
  const messageStr = Buffer.isBuffer(data) ? data.toString("utf8") : data;
  console.log(
    "🤖 AI Analyzer received message:",
    messageStr.substring(0, 100) + "..."
  );

  let msg;
  try {
    msg = JSON.parse(messageStr);
  } catch (err) {
    console.error("AI Analyzer: Invalid JSON message received", err);
    return;
  }

  // Check for GitHub PR opened event
  const githubEvent = msg.payload?.github;
  if (
    githubEvent &&
    githubEvent.pull_request &&
    githubEvent.action === "opened"
  ) {
    await analyzePullRequest(githubEvent);
  }
});

async function hasAIAnalysis(owner, repo, prNumber) {
  try {
    const comments = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    // Check if we already posted an AI analysis (look for our signature)
    return comments.data.some(
      (comment) =>
        comment.body.includes("🤖 AI Code Review") ||
        comment.body.includes("This review was generated automatically by AI")
    );
  } catch (error) {
    console.error("Error checking for existing AI analysis:", error);
    return false; // If we can't check, assume no comment exists
  }
}

async function analyzePullRequest(githubEvent) {
  const pr = githubEvent.pull_request;
  const owner = pr.base.repo.owner.login;
  const repo = pr.base.repo.name;
  const prNumber = pr.number;

  console.log(`🤖 Starting AI analysis for PR: ${owner}/${repo}#${prNumber}`);

  // Check if we already analyzed this PR
  const alreadyAnalyzed = await hasAIAnalysis(owner, repo, prNumber);
  if (alreadyAnalyzed) {
    console.log(`🤖 AI analysis already exists on PR #${prNumber}, skipping`);
    return;
  }

  try {
    // 1. Get PR details and diff
    const prDetails = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // 2. Get PR files and changes
    const files = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    // 3. Prepare context for AI analysis
    const prContext = {
      title: prDetails.data.title,
      description: prDetails.data.body || "No description provided",
      author: prDetails.data.user.login,
      filesChanged: files.data.length,
      additions: prDetails.data.additions,
      deletions: prDetails.data.deletions,
      files: files.data.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch || "Binary file or no changes",
      })),
    };

    // 4. Generate AI analysis
    const analysis = await generateAIAnalysis(prContext);

    // 5. Save analysis to MCP filesystem
    await saveAnalysisToMCP(owner, repo, prNumber, analysis);

    // 6. Post AI review comment on GitHub
    await postAIReviewComment(owner, repo, prNumber, analysis);

    console.log(`✅ AI analysis completed for PR #${prNumber}`);
  } catch (error) {
    console.error(`❌ Error analyzing PR #${prNumber}:`, error);
  }
}

async function generateAIAnalysis(prContext) {
  console.log("🧠 Generating AI analysis...");

  const prompt = `
You are a senior software engineer conducting a code review. Analyze this Pull Request and provide constructive feedback.

PR DETAILS:
- Title: ${prContext.title}
- Description: ${prContext.description}
- Author: ${prContext.author}
- Files changed: ${prContext.filesChanged}
- Additions: ${prContext.additions} lines
- Deletions: ${prContext.deletions} lines

CODE CHANGES:
${prContext.files
  .map(
    (file) => `
File: ${file.filename} (${file.status})
+${file.additions} -${file.deletions}
\`\`\`diff
${file.patch.substring(0, 1000)}${
      file.patch.length > 1000 ? "...[truncated]" : ""
    }
\`\`\`
`
  )
  .join("\n")}

Please provide:
1. **Overall Assessment** (2-3 sentences)
2. **Key Strengths** (bullet points)
3. **Areas for Improvement** (bullet points with specific suggestions)
4. **Security Considerations** (if any)
5. **Performance Impact** (if relevant)
6. **Recommendation** (Approve/Request Changes/Comment)

Keep the review professional, constructive, and specific. Focus on code quality, best practices, and potential issues.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating AI analysis:", error);
    return "AI analysis failed. Please review manually.";
  }
}

async function saveAnalysisToMCP(owner, repo, prNumber, analysis) {
  console.log("💾 Saving analysis to MCP filesystem...");

  const timestamp = new Date().toISOString();
  const filename = `ai-analysis-${owner}-${repo}-pr${prNumber}-${timestamp.replace(
    /[:.]/g,
    "-"
  )}.md`;

  const analysisContent = `# AI Analysis for PR #${prNumber}

**Repository:** ${owner}/${repo}
**PR Number:** ${prNumber}
**Analysis Date:** ${timestamp}
**AI Model:** Gemini 1.5 Flash

---

${analysis}

---
*Generated by AI PR Analyzer using Google Gemini*
`;

  // Send via MCP to save to filesystem
  const saveMessage = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: {
      name: "write_file",
      arguments: {
        path: `context-data/${filename}`,
        content: analysisContent,
      },
    },
  };

  if (mcpSocket.readyState === WebSocket.OPEN) {
    mcpSocket.send(JSON.stringify(saveMessage));
    console.log(`📁 Analysis saved as: ${filename}`);
  }
}

async function postAIReviewComment(owner, repo, prNumber, analysis) {
  console.log("💬 Posting AI review comment...");

  const commentBody = `## 🤖 AI Code Review

${analysis}

---
*This review was generated automatically by AI. Please use human judgment for final decisions.*`;

  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody,
    });
    console.log(`✅ AI review comment posted on PR #${prNumber}`);
  } catch (error) {
    console.error("Error posting AI review comment:", error);
  }
}

mcpSocket.on("close", () => {
  console.log("🤖 AI PR Analyzer disconnected from MCP WebSocket proxy");
});

mcpSocket.on("error", (err) => {
  console.error("🤖 AI PR Analyzer WebSocket error:", err);
});

console.log("🤖 AI PR Analyzer started - waiting for pull requests...");
