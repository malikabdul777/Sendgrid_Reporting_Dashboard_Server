const mongoose = require("mongoose");
const eventSchema = require("../models/event.model").schema; // Import the schema (not the model)

// Function to dynamically get or create a model for each event type
const getEventModel = (eventType) => {
  // Use mongoose.model to retrieve or create a new model with the event type as the collection name
  return mongoose.model(eventType, eventSchema, eventType);
};

exports.handleEventLogs = async (req, res) => {
  try {
    const eventsData = req.body;

    if (Array.isArray(eventsData)) {
      // Loop through each event in the data array
      for (const event of eventsData) {
        // Ensure smtp-id exists
        const eventWithSmtpId = {
          ...event,
          "smtp-id": event["smtp-id"] || "not found",
        };

        // Check if it's a bounce event with blocked type
        if (event.event === "bounce" && event.type === "blocked") {
          const BlockedEventModel = getEventModel("blocked");
          const eventInstance = new BlockedEventModel(eventWithSmtpId);
          await eventInstance.save();
        } else {
          const EventModel = getEventModel(event.event);
          const eventInstance = new EventModel(eventWithSmtpId);
          await eventInstance.save();
        }
      }
    } else {
      // Handle single event
      const eventWithSmtpId = {
        ...eventsData,
        "smtp-id": eventsData["smtp-id"] || "not found",
      };

      if (eventsData.event === "bounce" && eventsData.type === "blocked") {
        const BlockedEventModel = getEventModel("blocked");
        const eventInstance = new BlockedEventModel(eventWithSmtpId);
        await eventInstance.save();
      } else {
        const EventModel = getEventModel(eventsData.event);
        const eventInstance = new EventModel(eventWithSmtpId);
        await eventInstance.save();
      }
    }

    res.status(201).json({ message: "Events saved successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error saving events", error });
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
