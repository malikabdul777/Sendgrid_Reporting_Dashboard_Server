// models/Domain.js
const mongoose = require("mongoose");

const CloudflareDomainSchema = new mongoose.Schema({
  domainName: {
    type: String,
    required: true,
  },
  zoneId: {
    type: String,
    required: true,
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Cloudflare Domain", CloudflareDomainSchema);
