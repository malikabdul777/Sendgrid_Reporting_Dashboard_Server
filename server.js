const mongoose = require("mongoose");
const dotenv = require("dotenv");
const http = require("http");
const WebSocket = require("ws");

dotenv.config({ path: "./config.env" });

const app = require("./index");

// Configure MongoDB connection options
const mongoOptions = {
  serverSelectionTimeoutMS: 60000, // Increase timeout to 60 seconds
  socketTimeoutMS: 90000, // Increase socket timeout to 90 seconds
  connectTimeoutMS: 60000, // Connection timeout
  family: 4, // Use IPv4, skip trying IPv6
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10, // Limit concurrent connections
  minPoolSize: 1,
};

// Connect to MongoDB
const connectWithRetry = () => {
  console.log("Attempting to connect to MongoDB...");
  mongoose
    .connect(
      `${process.env.DATABASE.replace(
        "<PASSWORD>",
        process.env.DATABASE_PASSWORD
      )}`,
      mongoOptions
    )
    .then(() => {
      console.log("Connected to MongoDB successfully!");
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err.message);
      console.error("Error details:", err);
      console.log("Will retry connection in 5 seconds...");
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

// Add connection event handlers
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected. Attempting to reconnect...");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected successfully!");
});

const port = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({
  server,
  path: "/api/email-status",
});

// WebSocket connection handler
wss.on("connection", (ws) => {
  console.log("WebSocket client connected");

  // Store the WebSocket connection for later use
  global.emailStatusWs = ws;

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
    global.emailStatusWs = null;
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Server started on port ${port}!`);
  console.log(
    `WebSocket server running at ws://localhost:${port}/api/email-status`
  );
});
