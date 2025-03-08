const express = require("express");
const router = express.Router();

const sgDomainAuthController = require("../controllers/sendgridDomainAuthController");

// Define routes for domains
router.post("/sendgrid-add-domain", sgDomainAuthController.authenticateDomain);

router.post(
  "/sendgrid-validate-domain",
  sgDomainAuthController.checkDomainAuthenticationStatus
);

router.post("/sendgrid-sender-auth", sgDomainAuthController.senderAuth);

module.exports = router;
