const express = require("express");
const router = express.Router();
const webformDomainRecordController = require("../controllers/webformDomainRecordController");

// POST request to store the webform data
router.post(
  "/submit-webfrom-domain-record",
  webformDomainRecordController.storeWebformDomainRecord
);

router.post(
  "/check-webform-domains",
  webformDomainRecordController.checkWebformDomains
);

module.exports = router;
