const mongoose = require("mongoose");

const webformDomainRecordSchema = new mongoose.Schema({
  webformId: { type: String, required: true },
  dataName: { type: String, required: true },
  domainsList: { type: [String], required: true },
  domainAddedOnDate: { type: Date, required: true },
});

const WebformDomainRecord = mongoose.model(
  "WebformDomainRecord",
  webformDomainRecordSchema
);

module.exports = WebformDomainRecord;
