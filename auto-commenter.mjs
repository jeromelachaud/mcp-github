import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import WebSocket from "ws";

// Load environment variables
dotenv.config();

// Load GitHub token from env for API calls
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "ws://localhost:8080";

if (!GITHUB_TOKEN) {
  console.error("Error: GITHUB_TOKEN environment variable not set");
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Connect to the MCP WebSocket proxy server
const mcpSocket = new WebSocket(MCP_SERVER_URL);

mcpSocket.on("open", () => {
  console.log("Auto-Commenter connected to MCP WebSocket proxy");

  // Identify this client to the MCP proxy
  const identity = {
    type: "client-identity",
    clientType: "auto-commenter",
    clientName: "GitHub Auto Commenter",
  };
  mcpSocket.send(JSON.stringify(identity));
});

async function hasAutoComment(owner, repo, prNumber) {
  try {
    const comments = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    // Check if we already posted an auto-comment (look for our signature)
    return comments.data.some((comment) =>
      comment.body.includes("Thanks for your PR! We will review it shortly. 🚀")
    );
  } catch (error) {
    console.error("Error checking for existing auto-comment:", error);
    return false; // If we can't check, assume no comment exists
  }
}

mcpSocket.on("message", async (data) => {
  const messageStr = Buffer.isBuffer(data) ? data.toString("utf8") : data;
  console.log("🚀 ~ mcpSocket.on ~ messageStr:", messageStr);

  let msg;
  try {
    msg = JSON.parse(messageStr);
  } catch (err) {
    console.error("Auto-Commenter: Invalid JSON message received", err);
    return;
  }

  // Check for GitHub PR opened event in MCP context update
  const githubEvent = msg.payload?.github;
  if (
    githubEvent &&
    githubEvent.pull_request &&
    githubEvent.action === "opened"
  ) {
    const pr = githubEvent.pull_request;
    const owner = pr.base.repo.owner.login;
    const repo = pr.base.repo.name;
    const issue_number = pr.number;

    console.log(`PR opened detected: ${owner}/${repo}#${issue_number}`);

    // Check if we already posted a comment on this PR
    const alreadyCommented = await hasAutoComment(owner, repo, issue_number);
    if (alreadyCommented) {
      console.log(
        `Auto-comment already exists on PR #${issue_number}, skipping`
      );
      return;
    }

    try {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number,
        body: "Thanks for your PR! We will review it shortly. 🚀",
      });
      console.log(`Comment posted on PR #${issue_number}`);
    } catch (err) {
      console.error("Failed to post comment on PR:", err);
    }
  }
});

mcpSocket.on("close", () => {
  console.log("Auto-Commenter disconnected from MCP WebSocket proxy");
});

mcpSocket.on("error", (err) => {
  console.error("Auto-Commenter WebSocket error:", err);
});
