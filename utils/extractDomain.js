function extractDomain(smtpId) {
  const domain = smtpId.split("@")[1].split(">")[0];
  return domain;
}

module.exports = {
  extractDomain,
};
