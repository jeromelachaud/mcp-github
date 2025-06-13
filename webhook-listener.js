const express = require("express");
const bodyParser = require("body-parser");
const WebSocket = require("ws");
require("dotenv").config();

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "ws://localhost:8080";
const PORT = process.env.WEBHOOK_LISTENER_PORT || 3000;
const app = express();
app.use(bodyParser.json());

const mcpSocket = new WebSocket(MCP_SERVER_URL);

mcpSocket.on("open", () => {
  console.log("Connected to MCP Server");

  // Identify this client to the MCP proxy
  const identity = {
    type: "client-identity",
    clientType: "webhook-listener",
    clientName: "GitHub Webhook Listener",
  };
  mcpSocket.send(JSON.stringify(identity));
});

// Simple health check endpoint
app.get("/h", (req, res) => {
  res.status(200).send("ok");
});

app.post("/webhook", (req, res) => {
  const githubEvent = req.body;

  // Wrap the GitHub event in MCP format with op: "merge"
  const updateMsg = {
    op: "merge",
    payload: { github: githubEvent },
  };

  console.log("🚀 ~ app.post ~ Sending MCP update:", updateMsg);

  if (mcpSocket && mcpSocket.readyState === WebSocket.OPEN) {
    mcpSocket.send(JSON.stringify(updateMsg));
  } else {
    console.error("MCP WebSocket is not connected.");
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Webhook listener running on port ${PORT}`);
});
