const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const eventRoutes = require("./routes/eventRoutes");
const domainRoutes = require("./routes/domainRoutes");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use("/", eventRoutes);
app.use("/", domainRoutes);

module.exports = app;
