const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const eventSchema = new Schema(
  {
    email: { type: String, required: false },
    timestamp: { type: Number, required: true },
    "smtp-id": { type: String, required: false },
    event: { type: String, required: true },
    category: { type: [String], required: false },
    sg_event_id: { type: String, required: true },
    sg_message_id: { type: String, required: true },

    // Optional fields for specific events
    response: { type: String, required: false },
    attempt: { type: Number, required: false },
    ip: { type: String, required: false },
    useragent: { type: String, required: false },
    url: { type: String, required: false },

    // Bounce-related fields
    reason: { type: String, required: false },
    status: { type: String, required: false },
    bounce_classification: { type: String, required: false },

    // Unsubscribe-related fields
    asm_group_id: { type: Number, required: false },

    // For 'group_unsubscribe' and 'group_resubscribe' events
    sg_machine_open: { type: Boolean, required: false },

    // Fields for account status change events
    type: { type: String, required: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
