const express = require("express");
const router = express.Router();
const domainController = require("../controllers/domainController");

// Define routes for domains
router.get("/domains", domainController.getAllDomains);

module.exports = router;
