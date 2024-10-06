const express = require("express");
const eventController = require("../controllers/eventController");

const router = express.Router();

// Route to handle incoming webhook events
router.route("/sendgrid-event").post(eventController.handleEventLogs);

// Route to get events by domain
router.route("/events").get(eventController.getEventsByDomain);

module.exports = router;
