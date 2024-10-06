const mongoose = require("mongoose");

const spamReporterSchema = new mongoose.Schema({
  email: { type: String, required: true },
  domain: { type: String, required: true },
  reportedAt: { type: Date, default: Date.now },
});

const SpamReporter = mongoose.model("SpamReporter", spamReporterSchema);
module.exports = SpamReporter;
