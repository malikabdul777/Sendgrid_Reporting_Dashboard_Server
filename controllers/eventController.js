const mongoose = require("mongoose");
const { Event, SG2_Report, SpamReport } = require("../models/event.model");
const { schema: eventSchema } = Event; // Get the schema from the Event model

// Function to update existing documents with lastUpdated field
const updateExistingDocuments = async () => {
  try {
    const result = await SG2_Report.updateMany(
      { lastUpdated: { $exists: false } },
      { $set: { lastUpdated: new Date() } }
    );
    console.log("Updated existing documents with lastUpdated:", result);
  } catch (error) {
    console.error("Error updating existing documents:", error);
  }
};

// Call the update function when the module is loaded
updateExistingDocuments();

// Function to dynamically get or create a model for each event type
const getEventModel = (eventType) => {
  // Use mongoose.model to retrieve or create a new model with the event type as the collection name
  try {
    return mongoose.model(eventType);
  } catch {
    return mongoose.model(eventType, eventSchema, eventType);
  }
};

// Function to extract domain from smtp-id
const extractDomain = (smtpId) => {
  if (!smtpId) {
    console.log("WARNING: No SMTP ID provided");
    return "not found";
  }

  // Remove angle brackets and extract everything after @
  const afterAt = smtpId.replace(/[<>]/g, "").split("@")[1];

  // Remove 'mx.' prefix if it exists
  const domain = afterAt?.replace(/^mx\./, "");

  if (!domain) {
    console.log("WARNING: Failed to extract domain from SMTP ID:", {
      smtpId,
      afterAt,
      domain,
    });
  }

  return domain || "not found";
};

// Function to identify email host
const getEmailHost = (email) => {
  if (!email) return "otherDomain";

  const lowerEmail = email.toLowerCase();
  if (lowerEmail.includes("gmail")) return "Gmail";
  if (lowerEmail.includes("outlook")) return "Outlook";
  if (lowerEmail.includes("yahoo")) return "Yahoo";
  if (lowerEmail.includes("hotmail")) return "Hotmail";
  if (lowerEmail.includes("icloud")) return "iCloud";
  return "otherDomain";
};

// Function to update SG2_Report
const updateSG2Report = async (domain, eventType, blockedEmail = null) => {
  try {
    let report = await SG2_Report.findOne({ domain });

    if (!report) {
      report = new SG2_Report({
        domain,
        eventCounts: { delivered: 0, blocked: 0 },
        blockedEmailHosts: {
          Gmail: 0,
          Outlook: 0,
          Yahoo: 0,
          Hotmail: 0,
          iCloud: 0,
          otherDomain: 0,
        },
      });
    }

    report.eventCounts[eventType]++;

    if (eventType === "blocked" && blockedEmail) {
      const emailHost = getEmailHost(blockedEmail);
      report.blockedEmailHosts[emailHost]++;
    }

    report.lastUpdated = new Date();
    await report.save();
  } catch (error) {
    console.error("Error updating SG2_Report:", error);
    throw error;
  }
};

exports.handleEventLogs = async (req, res) => {
  try {
    const eventsData = req.body;

    const processEvent = async (event) => {
      // For spamreport events, just store the email and return
      if (event.event === "spamreport") {
        if (event.email) {
          try {
            await SpamReport.create({ email: event.email });
          } catch (error) {
            console.error("Error saving spam report:", error);
            throw error;
          }
        }
        return;
      }

      const eventWithSmtpId = {
        ...event,
        "smtp-id": event["smtp-id"] || "not found",
      };

      if (!event["smtp-id"]) {
        console.log("WARNING: Event missing SMTP ID. Full event data:", {
          fullEvent: event,
          timestamp: new Date().toISOString(),
        });
      }

      // Extract domain from smtp-id
      const domain = extractDomain(eventWithSmtpId["smtp-id"]);

      if (domain === "not found") {
        console.log("WARNING: Could not extract domain:", {
          event: event.event,
          smtpId: eventWithSmtpId["smtp-id"],
        });
      }

      if (event.event === "delivered") {
        await updateSG2Report(domain, "delivered");
      } else if (event.event === "bounce" && event.type === "blocked") {
        await updateSG2Report(domain, "blocked", event.email);

        const BlockedEventModel = getEventModel("blocked");
        const eventInstance = new BlockedEventModel(eventWithSmtpId);
        await eventInstance.save();
      } else {
        const EventModel = getEventModel(event.event);
        const eventInstance = new EventModel(eventWithSmtpId);
        await eventInstance.save();
      }
    };

    if (Array.isArray(eventsData)) {
      await Promise.all(eventsData.map(processEvent));
    } else {
      await processEvent(eventsData);
    }

    res.status(201).json({ message: "Events processed successfully" });
  } catch (error) {
    console.error("Error processing events:", error);
    res.status(500).json({ message: "Error processing events", error });
  }
};

