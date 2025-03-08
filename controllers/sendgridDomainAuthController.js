const axios = require("axios");
const SGAuthenticatedDomain = require("../models/SGAuthenticatedDomain.model");

exports.authenticateDomain = async (req, res) => {
  const { domainName, selectedAccount } = req.body;

  if (!domainName) {
    return res
      .status(400)
      .json({ success: false, message: "Domain name is required." });
  }

  if (!selectedAccount || ![1, 2].includes(Number(selectedAccount))) {
    return res.status(400).json({
      success: false,
      message: "Valid selected account (1 or 2) is required.",
    });
  }

  const apiKey =
    selectedAccount === 1
      ? process.env.SENDGRID_API_KEY
      : process.env.SENDGRID2_API_KEY;

  try {
    // API call to authenticate the domain
    const response = await axios.post(
      "https://api.sendgrid.com/v3/whitelabel/domains",
      {
        domain: domainName,
        automatic_security: true,
        smtp_security: true,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Log the response data for debugging
    console.log("SendGrid API response:", response.data);

    // Extract domain ID from response
    const domainId = response.data.id || null;

    // Check if domain ID is present
    if (!domainId) {
      return res.status(500).json({
        success: false,
        message: "Domain ID not found in SendGrid response.",
      });
    }

    // Save the authenticated domain details in MongoDB
    try {
      const authenticatedDomain = new SGAuthenticatedDomain({
        domainName,
        domainId,
      });

      await authenticatedDomain.save();
      console.log("Domain saved successfully in MongoDB.");

      res.status(200).json({
        success: true,
        message: `Domain ${domainName} authenticated and saved successfully.`,
        data: response.data,
      });
    } catch (saveError) {
      console.error("Error saving domain to MongoDB:", saveError.message);
      return res.status(500).json({
        success: false,
        message: "Error saving domain to MongoDB.",
      });
    }
  } catch (error) {
    console.error("Error authenticating domain:", error.message);
    res.status(500).json({
      success: false,
      message: "Error authenticating domain.",
    });
  }
};

exports.checkDomainAuthenticationStatus = async (req, res) => {
  const { domainName, selectedAccount } = req.body;

  if (!domainName) {
    return res
      .status(400)
      .json({ success: false, message: "Domain name is required." });
  }

  if (!selectedAccount || ![1, 2].includes(Number(selectedAccount))) {
    return res.status(400).json({
      success: false,
      message: "Valid selected account (1 or 2) is required.",
    });
  }

  const apiKey =
    selectedAccount === 1
      ? process.env.SENDGRID_API_KEY
      : process.env.SENDGRID2_API_KEY;

  try {
    // Find the domain in SGAuthenticatedDomains collection
    const domainRecord = await SGAuthenticatedDomain.findOne({ domainName });

    if (!domainRecord) {
      return res
        .status(404)
        .json({ success: false, message: "Domain not found." });
    }

    const domainId = domainRecord.domainId; // Assuming domainId is stored in the document

    // Send a POST request to validate the domain
    const response = await axios.post(
      `https://api.sendgrid.com/v3/whitelabel/domains/${domainId}/validate`,
      {},
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json({
      success: true,
      message: `Domain validation initiated successfully.`,
      data: response.data,
    });
  } catch (error) {
    // console.error(
    //   "Error validating domain:",
    //   error.response ? error.response.data : error.message
    // );
    res
      .status(500)
      .json({ success: false, message: "Error validating domain." });
  }
};

exports.senderAuth = async (req, res) => {
  const { nickname, from_email, reply_to, selectedAccount } = req.body;

  // Validate required fields
  if (!nickname || !from_email || !reply_to) {
    return res.status(400).json({
      success: false,
      message: "nickname, from_email, and reply_to are required fields.",
    });
  }

  if (!selectedAccount || ![1, 2].includes(Number(selectedAccount))) {
    return res.status(400).json({
      success: false,
      message: "Valid selected account (1 or 2) is required.",
    });
  }

  const apiKey =
    selectedAccount === 1
      ? process.env.SENDGRID_API_KEY
      : process.env.SENDGRID2_API_KEY;

  try {
    const data = {
      nickname,
      from_email,
      reply_to,
    };

    const response = await axios.post(
      "https://api.sendgrid.com/v3/verified_senders",
      data,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Sender authenticated successfully",
      data: response.data,
    });
  } catch (error) {
    console.error("Error authenticating sender:", error.message);
    res.status(500).json({
      success: false,
      message: "Error authenticating sender",
      error: error.response?.data || error.message,
    });
  }
};
