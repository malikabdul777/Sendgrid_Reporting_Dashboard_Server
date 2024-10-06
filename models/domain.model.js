const mongoose = require("mongoose");

const domainSchema = new mongoose.Schema(
  {
    domain: { type: String, unique: true, required: true },
  },
  { timestamps: true }
);

// Index on name to speed up domain lookups
domainSchema.index({ name: 1 });

module.exports = mongoose.model("Domain", domainSchema);
