const mongoose = require("mongoose");

const SGAuthenticatedDomainSchema = new mongoose.Schema({
  domainName: { type: String, required: true },
  domainId: { type: String, required: true },
  authenticatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model(
  "SGAuthenticatedDomain",
  SGAuthenticatedDomainSchema
);
