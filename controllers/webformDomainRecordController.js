const WebformDomainRecord = require("../models/webformDomainRecords.model");

// Controller to store the submitted form data in MongoDB
exports.storeWebformDomainRecord = async (req, res) => {
  const { webformId, dataName, domainsList, domainAddedOnDate } = req.body;

  console.log(req.body);

  if (!webformId || !dataName || !domainsList || !domainAddedOnDate) {
    return res.status(400).json({
      success: false,
      message: "All fields are required.",
    });
  }

  try {
    // Create a new record for the form submission
    const newRecord = new WebformDomainRecord({
      webformId,
      dataName,
      domainsList,
      domainAddedOnDate,
    });

    // Save the record in the MongoDB collection
    await newRecord.save();

    res.status(201).json({
      success: true,
      message: "Webform domain record saved successfully.",
      data: newRecord,
    });
  } catch (error) {
    console.error("Error storing webform domain record:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while storing the record.",
    });
  }
};

// Controller to check which webform each domain belongs to
exports.checkWebformDomains = async (req, res) => {
  const { domainData } = req.body; // domainData is the string of domains from the client
  const domainEntries = domainData.split("\n\n").map((entry) => entry.trim());

  const results = [];

  for (const domainEntry of domainEntries) {
    // Extract the domain from the entry (assuming it is in the form of domain: number)
    const [domain, numberStr] = domainEntry
      .split(":")
      .map((entry) => entry.trim());
    const number = parseInt(numberStr, 10) || 0; // Use 0 if the number is invalid

    if (!domain) continue; // Skip if domain is not present

    try {
      const record = await WebformDomainRecord.findOne({
        domainsList: domain, // Search within the domainsList array
      });

      if (record) {
        results.push({
          webformId: record.webformId,
          dataName: record.dataName,
          totalBlocks: number, // Use the number from the input
          domainList: record.domainsList, // This gives you the list of domains associated with the webform
        });
      } else {
        // console.log(`No record found for domain: ${domain}`);
      }
    } catch (error) {
      //   console.error(`Error finding record for domain: ${domain}`, error);
      return res.status(500).json({
        success: false,
        message: `Error retrieving data for ${domain}`,
      });
    }
  }

  // Aggregate results by webformId
  const aggregatedResults = results.reduce((acc, curr) => {
    const existing = acc.find((item) => item.webformId === curr.webformId);
    if (existing) {
      // If webformId already exists, aggregate the totalBlocks and domainList
      existing.totalBlocks += curr.totalBlocks;
      existing.domainList = Array.from(
        new Set([...existing.domainList, ...curr.domainList])
      ); // Combine and deduplicate
    } else {
      // Otherwise, push a new entry
      acc.push({
        webformId: curr.webformId,
        dataName: curr.dataName,
        totalBlocks: curr.totalBlocks,
        domainList: curr.domainList,
      });
    }
    return acc;
  }, []);

  res.status(200).json({
    success: true,
    data: aggregatedResults,
  });
};
