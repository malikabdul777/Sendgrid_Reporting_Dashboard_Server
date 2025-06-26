# Gmail OAuth2 Email Sender - Updated Flow

This document describes the updated Gmail OAuth2 email sending functionality for the Node.js and Express backend.

## Overview of Changes

The Gmail OAuth2 integration has been updated to:

1. Use `user_email` as the unique key for identifying and managing refresh tokens
2. Remove all access token handling logic
3. Support dynamic content replacement in HTML email bodies using CSV data
4. Maintain real-time delivery status updates via Server-Sent Events (SSE)

## API Endpoints

### 1. Check Token Status

**Endpoint:** `POST /gmail/check-token`

**Request Body:**
```json
{
  "user_email": "user@example.com"
}
```

**Response (Token Exists):**
```json
{
  "success": true,
  "message": "OAuth credentials found.",
  "authorized": true
}
```

**Response (Token Does Not Exist):**
```json
{
  "success": true,
  "message": "OAuth credentials not found. Authorization required.",
  "authorized": false
}
```

### 2. Save Refresh Token

**Endpoint:** `POST /gmail/save-token`

**Request Body:**
```json
{
  "user_email": "user@example.com",
  "refresh_token": "YOUR_REFRESH_TOKEN",
  "client_id": "YOUR_GOOGLE_CLIENT_ID",
  "client_secret": "YOUR_GOOGLE_CLIENT_SECRET"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Refresh token saved successfully.",
  "user_email": "user@example.com"
}
```

### 3. Send Email with Template

**Endpoint:** `POST /gmail/send-email`

**Request Format:** `multipart/form-data`

**Form Fields:**
- `user_email`: The sender's email address
- `subject`: Email subject line
- `html_template`: HTML template with merge tags (e.g., `#name`, `#email`, etc.)
- `csv_file`: CSV file with recipient data (must include an 'email' column)

**Response:** 
- Initial JSON response with status information
- Real-time status updates via WebSocket connection to `ws://[your-server]/api/email-status`

## Authentication Flow

1. Frontend calls `/gmail/check-token` with the user's email to check if a refresh token exists
2. If `authorized: false`, frontend should initiate the OAuth2 flow with Google
3. After successful authorization, frontend extracts the refresh token and sends it to `/gmail/save-token`
4. Backend stores the refresh token associated with the user's email
5. For future email sends, the backend uses the stored refresh token

## CSV Template Processing

The system supports dynamic content replacement in HTML templates using merge tags that correspond to CSV column headers.

### Example HTML Template:
```html
<h1>Hello #name!</h1>
<p>Thank you for your interest in our #product.</p>
<p>Your account: #email</p>
```

### Example CSV File:
```
email,name,product
user1@example.com,John,Premium Plan
user2@example.com,Jane,Basic Plan
```

### Result:
Each recipient will receive a personalized email with their specific data replacing the merge tags.

## Implementation Details

- The system uses Mongoose to store OAuth credentials with `user_email` as the unique key
- Nodemailer with Gmail OAuth2 is used for sending emails
- WebSockets provide real-time status updates during the email sending process
- Multer handles CSV file uploads
- CSV processing utility parses the recipient data and replaces merge tags in the HTML template

## Frontend Integration Example

```javascript
// Check if user is authorized
async function checkGmailAuthorization(userEmail) {
  const response = await fetch('/gmail/check-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_email: userEmail })
  });
  return await response.json();
}

// Save refresh token after OAuth flow
async function saveRefreshToken(userData) {
  const response = await fetch('/gmail/save-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return await response.json();
}

// Send email with template and CSV data
async function sendTemplatedEmail(formData) {
  try {
    // First make the POST request
    const response = await fetch('/gmail/send-email', {
      method: 'POST',
      body: formData // FormData object with user_email, subject, html_template, and csv_file
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to start email sending process');
    }
    
    // Then connect to WebSocket for real-time updates
    return new Promise((resolve, reject) => {
      const updates = [];
      // Make sure to use the correct server port (3000) for the WebSocket connection
      const ws = new WebSocket('ws://localhost:3000/api/email-status');
      
      ws.onopen = () => {
        console.log('WebSocket connection established');
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Email status update:', data);
        updates.push(data);
        
        if (data.status === 'complete') {
          ws.close();
          resolve(updates);
        } else if (data.status === 'error') {
          ws.close();
          reject(new Error(data.error));
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket connection closed');
      };
    });
  } catch (error) {
    console.error('Error sending emails:', error);
    throw error;
  }
}
```