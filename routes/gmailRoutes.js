const express = require('express');
const router = express.Router();
const gmailController = require('../controllers/gmailController');

// Send email using Gmail API with CSV template processing (stateless OAuth)
router.post('/gmail/send', gmailController.uploadRecipientList, gmailController.sendEmail);

module.exports = router;