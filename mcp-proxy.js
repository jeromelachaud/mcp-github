const { spawn } = require("child_process");
const WebSocket = require("ws");
const readline = require("readline");
const path = require("path");
require("dotenv").config();

const contextPath = path.resolve(__dirname, "context-data");
const PORT = process.env.MCP_PROXY_PORT || 8080;

// Spawn the MCP filesystem server as a child process
const mcpServer = spawn(
  "npx",
  ["-y", "@modelcontextprotocol/server-filesystem", "./context-data"],
  {
    stdio: ["pipe", "pipe", "pipe"], // pipe stdin, stdout, and stderr
  }
);

mcpServer.on("error", (err) => {
  console.error("MCP server error:", err);
});
mcpServer.on("exit", (code, signal) => {
  console.log(`MCP server exited with code ${code} signal ${signal}`);
});
// Removed raw stdout listener to avoid conflicts with readline
mcpServer.stdin.on("error", (err) => {
  console.error("Error writing to MCP server stdin:", err);
});
mcpServer.stderr.on("data", (chunk) => {
  console.error("MCP server stderr:", chunk.toString());
});

console.log(`Spawned MCP filesystem server with PID ${mcpServer.pid}`);

// Temporary debug: Add raw stdout listener
mcpServer.stdout.on("data", (chunk) => {
  console.log("🔍 DEBUG: Raw MCP stdout:", chunk.toString());
});

// Read MCP server stdout line by line
const rl = readline.createInterface({
  input: mcpServer.stdout, // <- must be stdout stream of the MCP process
  output: process.stdout, // optional, usually stdout of your proxy process
  terminal: false,
});

// Keep track of connected WebSocket clients with their types
const clients = new Map(); // Map<WebSocket, {type: string, id: string}>

// Client types
const CLIENT_TYPES = {
  WEBHOOK_LISTENER: "webhook-listener",
  AUTO_COMMENTER: "auto-commenter",
  AI_ANALYZER: "ai-analyzer",
  UNKNOWN: "unknown",
};

// Create WebSocket server
const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`WebSocket MCP Proxy Server listening on ws://localhost:${PORT}`);
});

// Relay messages from MCP server to all WebSocket clients
// Log when readline interface is created
console.log("Readline interface created for MCP process");

// Add error and close event listeners for MCP process
mcpServer.on("error", (err) => {
  console.error("MCP process error:", err);
});
mcpServer.on("close", (code) => {
  console.log("MCP process closed with code:", code);
});

// Add error handler for readline interface
rl.on("error", (err) => {
  console.error("Readline interface error:", err);
});

rl.on("line", (line) => {
  console.log("🚀 ~ rl.on ~ line:", line);
  // Broadcast the MCP message to all connected clients
  for (const [ws, clientInfo] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(line);
    }
  }
});

// Optional: Test initialization (remove this in production)
// setTimeout(() => {
//   console.log("Sending test initialization message to MCP server...");
//   const initMessage = {
//     jsonrpc: "2.0",
//     id: 1,
//     method: "initialize",
//     params: {
//       protocolVersion: "2024-11-05",
//       capabilities: {},
//       clientInfo: {
//         name: "mcp-proxy",
//         version: "1.0.0",
//       },
//     },
//   };
//   mcpServer.stdin.write(JSON.stringify(initMessage) + "\n");
// }, 2000);

// Relay messages from WebSocket clients to MCP server stdin
function handleClientMessage(ws, message) {
  console.log("🚀 ~ handleClientMessage ~ raw message:", message);

  // Parse the message to see what it contains
  try {
    const parsed = JSON.parse(message);
    console.log("🚀 ~ handleClientMessage ~ parsed JSON:", parsed);

    // Skip client identification messages (these should have been handled earlier)
    if (parsed.type === "client-identity") {
      console.log(
        "🔍 ~ Skipping client-identity message in handleClientMessage"
      );
      return;
    }

    // Check if this is a webhook message with op: "merge"
    if (parsed.op === "merge") {
      console.log("🚀 ~ Received webhook merge operation");
      console.log("🚀 ~ Webhook payload:", parsed.payload);

      // Get client info for the sender
      const senderInfo = clients.get(ws);
      console.log("🚀 ~ Webhook sender:", senderInfo?.type || "unknown");

      // Only broadcast to AI services, not back to webhook listeners
      console.log("🚀 ~ Broadcasting webhook message to AI services only");
      for (const [client, clientInfo] of clients) {
        if (
          client.readyState === WebSocket.OPEN &&
          client !== ws &&
          (clientInfo.type === CLIENT_TYPES.AUTO_COMMENTER ||
            clientInfo.type === CLIENT_TYPES.AI_ANALYZER)
        ) {
          client.send(message);
          console.log(`🚀 ~ Sent webhook to ${clientInfo.type}`);
        }
      }

      // Save to filesystem via MCP (write to a file)
      const timestamp = new Date().toISOString();
      const filename = `webhook-${timestamp.replace(/[:.]/g, "-")}.json`;
      const writeFileMessage = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: "write_file",
          arguments: {
            path: `context-data/${filename}`,
            content: JSON.stringify(parsed.payload, null, 2),
          },
        },
      };

      console.log("🚀 ~ Saving webhook data to file via MCP:", filename);
      mcpServer.stdin.write(JSON.stringify(writeFileMessage) + "\n");
      return;
    }

    // Only send valid JSON-RPC messages to MCP server
    if (parsed.jsonrpc && parsed.method) {
      console.log(
        "🚀 ~ Sending valid JSON-RPC message to MCP server:",
        message
      );
      mcpServer.stdin.write(message + "\n");
    } else {
      console.log(
        "🚀 ~ Message is not a valid JSON-RPC format, not sending to MCP server"
      );
    }
  } catch (e) {
    console.error("🚀 ~ Failed to parse message as JSON:", e);
    console.log("🚀 ~ Raw message was:", message);
  }
}

// WebSocket connection handler
wss.on("connection", (ws) => {
  // Initially assign as unknown client
  const clientInfo = {
    type: CLIENT_TYPES.UNKNOWN,
    id: `client-${Date.now()}`,
    connectedAt: new Date().toISOString(),
  };

  clients.set(ws, clientInfo);
  console.log("New WebSocket client connected, total:", clients.size);

  ws.on("message", (message) => {
    let msgStr;
    if (Buffer.isBuffer(message)) {
      msgStr = message.toString("utf8");
    } else if (typeof message === "string") {
      msgStr = message;
    } else {
      // fallback: try to stringify
      msgStr = String(message);
    }

    console.log("🔍 ~ Raw message received:", msgStr.substring(0, 100));

    try {
      const json = JSON.parse(msgStr);

      console.log("🔍 ~ Parsed JSON type:", json.type);

      // Check for client identification message
      if (json.type === "client-identity") {
        clientInfo.type = json.clientType || CLIENT_TYPES.UNKNOWN;
        clientInfo.name = json.clientName || "unnamed";
        console.log(
          `🔍 ~ Client identified as: ${clientInfo.type} (${clientInfo.name})`
        );
        console.log(
          `🔍 ~ Total clients by type:`,
          Array.from(clients.values()).reduce((acc, client) => {
            acc[client.type] = (acc[client.type] || 0) + 1;
            return acc;
          }, {})
        );
        return;
      }

      console.log("🔄 ~ Regular message, forwarding to handleClientMessage");
      // Handle regular messages
      handleClientMessage(ws, JSON.stringify(json));
    } catch (e) {
      console.error("Received non-JSON message from client:", msgStr);
      // Optionally, ignore or handle as needed
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("WebSocket client disconnected, total:", clients.size);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});
