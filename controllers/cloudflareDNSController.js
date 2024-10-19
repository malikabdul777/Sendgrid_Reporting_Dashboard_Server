const axios = require("axios");
const Domain = require("../models/cloudflareDomain.model");
const DNSRecord = require("../models/cloudflareDNS.model");

// Controller for adding DNS record
exports.addDNSRecord = async (req, res) => {
  const { domainName, type, name, content, ttl, priority, proxied } = req.body;

  if (!domainName || !type || !name || !content) {
    return res.status(400).json({
      success: false,
      message: "Domain name, record type, name, and content are required",
    });
  }

  try {
    // Extract the main domain from the provided domain name
    const mainDomain = domainName.includes(".")
      ? domainName.split(".").slice(-2).join(".") // Get last two segments
      : domainName; // In case it's a single label

    // Find the domain by its name in your MongoDB
    const domain = await Domain.findOne({ domainName: mainDomain });

    if (!domain) {
      return res
        .status(404)
        .json({ success: false, message: "Domain not found" });
    }

    // API call to add DNS record to Cloudflare
    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/zones/${domain.zoneId}/dns_records`,
      {
        type, // DNS record type (e.g., A, CNAME, TXT)
        name, // Subdomain or domain (e.g., www, or root domain @)
        content, // IP address or target (e.g., 192.168.1.1 or CNAME target)
        ttl: ttl || 1, // TTL (default to 120 seconds if not provided)
        priority: priority || 0, // Priority (default to 0 if not provided)
        proxied: proxied || false, // Whether the record is proxied (default to false if not provided)
      },
      {
        headers: {
          "X-Auth-Email": process.env.CLOUDFLARE_EMAIL,
          "X-Auth-Key": process.env.CLOUDFLARE_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    // Save the DNS record to MongoDB
    const newDNSRecord = new DNSRecord({
      domainName,
      type,
      name,
      content,
      ttl: ttl || 1,
      priority: priority || 0,
      proxied: proxied || false,
    });

    await newDNSRecord.save();

    res.status(200).json({
      success: true,
      message: `DNS record added to Cloudflare and saved in the database for domain ${domainName}.`,
      data: response.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding DNS record to Cloudflare.",
      error: error.response ? error.response.data : error.message,
    });
  }
};
