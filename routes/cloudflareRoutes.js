const express = require("express");
const router = express.Router();
const cloudflareDomainController = require("../controllers/cloudflareDomainController");
const cloudflareDNSController = require("../controllers/cloudflareDNSController");

// Define routes for domains
router.post(
  "/cloudflare-add-domains",
  cloudflareDomainController.addDomainToCloudflare
);

router.post(
  "/cloudflare-domain-status",
  cloudflareDomainController.checkDomainStatus
);

router.post("/cloudflare-add-zone-id", cloudflareDomainController.addZoneId);

router.post("/cloudflare-add-dns-record", cloudflareDNSController.addDNSRecord);

module.exports = router;
