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
    sg_message_id: { type: String, required: false },

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

    // Domain field
    domain: String,
  },
  { timestamps: true }
);

// Indexing for fast retrieval by domain and sorting by timestamp
eventSchema.index({ domain: 1, timestamp: -1 });

const sg2ReportSchema = new mongoose.Schema({
  domain: { type: String, required: true, unique: true },
  eventCounts: {
    delivered: { type: Number, default: 0 },
    blocked: { type: Number, default: 0 },
  },
  blockedEmailHosts: {
    Gmail: { type: Number, default: 0 },
    Outlook: { type: Number, default: 0 },
    Yahoo: { type: Number, default: 0 },
    Hotmail: { type: Number, default: 0 },
    iCloud: { type: Number, default: 0 },
    otherDomain: { type: Number, default: 0 },
  },
});

const spamReportSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
  },
  { timestamps: true }
);

const Event = mongoose.model("Event", eventSchema);
const SG2_Report = mongoose.model("SG2_Report", sg2ReportSchema);
const SpamReport = mongoose.model("SpamReport", spamReportSchema);

module.exports = {
  Event,
  SG2_Report,
  SpamReport,
};
