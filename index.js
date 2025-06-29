const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const eventRoutes = require("./routes/eventRoutes");
const domainRoutes = require("./routes/domainRoutes");
const cloudflareRoutes = require("./routes/cloudflareRoutes");
const sendgridRoutes = require("./routes/sendgridRoutes");
const webformDomainRecordRoutes = require("./routes/webformDomainRecordRoutes");
const gmailRoutes = require("./routes/gmailRoutes");
const shortLinkRoutes = require("./routes/shortLinkRoutes");
const authRoutes = require("./routes/authRoutes");
const globalErrorHandler = require("./middleware/errorHandler");
const AppError = require("./utils/appError");

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:5173',
    'https://sendgrid-abdul.netlify.app'
  ],
  credentials: true
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/", eventRoutes);
app.use("/", domainRoutes);
app.use("/", cloudflareRoutes);
app.use("/", sendgridRoutes);
app.use("/", webformDomainRecordRoutes);
app.use("/", gmailRoutes);
app.use("/shortlinks", shortLinkRoutes);

// Handle undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handling middleware
app.use(globalErrorHandler);

module.exports = app;
