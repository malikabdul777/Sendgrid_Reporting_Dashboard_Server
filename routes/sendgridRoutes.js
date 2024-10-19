const express = require("express");
const router = express.Router();

const sgDomainAuthController = require("../controllers/sendgridDomainAuthController");

// Define routes for domains
router.post("/sendgrid-add-domain", sgDomainAuthController.authenticateDomain);

router.post(
  "/sendgrid-validate-domain",
  sgDomainAuthController.checkDomainAuthenticationStatus
);

module.exports = router;
