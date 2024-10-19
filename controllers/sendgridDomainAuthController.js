const axios = require("axios");

exports.authenticateDomain = async (req, res) => {
  const { domainName } = req.body;

  if (!domainName) {
    return res
      .status(400)
      .json({ success: false, message: "Domain name is required." });
  }

  try {
    // Your authentication logic here, e.g., using axios to make the API call
    const response = await axios.post(
      "https://api.sendgrid.com/v3/whitelabel/domains",
      {
        domain: domainName,
        automatic_security: true,
        smtp_security: true,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json({
      success: true,
      message: `Domain ${domainName} authenticated successfully.`,
      data: response.data,
    });
  } catch (error) {
    console.error("Error authenticating domain:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Error authenticating domain." });
  }
};
