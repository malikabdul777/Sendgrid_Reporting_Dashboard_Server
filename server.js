const mongoose = require("mongoose");
const dotenv = require("dotenv");
const http = require("http");
const WebSocket = require("ws");

dotenv.config({ path: "./config.env" });

const app = require("./index");

// Configure MongoDB connection options with enhanced error handling
const mongoOptions = {
  serverSelectionTimeoutMS: 30000, // Reduced from 60s to 30s for faster failure detection
  socketTimeoutMS: 45000, // Reduced socket timeout
  connectTimeoutMS: 30000, // Reduced connection timeout
  family: 4, // Use IPv4, skip trying IPv6
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10, // Limit concurrent connections
  minPoolSize: 1,
  bufferCommands: false, // Disable mongoose buffering
  heartbeatFrequencyMS: 10000, // Check connection every 10 seconds
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
};

// Enhanced MongoDB connection with better error handling
let retryCount = 0;
const maxRetries = 5; // Reduced from 10 to 5
const baseRetryDelay = 5000; // Increased from 2s to 5s

const connectWithRetry = () => {
  if (retryCount >= maxRetries) {
    console.error(
      `❌ Failed to connect to MongoDB after ${maxRetries} attempts. Server will continue without database.`
    );
    console.error(
      "Please check your MongoDB Atlas connection string and network connectivity."
    );
    return;
  }

  retryCount++;
  const retryDelay = Math.min(
    baseRetryDelay * Math.pow(2, retryCount - 1),
    30000
  ); // Exponential backoff, max 30s

  console.log(
    `🔄 Attempting to connect to MongoDB (attempt ${retryCount}/${maxRetries})...`
  );

  mongoose
    .connect(
      `${process.env.DATABASE.replace(
        "<PASSWORD>",
        process.env.DATABASE_PASSWORD
      )}`,
      mongoOptions
    )
    .then(() => {
      console.log("✅ Connected to MongoDB successfully!");
      retryCount = 0; // Reset retry count on successful connection
    })
    .catch((err) => {
      // Clean error message formatting
      const errorMsg = err.message || 'Unknown error';
      console.error(`❌ MongoDB connection failed (${retryCount}/${maxRetries}): ${errorMsg}`);

      // Log specific error types for better debugging
      if (err.code === "ECONNRESET") {
        console.error("🔍 Network connection reset - Check IP whitelist and firewall");
      } else if (err.code === "ENOTFOUND") {
        console.error("🔍 DNS resolution failed - Check connection string");
      } else if (errorMsg.includes("authentication")) {
        console.error("🔍 Authentication failed - Check credentials");
      }

      if (retryCount < maxRetries) {
        console.log(`⏳ Retrying in ${retryDelay / 1000}s...`);
        setTimeout(connectWithRetry, retryDelay);
      } else {
        console.error('❌ Max retry attempts reached. Server will continue without database.');
      }
    });
};

// Start initial connection
connectWithRetry();

// Enhanced connection event handlers
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB runtime error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB disconnected - MongoDB will handle automatic reconnection");
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB reconnected successfully!");
});

mongoose.connection.on("connected", () => {
  console.log("🔗 MongoDB connection established");
});

// Graceful shutdown handling
process.on("SIGINT", async () => {
  console.log("\n🛑 Received SIGINT. Gracefully shutting down...");
  try {
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during shutdown:", err);
    process.exit(1);
  }
});

// Duplicate event handlers removed - using the enhanced ones above

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
