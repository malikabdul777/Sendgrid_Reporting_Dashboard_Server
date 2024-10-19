// server.js or routes/domain.js
const axios = require("axios");
const cloudflareDomain = require("../models/cloudflareDomain.model");

const CLOUDFLARE_API_URL = "https://api.cloudflare.com/client/v4/zones";
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY; // Securely store in environment variables
const CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL; // Cloudflare account email

exports.addDomainToCloudflare = async (req, res) => {
  const { domainName } = req.body;

  if (!domainName) {
    return res
      .status(400)
      .json({ success: false, message: "Domain name is required" });
  }

  try {
    const response = await axios.post(
      "https://api.cloudflare.com/client/v4/zones",
      {
        name: domainName,
        account: {
          id: process.env.CLOUDFLARE_ACCOUNT_ID,
        },
        type: "full",
      },
      {
        headers: {
          "X-Auth-Email": process.env.CLOUDFLARE_EMAIL,
          "X-Auth-Key": process.env.CLOUDFLARE_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const zoneId = response.data.result.id;
    const createdOn = new Date();

    // Save the domain info in MongoDB
    const newDomain = new cloudflareDomain({
      domainName,
      zoneId,
      createdOn,
    });

    await newDomain.save();

    res.status(200).json({
      success: true,
      message: `Domain ${domainName} added to Cloudflare.`,
      data: response.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding domain to Cloudflare.",
      error: error.response ? error.response.data : error.message,
    });
  }
};

exports.checkDomainStatus = async (req, res) => {
  const { domainName } = req.body;

  try {
    const response = await axios.get(
      `https://api.cloudflare.com/client/v4/zones?name=${domainName}`,
      {
        headers: {
          "X-Auth-Email": process.env.CLOUDFLARE_EMAIL,
          "X-Auth-Key": process.env.CLOUDFLARE_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.success && response.data.result.length > 0) {
      const domainData = response.data.result[0];
      res.status(200).json({ success: true, isActive: true, domainData });
    } else {
      res
        .status(404)
        .json({ success: false, message: "Domain not found or not active." });
    }
  } catch (error) {
    console.error("Error checking domain status:", error);
    res
      .status(500)
      .json({ success: false, message: "Error checking domain status." });
  }
};
