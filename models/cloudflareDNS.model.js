// models/DNSRecord.js
const mongoose = require("mongoose");

const DNSRecordSchema = new mongoose.Schema({
  domainName: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  ttl: {
    type: Number,
    default: 120, // TTL (Time To Live) in seconds, 120 is a common default
  },
  priority: {
    type: Number,
    default: 0,
    required: false,
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("DNSRecord", DNSRecordSchema);
