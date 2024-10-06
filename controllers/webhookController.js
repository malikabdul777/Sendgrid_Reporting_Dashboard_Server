const Event = require("../models/webhook.model");

// Handle SendGrid webhook POST requests
exports.handleEventLogs = async (req, res) => {
  try {
    const events = req.body;

    // Ensure it's an array before processing
    if (Array.isArray(events)) {
      // Insert event logs into MongoDB
      await Event.insertMany(events);
      res.status(200).send("Events received and stored");
    } else {
      // If the incoming data is not an array, return a bad request error
      res.status(400).send("Expected an array of event logs");
    }
  } catch (error) {
    console.error("Error storing events:", error);
    res.status(500).send("Error storing events");
  }
};
