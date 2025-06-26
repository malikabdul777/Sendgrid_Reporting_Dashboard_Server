const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const eventRoutes = require("./routes/eventRoutes");
const domainRoutes = require("./routes/domainRoutes");
const cloudflareRoutes = require("./routes/cloudflareRoutes");
const sendgridRoutes = require("./routes/sendgridRoutes");
const webformDomainRecordRoutes = require("./routes/webformDomainRecordRoutes");
const gmailRoutes = require("./routes/gmailRoutes");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use("/", eventRoutes);
app.use("/", domainRoutes);
app.use("/", cloudflareRoutes);
app.use("/", sendgridRoutes);
app.use("/", webformDomainRecordRoutes);
app.use("/", gmailRoutes);

module.exports = app;
