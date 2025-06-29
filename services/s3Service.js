const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Configure AWS SDK v3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

/**
 * Upload a redirect object to S3 with redirect metadata
 * @param {string} shortCode - The short code (filename without extension)
 * @param {string} targetURL - The URL to redirect to
 * @returns {Promise<Object>} - S3 upload result
 */
const uploadRedirectObject = async (shortCode, targetURL) => {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `redirects_${shortCode}`,
      Body: '', // Empty content
      ContentType: 'text/plain',
      Metadata: {
        'x-amz-website-redirect-location': targetURL
      },
      WebsiteRedirectLocation: targetURL // This is the key for S3 website redirects
    });

    const result = await s3Client.send(command);
    console.log(`Successfully uploaded redirect object: ${shortCode} -> ${targetURL}`);
    return result;
  } catch (error) {
    console.error('Error uploading redirect object:', error);
    throw error;
  }
};

/**
 * Delete a redirect object from S3
 * @param {string} shortCode - The short code (filename without extension)
 * @returns {Promise<Object>} - S3 delete result
 */
const deleteRedirectObject = async (shortCode) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `redirects_${shortCode}`
    });

    const result = await s3Client.send(command);
    console.log(`Successfully deleted redirect object: ${shortCode}`);
    return result;
  } catch (error) {
    console.error('Error deleting redirect object:', error);
    throw error;
  }
};

/**
 * Update a redirect object in S3 with new target URL
 * @param {string} shortCode - The short code (filename without extension)
 * @param {string} newTargetURL - The new URL to redirect to
 * @returns {Promise<Object>} - S3 upload result
 */
const updateRedirectObject = async (shortCode, newTargetURL) => {
  try {
    // S3 doesn't have an update operation, so we delete and recreate
    await deleteRedirectObject(shortCode);
    return await uploadRedirectObject(shortCode, newTargetURL);
  } catch (error) {
    console.error('Error updating redirect object:', error);
    throw error;
  }
};

module.exports = {
  uploadRedirectObject,
  deleteRedirectObject,
  updateRedirectObject
};