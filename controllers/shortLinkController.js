const Link = require('../models/Link.model.js');
const { uploadRedirectObject, deleteRedirectObject } = require('../services/s3Service.js');
const mongoose = require('mongoose');
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

/**
 * Check if MongoDB is connected
 * @returns {boolean} - True if connected
 */
const isMongoConnected = () => {
  return mongoose.connection.readyState === 1;
};

/**
 * Health check endpoint to verify database and service status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.healthCheck = async (req, res) => {
  try {
    const dbStatus = isMongoConnected();
    const timestamp = new Date().toISOString();
    
    // Test database connectivity with a simple query
    let dbTestResult = false;
    if (dbStatus) {
      try {
        await Link.findOne().limit(1);
        dbTestResult = true;
      } catch (dbError) {
        console.error('Database test query failed:', dbError.message);
        dbTestResult = false;
      }
    }
    
    const healthStatus = {
      status: dbStatus && dbTestResult ? 'healthy' : 'degraded',
      timestamp,
      services: {
        database: {
          connected: dbStatus,
          operational: dbTestResult,
          readyState: mongoose.connection.readyState,
          readyStateDescription: {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
          }[mongoose.connection.readyState]
        },
        api: {
          status: 'operational'
        }
      }
    };
    
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    
    return res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    console.error('Error in healthCheck:', error);
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
      error: error.message
    });
  }
};

/**
 * Handle database connection errors
 * @param {Object} res - Express response object
 * @param {string} operation - Operation being performed
 * @returns {Object} - Error response
 */
const handleDBConnectionError = (res, operation) => {
  console.error(`❌ DB unavailable: ${operation}`);
  return res.status(503).json({
    success: false,
    message: 'Database temporarily unavailable. Please try again later.',
    error: 'SERVICE_UNAVAILABLE'
  });
};

/**
 * Generate a random alphanumeric short code
 * @param {number} length - Length of the short code
 * @returns {string} - Random alphanumeric string
 */
const generateRandomShortCode = (length = 6) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid URL
 */
const isValidURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate custom short code format
 * @param {string} shortCode - Short code to validate
 * @returns {boolean} - True if valid format
 */
const isValidShortCode = (shortCode) => {
  const regex = /^[a-zA-Z0-9]{3,20}$/;
  return regex.test(shortCode);
};

