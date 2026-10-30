const tesseract = require('tesseract.js');

/**
 * Extracts text from an image using Tesseract OCR.
 * @param {string} filePath - Absolute path to the image file
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromImage(filePath) {
  try {
    const { data: { text } } = await tesseract.recognize(filePath, 'eng');
    if (!text || text.trim().length === 0) {
      throw new Error('No readable text was found in this document.');
    }
    return text;
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('Unable to read the scanned document. Please upload a clearer document.');
  }
}

module.exports = {
  extractTextFromImage
};
