const express = require("express");
const eventController = require("../controllers/eventController");

const router = express.Router();

// Route to handle incoming webhook events
router.route("/sendgrid-event").post(eventController.handleEventLogs);

// Route to get events by domain
// router.route("/events").get(eventController.getEventsByDomain);

// Route to get events by event type and date range
router.route("/events").get(eventController.getEventsByTypeAndDateRange);

// New routes for fetching and deleting SG reports
router
  .route("/sg-reports/:number")
  .get(eventController.getSGReports)
  .delete(eventController.deleteSGReportByDomain);

// New spam reports routes
router
  .route("/spam-reports")
  .get(eventController.getSpamReports)
  .delete(eventController.clearSpamReports);

module.exports = router;
