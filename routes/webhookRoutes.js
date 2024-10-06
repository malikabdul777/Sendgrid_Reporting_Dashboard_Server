const express = require("express");
const webhookController = require("../controllers/webhookController");

const router = express.Router();

// Define route to handle incoming webhook events

// router.post("/sendgrid-webhook", webhookController.handleEventLogs);
router.route("/sendgrid-webhook").post(webhookController.handleEventLogs);

module.exports = router;
