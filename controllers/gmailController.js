const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const { processTemplateWithCsv } = require("../utils/gmailOAuth");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const os = require("os");

// Configure multer for file uploads
const upload = multer({ dest: os.tmpdir() });

/**
 * Helper function to send email with OAuth error handling and token refresh
 * @param {Object} transport - Nodemailer transport
 * @param {Object} oauth2Client - OAuth2 client
 * @param {Object} mailOptions - Email options
 * @param {string} userEmail - User email for re-authentication
 * @returns {Promise} - Email sending result
 */
const sendEmailWithRetry = async (
  transport,
  oauth2Client,
  mailOptions,
  userEmail
) => {
  try {
    return await transport.sendMail(mailOptions);
  } catch (error) {
    // Check if it's an OAuth authentication error (401/403 or access token expiry)
    if (
      error.message.includes("invalid_grant") ||
      error.message.includes("AUTH XOAUTH2") ||
      error.code === "EAUTH" ||
      error.responseCode === 535 ||
      error.responseCode === 401 ||
      error.responseCode === 403
    ) {
      console.log(
        "Access token authentication error detected, attempting refresh:",
        error.message
      );

      try {
        // Attempt to refresh the access token
        const { credentials } = await oauth2Client.refreshAccessToken();
        console.log("Token refreshed successfully");

        // Update transport with new access token
        transport.set("auth", {
          type: "OAuth2",
          user: userEmail,
          clientId: oauth2Client._clientId,
          clientSecret: oauth2Client._clientSecret,
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token,
        });

        // Retry sending the email
        return await transport.sendMail(mailOptions);
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError.message);

        // Show the real Gmail error message in the WebSocket and thrown error
        const originalGmailError =
          error.message || "Unknown Gmail authentication error";
        let errorType = "TokenRefreshError";
        let actionRequired = "frontend_reauthorization";

        if (global.emailStatusWs) {
          global.emailStatusWs.send(
            JSON.stringify({
              status: "error",
              error: `Token refresh failed: ${refreshError.message}`,
              error_type: errorType,
              phase: "token_refresh",
              timestamp: new Date().toISOString(),
              message: `OAuth token refresh failed: ${refreshError.message}`,
              technical_details: {
                original_error: error.message,
                refresh_error: refreshError.message,
                response_code: error.responseCode,
                error_code: error.code,
                context: "Access token refresh failed during email sending",
              },
              action_required: actionRequired,
            })
          );
        }

        throw new Error(`Token refresh failed: ${refreshError.message}`);
      }
    }

    // Re-throw non-OAuth errors
    throw error;
  }
};

/**
 * Process CSV file upload for email sending
 */
exports.uploadRecipientList = upload.single("csv_file");

