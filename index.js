const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const webhookRoutes = require("./routes/webhookRoutes");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use("/", webhookRoutes);

module.exports = app;
