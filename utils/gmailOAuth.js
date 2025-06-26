const { google } = require('googleapis');

/**
 * Creates and configures a Google OAuth2 client
 * @param {Object} credentials - OAuth2 credentials
 * @param {string} credentials.client_id - Google API client ID
 * @param {string} credentials.client_secret - Google API client secret
 * @param {string} credentials.refresh_token - OAuth2 refresh token (optional)
 * @returns {Object} - Configured OAuth2 client
 */
const createOAuth2Client = (credentials) => {
  const { client_id, client_secret, refresh_token } = credentials;
  
  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    process.env.GMAIL_REDIRECT_URI
  );

  // Set credentials if refresh token is provided
  if (refresh_token) {
    oauth2Client.setCredentials({
      refresh_token: refresh_token
    });
  }

  return oauth2Client;
};



/**
 * Process CSV data and replace template variables in HTML content
 * @param {string} csvData - CSV data as string
 * @param {string} htmlTemplate - HTML template with placeholders
 * @returns {Array} - Array of objects with recipient email and personalized HTML content
 */
const processTemplateWithCsv = (csvData, htmlTemplate) => {
  // Parse CSV data
  const rows = csvData.trim().split('\n');
  const headers = rows[0].split(',').map(header => header.trim());
  
  const results = [];
  
  // Process each row (skip header row)
  for (let i = 1; i < rows.length; i++) {
    const rowData = rows[i].split(',').map(cell => cell.trim());
    const rowObj = {};
    
    // Create object with column headers as keys
    headers.forEach((header, index) => {
      rowObj[header] = rowData[index] || '';
    });
    
    // Skip row if no email
    if (!rowObj.email) continue;
    
    // Replace placeholders in HTML template
    let personalizedHtml = htmlTemplate;
    
    // Replace all placeholders (#header) with corresponding values
    headers.forEach(header => {
      const placeholder = new RegExp(`#${header}`, 'g');
      personalizedHtml = personalizedHtml.replace(placeholder, rowObj[header] || '');
    });
    
    results.push({
      email: rowObj.email,
      html: personalizedHtml
    });
  }
  
  return results;
};

module.exports = {
  createOAuth2Client,
  processTemplateWithCsv
};