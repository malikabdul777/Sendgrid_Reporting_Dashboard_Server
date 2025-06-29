const express = require('express');
const router = express.Router();
const shortLinkController = require('../controllers/shortLinkController');
const authController = require('../controllers/authController');

// Protect all routes after this middleware
router.use(authController.protect);

// POST /api/shortlinks - Create a new short link
router.post('/', shortLinkController.createLink);

// GET /api/shortlinks - Get all short links
router.get('/', shortLinkController.getAllLinks);

// PUT /api/shortlinks/:shortCode - Update an existing short link
router.put('/:shortCode', shortLinkController.updateLink);

// DELETE /api/shortlinks/:shortCode - Delete a short link
router.delete('/:shortCode', shortLinkController.deleteLink);

// GET /api/shortlinks/health - Health check endpoint
router.get('/health', shortLinkController.healthCheck);

module.exports = router;