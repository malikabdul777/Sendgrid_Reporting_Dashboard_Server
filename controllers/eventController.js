const Event = require("../models/event.model");
const Domain = require("../models/domain.model");
const SpamReporter = require("../models/spamreporter.model");

const { extractDomain } = require("../utils/extractDomain");

// Handle SendGrid webhook POST requests
exports.handleEventLogs = async (req, res) => {
  const events = req.body;
  const bulkDomains = [];
  const bulkSpamReporters = [];
  const bulkEvents = [];
  const domainMap = new Map();

  try {
    // Loop through incoming events
    for (const event of events) {
      const domain = extractDomain(event["smtp-id"]);
      const eventType = event.event; // Extract the event type from the event object

      // Add the extracted domain to the event object
      const eventWithDomain = { ...event, domain };

      // Check if the event is a spam report
      if (eventType === "spamreport") {
        // Add the email and domain to the SpamReporters bulk array
        bulkSpamReporters.push({
          email: event.email, // Assuming the email is part of the event
          domain: domain,
        });
      }

      // Track all events, including spamreport, in a Map for later bulk update
      if (!domainMap.has(domain)) {
        domainMap.set(domain, { events: { [eventType]: 1 } });
      } else {
        const domainEntry = domainMap.get(domain);
        domainEntry.events[eventType] =
          (domainEntry.events[eventType] || 0) + 1;
      }

      // Add the event with the domain information to the bulk events array
      bulkEvents.push(eventWithDomain);
    }

    // Create bulk operations for domain and event counts
    for (const [domain, { events }] of domainMap.entries()) {
      const existingDomain = await Domain.findOne({ domain });

      if (!existingDomain) {
        // If the domain does not exist, prepare to create a new domain
        bulkDomains.push({
          insertOne: {
            document: { domain, events },
          },
        });
      } else {
        // Ensure the events object is initialized
        if (
          !existingDomain.events ||
          typeof existingDomain.events !== "object"
        ) {
          existingDomain.events = {}; // Initialize as an empty object if it's not defined or not an object
        }

        // Update the existing domain's event counts
        for (const eventType in events) {
          existingDomain.events[eventType] =
            (existingDomain.events[eventType] || 0) + events[eventType];
        }

        bulkDomains.push({
          updateOne: {
            filter: { domain },
            update: { $set: { events: existingDomain.events } },
          },
        });
      }
    }

    // Bulk insert spam reports
    if (bulkSpamReporters.length > 0) {
      await SpamReporter.insertMany(bulkSpamReporters);
    }

    // Bulk operations for domains
    if (bulkDomains.length > 0) {
      await Domain.bulkWrite(bulkDomains);
    }

    // Bulk insert events with potential spam report data
    if (bulkEvents.length > 0) {
      await Event.insertMany(bulkEvents);
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
