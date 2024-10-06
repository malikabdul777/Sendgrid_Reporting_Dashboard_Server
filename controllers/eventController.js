const Event = require("../models/event.model");
const Domain = require("../models/domain.model");
const { extractDomain } = require("../utils/extractDomain");

// Handle SendGrid webhook POST requests
exports.handleEventLogs = async (req, res) => {
  try {
    const events = req.body;

    for (const event of events) {
      const domain = extractDomain(event["smtp-id"]);

      // Check if the domain already exists in the domains collection
      let existingDomain = await Domain.findOne({ domain });
      if (!existingDomain) {
        // If the domain does not exist, add it to the domains collection
        const newDomain = new Domain({ domain });
        await newDomain.save();
      }

      // Add the extracted domain to the event object
      const eventWithDomain = { ...event, domain };

      // Store the event with domain info in MongoDB
      const newEvent = new Event(eventWithDomain);
      await newEvent.save();
    }

    res.status(200).send({ message: "Events saved successfully" });
  } catch (error) {
    console.error("Error saving event:", error);
    res.status(500).send({ message: "Error saving event" });
  }
};

// Get events by domain with pagination
exports.getEventsByDomain = async (req, res) => {
  const { domain, limit = 100 } = req.query;

  try {
    const events = await Event.find({ domain })
      .sort({ timestamp: -1 }) // Most recent first
      .limit(parseInt(limit));

    res.status(200).json({ events });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).send({ message: "Error fetching events" });
  }
};
