const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// Public routes (no authentication required)
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

module.exports = router;