// Handle incoming webhook events and store them in separate collections based on event type
// exports.handleEventLogs = async (req, res) => {
//   try {
//     const eventsData = req.body; // Get event data from request body

//     if (Array.isArray(eventsData)) {
//       // Loop through each event in the data array
//       for (const event of eventsData) {
//         const EventModel = getEventModel(event.event); // Get the model for the event type
//         const eventInstance = new EventModel(event);
//         await eventInstance.save(); // Save each event in the respective collection
//       }
//     } else {
//       const EventModel = getEventModel(eventsData.event); // Handle a single event if not an array
//       const eventInstance = new EventModel(eventsData);
//       await eventInstance.save();
//     }

//     res.status(201).json({ message: "Events saved successfully" });
//   } catch (error) {
//     res.status(500).json({ message: "Error saving events", error });
//   }
// };

exports.getEventsByTypeAndDateRange = async (req, res) => {
  const { eventType, startDate, endDate } = req.query;

  // Check if required parameters are provided
  if (!eventType || !startDate || !endDate) {
    return res
      .status(400)
      .json({ message: "Please provide eventType, startDate, and endDate." });
  }

  try {
    // Parse the provided dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Set end date to the end of the day

    const EventModel = getEventModel(eventType); // Get model based on event type

    // Fetch events from the collection within the date range
    const events = await EventModel.find({
      timestamp: {
        $gte: Math.floor(start.getTime() / 1000),
        $lte: Math.floor(end.getTime() / 1000),
      },
    });

    // Return the found events
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving events", error });
  }
};

// Function to get the appropriate model name based on number
const getSGModelName = (number) => `SG${number}_Report`;

// Get reports from specified collection
exports.getSGReports = async (req, res) => {
  try {
    const { number } = req.params;

    // Validate number
    if (!number || isNaN(number) || number < 2) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid number (2 or greater)",
      });
    }

    const modelName = getSGModelName(number);

    try {
      const Model = mongoose.model(modelName);
      const reports = await Model.find({});

      res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: `Collection ${modelName} not found`,
      });
    }
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching reports",
      error: error.message,
    });
  }
};

// Delete domain from specified collection
exports.deleteSGReportByDomain = async (req, res) => {
  try {
    const { number } = req.params;
    const { domain } = req.query;

    // Validate inputs
    if (!number || isNaN(number) || number < 2) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid number (2 or greater)",
      });
    }

    if (!domain) {
      return res.status(400).json({
        success: false,
        message: "Please provide a domain to delete",
      });
    }

    const modelName = getSGModelName(number);

    try {
      const Model = mongoose.model(modelName);
      const result = await Model.findOneAndDelete({ domain });

      if (!result) {
        return res.status(404).json({
          success: false,
          message: `Domain ${domain} not found in ${modelName}`,
        });
      }

      res.status(200).json({
        success: true,
        message: `Successfully deleted ${domain} from ${modelName}`,
        data: result,
      });
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: `Collection ${modelName} not found`,
      });
    }
  } catch (error) {
    console.error("Error deleting domain:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting domain",
      error: error.message,
    });
  }
};

// Get all spam reports
exports.getSpamReports = async (req, res) => {
  try {
    const reports = await SpamReport.find({}).sort({ createdAt: -1 }); // Sort by newest first

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    console.error("Error fetching spam reports:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching spam reports",
      error: error.message,
    });
  }
};

// Clear all spam reports
exports.clearSpamReports = async (req, res) => {
  try {
    const result = await SpamReport.deleteMany({});

    res.status(200).json({
      success: true,
      message: "Successfully cleared all spam reports",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error clearing spam reports:", error);
    res.status(500).json({
      success: false,
      message: "Error clearing spam reports",
      error: error.message,
    });
  }
};
