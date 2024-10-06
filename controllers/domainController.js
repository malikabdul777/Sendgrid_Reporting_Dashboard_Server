const Domain = require("../models/domain.model");

// Get all domains for dropdown options
exports.getAllDomains = async (req, res) => {
  try {
    const domains = await Domain.find({});
    res.status(200).json({ domains });
  } catch (error) {
    console.error("Error fetching domains:", error);
    res.status(500).send({ message: "Error fetching domains" });
  }
};