/**
 * Send email using Gmail API with CSV template processing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.sendEmail = async (req, res) => {
  try {
    // Get parameters including OAuth credentials
    const {
      user_email,
      subject,
      html_template,
      access_token,
      refresh_token,
      client_id,
      client_secret,
    } = req.body;

    // Validate parameters
    const missingParams = [];
    if (!user_email) missingParams.push("user_email");
    if (!subject) missingParams.push("subject");
    if (!html_template) missingParams.push("html_template");
    if (!access_token) missingParams.push("access_token");
    if (!refresh_token) missingParams.push("refresh_token");
    if (!client_id) missingParams.push("client_id");
    if (!client_secret) missingParams.push("client_secret"); // Client secret is required
    if (!req.file) missingParams.push("csv_file");

    if (missingParams.length > 0) {
      // Send validation error via WebSocket if available
      if (global.emailStatusWs) {
        global.emailStatusWs.send(
          JSON.stringify({
            status: "error",
            error: "Missing required parameters",
            error_type: "ValidationError",
            phase: "parameter_validation",
            missing_params: missingParams,
            timestamp: new Date().toISOString(),
            message:
              "Please provide all required OAuth credentials and CSV file.",
          })
        );
      }

      return res.status(400).json({
        status: "error",
        error: "Missing required parameters",
        missing: missingParams,
        required: [
          "user_email",
          "subject",
          "html_template",
          "access_token",
          "refresh_token",
          "client_id",
          "client_secret", // Added to required list
          "csv_file (as file upload)",
        ],
        description:
          "All required parameters including access_token, refresh_token, and client_secret must be provided for email sending.",
      });
    }

    // Validate OAuth credential formats and token details
    const credentialErrors = [];
    if (typeof access_token !== "string" || access_token.trim().length === 0) {
      credentialErrors.push("access_token must be a non-empty string");
    } else {
      // Check if access token looks valid (should start with 'ya29.' for Google)
      if (!access_token.startsWith("ya29.")) {
        credentialErrors.push(
          "access_token format appears invalid (should start with ya29.)"
        );
      }
    }
    if (
      typeof client_id !== "string" ||
      !client_id.includes(".googleusercontent.com")
    ) {
      credentialErrors.push("client_id must be a valid Google OAuth client ID");
    }
    if (
      typeof client_secret !== "string" ||
      client_secret.trim().length === 0
    ) {
      credentialErrors.push("client_secret must be a non-empty string");
    }
    if (
      typeof refresh_token !== "string" ||
      refresh_token.trim().length === 0
    ) {
      credentialErrors.push("refresh_token must be a non-empty string");
    }
    if (typeof user_email !== "string" || !user_email.includes("@")) {
      credentialErrors.push("user_email must be a valid email address");
    }

    if (credentialErrors.length > 0) {
      // Send credential validation error via WebSocket if available
      if (global.emailStatusWs) {
        global.emailStatusWs.send(
          JSON.stringify({
            status: "error",
            error: "Invalid OAuth credentials format",
            error_type: "CredentialValidationError",
            phase: "credential_validation",
            validation_errors: credentialErrors,
            timestamp: new Date().toISOString(),
            message:
              "Please check your OAuth credentials format and try again.",
          })
        );
      }

      return res.status(400).json({
        status: "error",
        error: "Invalid OAuth credentials format",
        validation_errors: credentialErrors,
        description: "OAuth credentials must be in the correct format.",
      });
    }

    // Read CSV file
    const csvData = fs.readFileSync(req.file.path, "utf8");

    // Process template with CSV data
    const emailList = processTemplateWithCsv(csvData, html_template);

    if (!emailList || emailList.length === 0) {
      return res.status(400).json({
        status: "error",
        error: "No valid recipients found in CSV",
        message:
          'The CSV file must contain at least one row with a valid email address in the "email" column.',
        csv_requirements: {
          required_columns: ["email"],
          format:
            'The first row should contain column headers, including "email". Each subsequent row represents one recipient.',
        },
      });
    }

    // Check if WebSocket is available
    if (!global.emailStatusWs) {
      console.error("WebSocket connection not available");
      console.warn(
        "Email sending will continue but real-time status updates will not be available"
      );
    }

    // Send initial success response to client
    res.status(200).json({
      status: "success",
      message: "Email sending process started",
      total: emailList.length,
      websocket_status: global.emailStatusWs ? "connected" : "unavailable",
    });

    // Process emails asynchronously
    const processingStartTime = Date.now();

    // Send initial status update via WebSocket if available
    if (global.emailStatusWs) {
      global.emailStatusWs.send(
        JSON.stringify({
          status: "initializing",
          message: "Email sending process starting",
          total: emailList.length,
          timestamp: new Date().toISOString(),
        })
      );
    }

    setTimeout(async () => {
      try {
        // Send credential validation status
        if (global.emailStatusWs) {
          global.emailStatusWs.send(
            JSON.stringify({
              status: "validating",
              message: "Validating OAuth credentials...",
              phase: "credential_validation",
              timestamp: new Date().toISOString(),
            })
          );
        }

        // Create OAuth2 client for proper token management
        const oauth2Client = new google.auth.OAuth2(
          client_id,
          client_secret,
          "urn:ietf:wg:oauth:2.0:oob" // or your redirect URI
        );

        // Set credentials
        oauth2Client.setCredentials({
          access_token: access_token,
          refresh_token: refresh_token,
        });

        // Verify and refresh token if needed before creating transport
        try {
          // Test the OAuth2 client by making a simple API call
          const gmail = google.gmail({ version: "v1", auth: oauth2Client });
          await gmail.users.getProfile({ userId: "me" });
          console.log("OAuth2 client verification successful");
        } catch (oauthError) {
          console.log(
            "OAuth2 verification failed, attempting token refresh:",
            oauthError.message
          );

          try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            oauth2Client.setCredentials(credentials);
            console.log("Token refreshed successfully");
          } catch (refreshError) {
            throw new Error(
              `OAuth2 token refresh failed: ${refreshError.message}`
            );
          }
        }

        // Send successful validation status
        if (global.emailStatusWs) {
          global.emailStatusWs.send(
            JSON.stringify({
              status: "validated",
              message: "OAuth credentials validated successfully",
              phase: "credential_validation",
              timestamp: new Date().toISOString(),
            })
          );
        }

        // Get the current access token (may have been refreshed)
        const currentCredentials = oauth2Client.credentials;

        // Diagnostic logging for OAuth configuration
        console.log("Creating Nodemailer transport with OAuth2 config:", {
          service: "gmail",
          auth_type: "OAuth2",
          user: user_email,
          clientId_present: !!client_id,
          clientSecret_present: !!client_secret,
          accessToken_present: !!currentCredentials.access_token,
          refreshToken_present: !!currentCredentials.refresh_token,
        });

        // Create nodemailer transport with current access token
        const transport = nodemailer.createTransport({
          service: "gmail",
          auth: {
            type: "OAuth2",
            user: user_email,
            clientId: client_id,
            clientSecret: client_secret,
            accessToken: currentCredentials.access_token,
            refreshToken: currentCredentials.refresh_token,
          },
        });

        // Test the transport configuration before sending emails
        try {
          console.log("Testing transport configuration...");
          await transport.verify();
          console.log("Transport verification successful");

          if (global.emailStatusWs) {
            global.emailStatusWs.send(
              JSON.stringify({
                status: "transport_verified",
                message: "Gmail OAuth transport verified successfully",
                phase: "transport_verification",
                timestamp: new Date().toISOString(),
              })
            );
          }
        } catch (verifyError) {
          console.error("Transport verification failed:", {
            error: verifyError.message,
            code: verifyError.code,
            responseCode: verifyError.responseCode,
            command: verifyError.command,
          });

          // Send detailed verification error
          if (global.emailStatusWs) {
            global.emailStatusWs.send(
              JSON.stringify({
                status: "error",
                error: `Transport verification failed: ${verifyError.message}`,
                error_type: "TransportVerificationError",
                phase: "transport_verification",
                timestamp: new Date().toISOString(),
                technical_details: {
                  error_code: verifyError.code,
                  response_code: verifyError.responseCode,
                  command: verifyError.command,
                  possible_causes: [
                    "Access token expired or invalid",
                    "Access token does not match the user_email",
                    "Missing Gmail send scope (https://www.googleapis.com/auth/gmail.send)",
                    "OAuth app not published and user not in test users list",
                    "Incorrect OAuth client configuration",
                    "Client secret missing or incorrect",
                  ],
                },
              })
            );
          }

          throw new Error(
            `Gmail OAuth verification failed: ${verifyError.message}. This usually indicates: 1) Access token expired/invalid, 2) Token doesn't match user_email, 3) Missing Gmail send scope, 4) OAuth app configuration issues, or 5) Missing/incorrect client secret.`
          );
        }

        // Send status update - starting
        if (global.emailStatusWs) {
          global.emailStatusWs.send(
            JSON.stringify({
              status: "starting",
              total: emailList.length,
            })
          );
        }

        // Send emails to each recipient
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < emailList.length; i++) {
          const { email, html } = emailList[i];

          try {
            // Send status update - current recipient
            if (global.emailStatusWs) {
              global.emailStatusWs.send(
                JSON.stringify({
                  status: "sending",
                  current: i + 1,
                  total: emailList.length,
                  recipient: email,
                })
              );
            }

            // Send email with access token error handling and retry capability
            await sendEmailWithRetry(
              transport,
              oauth2Client,
              {
                from: user_email,
                to: email,
                subject,
                html: html,
              },
              user_email
            );

            // Send success status
            if (global.emailStatusWs) {
              global.emailStatusWs.send(
                JSON.stringify({
                  status: "success",
                  recipient: email,
                  current: i + 1,
                  total: emailList.length,
                })
              );
            }

            successCount++;
          } catch (error) {
            console.error(`Error sending to ${email}:`, error);

            // Send detailed failure status
            if (global.emailStatusWs) {
              global.emailStatusWs.send(
                JSON.stringify({
                  status: "error",
                  recipient: email,
                  error: error.message,
                  error_type: error.name || "EmailDeliveryError",
                  error_code: error.code || "unknown",
                  current: i + 1,
                  total: emailList.length,
                  timestamp: new Date().toISOString(),
                  retry_recommended:
                    error.code === "ECONNRESET" || error.code === "ETIMEDOUT",
                })
              );
            }

            failureCount++;
          }

          // Small delay to prevent rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Clean up temp file
        fs.unlinkSync(req.file.path);

        // Send detailed completion status
        if (global.emailStatusWs) {
          global.emailStatusWs.send(
            JSON.stringify({
              status: "complete",
              successCount,
              failureCount,
              total: emailList.length,
              success_rate: `${(
                (successCount / emailList.length) *
                100
              ).toFixed(1)}%`,
              completion_time: new Date().toISOString(),
              processing_time_ms: Date.now() - processingStartTime,
            })
          );
        }
      } catch (error) {
        console.error("Error in email sending process:", error);

        // Send detailed error status
        if (global.emailStatusWs) {
          global.emailStatusWs.send(
            JSON.stringify({
              status: "error",
              error: error.message,
              error_type: error.name || "UnknownError",
              phase: "email_processing",
              timestamp: new Date().toISOString(),
            })
          );
        }

        // Log detailed error for server-side debugging
        console.error("Email processing error details:", {
          error_type: error.name,
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        });

        // Clean up temp file if it exists
        if (req.file && req.file.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            console.error("Error deleting temp file:", unlinkError);
          }
        }
      }
    }, 100); // Small delay to ensure the response is sent before processing starts
  } catch (error) {
    console.error("Error sending emails:", error);

    // Clean up temp file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error("Error deleting temp file:", unlinkError);
      }
    }

    return res.status(500).json({
      status: "error",
      error: error.message,
      error_type: error.name || "UnknownError",
      error_code: error.code || "unknown",
      phase: "request_processing",
      timestamp: new Date().toISOString(),
      request_validation: {
        body_params_received: Object.keys(req.body),
        file_received: req.file ? true : false,
      },
    });
  }
};