/**
 * Create a new short link
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createLink = async (req, res) => {
  try {
    // Check database connection first
    if (!isMongoConnected()) {
      return handleDBConnectionError(res, 'create link');
    }

    const { targetURL, customShortCode } = req.body;

    // Validation: Check if targetURL is provided
    if (!targetURL) {
      return res.status(400).json({
        status: 'error',
        error: 'targetURL is required',
        message: 'Please provide a target URL to create a short link.'
      });
    }

    // Validation: Check if targetURL is a valid URL
    if (!isValidURL(targetURL)) {
      return res.status(400).json({
        status: 'error',
        error: 'Invalid URL format',
        message: 'Please provide a valid URL (including http:// or https://).'
      });
    }

    let shortCode;

    // Short Code Generation
    if (customShortCode) {
      // Validate custom short code format
      if (!isValidShortCode(customShortCode)) {
        return res.status(400).json({
          status: 'error',
          error: 'Invalid custom short code format',
          message: 'Custom short code must be alphanumeric and between 3-20 characters.'
        });
      }

      // Check if custom short code already exists
      if (!isMongoConnected()) {
        return handleDBConnectionError(res, 'check existing short code');
      }
      const existingLink = await Link.findOne({ shortCode: customShortCode });
      if (existingLink) {
        return res.status(409).json({
          status: 'error',
          error: 'Short code already exists',
          message: 'The custom short code is already in use. Please choose a different one.'
        });
      }

      shortCode = customShortCode;
    } else {
      // Generate random short code and ensure uniqueness
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isUnique && attempts < maxAttempts) {
        shortCode = generateRandomShortCode(6);
        if (!isMongoConnected()) {
          return handleDBConnectionError(res, 'generate unique short code');
        }
        const existingLink = await Link.findOne({ shortCode });
        if (!existingLink) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        return res.status(500).json({
          status: 'error',
          error: 'Unable to generate unique short code',
          message: 'Please try again or provide a custom short code.'
        });
      }
    }

    // S3 Upload
    try {
      await uploadRedirectObject(shortCode, targetURL);
    } catch (s3Error) {
      console.error('S3 upload error:', s3Error);
      return res.status(500).json({
        status: 'error',
        error: 'Failed to upload redirect object to S3',
        message: 'There was an error creating the short link. Please try again.',
        technical_details: s3Error.message
      });
    }

    // MongoDB Save
    try {
      if (!isMongoConnected()) {
        // Clean up S3 object if database is not available
        try {
          await deleteRedirectObject(shortCode);
        } catch (cleanupError) {
          console.error('Failed to cleanup S3 object after DB connection error:', cleanupError);
        }
        return handleDBConnectionError(res, 'save link to database');
      }

      const newLink = new Link({
        shortCode,
        targetURL
      });

      await newLink.save();
    } catch (dbError) {
      console.error('MongoDB save error:', dbError);
      
      // Clean up S3 object if MongoDB save fails
      try {
        await deleteRedirectObject(shortCode);
      } catch (cleanupError) {
        console.error('Failed to cleanup S3 object after MongoDB error:', cleanupError);
      }

      // Handle specific MongoDB errors
      if (dbError.name === 'MongoNetworkError' || dbError.message.includes('ECONNRESET')) {
        return res.status(503).json({
          status: 'error',
          error: 'Database connection lost',
          message: 'Database temporarily unavailable. Please try again later.'
        });
      }

      return res.status(500).json({
        status: 'error',
        error: 'Failed to save link to database',
        message: 'There was an error saving the short link. Please try again.',
        technical_details: dbError.message
      });
    }

    // Success Response
    const shortLinkURL = `https://${CLOUDFRONT_DOMAIN}/redirects_${shortCode}`;
    
    return res.status(201).json({
      status: 'success',
      message: 'Short link created successfully',
      data: {
        shortCode,
        shortLinkURL,
        targetURL
      }
    });

  } catch (error) {
    console.error('Error in createLink:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'MongoNetworkError' || error.message.includes('ECONNRESET')) {
      return res.status(503).json({
        status: 'error',
        error: 'Database connection lost',
        message: 'Database temporarily unavailable. Please try again later.'
      });
    }
    
    return res.status(500).json({
      status: 'error',
      error: 'Internal server error',
      message: 'An unexpected error occurred while creating the short link.',
      technical_details: error.message
    });
  }
};

/**
 * Get all short links
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllLinks = async (req, res) => {
  try {
    // Check database connection first
    if (!isMongoConnected()) {
      return handleDBConnectionError(res, 'retrieve links');
    }

    const links = await Link.find().sort({ createdAt: -1 });
    
    // Add full shortened URL to each link
    const linksWithFullURL = links.map(link => ({
      ...link.toObject(),
      shortLinkURL: `https://${CLOUDFRONT_DOMAIN}/redirects_${link.shortCode}`
    }));
    
    return res.status(200).json({
      status: 'success',
      message: 'Links retrieved successfully',
      data: linksWithFullURL,
      count: linksWithFullURL.length
    });
  } catch (error) {
    console.error('Error in getAllLinks:', error);
    
    // Handle specific MongoDB errors
     if (error.name === 'MongoNetworkError' || error.message.includes('ECONNRESET')) {
       return res.status(503).json({
         status: 'error',
         error: 'Database connection lost',
         message: 'Database temporarily unavailable. Please try again later.'
       });
     }
    
    return res.status(500).json({
      status: 'error',
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching links.',
      technical_details: error.message
    });
  }
};

/**
 * Update an existing short link
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateLink = async (req, res) => {
  try {
    // Check database connection first
    if (!isMongoConnected()) {
      return handleDBConnectionError(res, 'update link');
    }

    const { shortCode } = req.params;
    const { newTargetURL } = req.body;

    // Validation: Check if newTargetURL is provided
    if (!newTargetURL) {
      return res.status(400).json({
        status: 'error',
        error: 'newTargetURL is required',
        message: 'Please provide a new target URL to update the short link.'
      });
    }

    // Validation: Check if newTargetURL is a valid URL
    if (!isValidURL(newTargetURL)) {
      return res.status(400).json({
        status: 'error',
        error: 'Invalid URL format',
        message: 'Please provide a valid URL (including http:// or https://).'
      });
    }

    // Find the existing link
    if (!isMongoConnected()) {
      return handleDBConnectionError(res, 'find existing link');
    }
    const existingLink = await Link.findOne({ shortCode });
    if (!existingLink) {
      return res.status(404).json({
        status: 'error',
        error: 'Link not found',
        message: 'No short link found with the provided short code.'
      });
    }

    // Update S3 object with new target URL
    try {
      await uploadRedirectObject(shortCode, newTargetURL);
    } catch (s3Error) {
      console.error('S3 update error:', s3Error);
      return res.status(500).json({
        status: 'error',
        error: 'Failed to update redirect object in S3',
        message: 'There was an error updating the short link. Please try again.',
        technical_details: s3Error.message
      });
    }

    // Update MongoDB document
    try {
      if (!isMongoConnected()) {
        return handleDBConnectionError(res, 'update link in database');
      }
      existingLink.targetURL = newTargetURL;
      const updatedLink = await existingLink.save();

      return res.status(200).json({
        status: 'success',
        message: 'Short link updated successfully',
        data: updatedLink
      });
    } catch (dbError) {
      console.error('MongoDB update error:', dbError);
      return res.status(500).json({
        status: 'error',
        error: 'Failed to update link in database',
        message: 'There was an error updating the short link. Please try again.',
        technical_details: dbError.message
      });
    }

  } catch (error) {
    console.error('Error in updateLink:', error);
    
    // Handle specific MongoDB errors
     if (error.name === 'MongoNetworkError' || error.message.includes('ECONNRESET')) {
       return res.status(503).json({
         status: 'error',
         error: 'Database connection lost',
         message: 'Database temporarily unavailable. Please try again later.'
       });
     }
    
    return res.status(500).json({
      status: 'error',
      error: 'Internal server error',
      message: 'An unexpected error occurred while updating the short link.',
      technical_details: error.message
    });
  }
};

/**
 * Delete a short link
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteLink = async (req, res) => {
  try {
    // Check database connection first
    if (!isMongoConnected()) {
      return handleDBConnectionError(res, 'delete link');
    }

    const { shortCode } = req.params;

    // Find the existing link
    const existingLink = await Link.findOne({ shortCode });
    if (!existingLink) {
      return res.status(404).json({
        status: 'error',
        error: 'Link not found',
        message: 'No short link found with the provided short code.'
      });
    }

    // Delete from MongoDB first
    try {
      if (!isMongoConnected()) {
        return handleDBConnectionError(res, 'delete link from database');
      }
      await Link.deleteOne({ shortCode });
    } catch (dbError) {
      console.error('MongoDB delete error:', dbError);
      return res.status(500).json({
        status: 'error',
        error: 'Failed to delete link from database',
        message: 'There was an error deleting the short link. Please try again.',
        technical_details: dbError.message
      });
    }

    // Delete from S3
    try {
      await deleteRedirectObject(shortCode);
    } catch (s3Error) {
      console.error('S3 delete error:', s3Error);
      // Log the error but don't fail the request since MongoDB deletion succeeded
      console.warn('S3 object deletion failed, but MongoDB deletion succeeded:', s3Error.message);
    }

    return res.status(200).json({
      status: 'success',
      message: 'Short link deleted successfully',
      data: {
        deletedShortCode: shortCode
      }
    });

  } catch (error) {
    console.error('Error in deleteLink:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'MongoNetworkError' || error.message.includes('ECONNRESET')) {
      return res.status(503).json({
        status: 'error',
        error: 'Database connection lost',
        message: 'Database service temporarily unavailable. Please try again later.',
        technical_details: 'Network connection to database was reset'
      });
    }
    
    return res.status(500).json({
      status: 'error',
      error: 'Internal server error',
      message: 'An unexpected error occurred while deleting the short link.',
      technical_details: error.message
    });
  }
};