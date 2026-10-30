const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { extractTextFromImage } = require('./ocrService');

/**
 * Normalizes text to remove excessive whitespace and noise, but preserves numbers, currencies, dates.
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // Collapse excessive newlines
    .trim();
}

/**
 * Parses a document and returns its extracted text.
 * @param {Object} file - The multer file object
 * @returns {Promise<Object>} { text, sourceType, ocrUsed }
 */
async function processDocument(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  let rawText = '';
  let ocrUsed = false;
  let sourceType = ext.replace('.', '');

  try {
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(file.path);
      const data = await pdfParse(dataBuffer);
      rawText = data.text;
      
      // If PDF has no extractable text, we would normally fall back to OCR.
      // But pdf-parse doesn't OCR images inside PDFs. For this project, if text is empty,
      // we reject or try OCR if it's an image. However, Tesseract.js handles images, not PDFs natively without conversion.
      // For simplicity in this Node environment, if a PDF is completely empty of text, we'll return an error 
      // (or we could tell the user we couldn't read it).
      if (!rawText || rawText.trim().length === 0) {
        throw new Error('No readable text was found in this document.');
      }
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: file.path });
      rawText = result.value;
      if (!rawText || rawText.trim().length === 0) {
        throw new Error('No readable text was found in this document.');
      }
    } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      rawText = await extractTextFromImage(file.path);
      ocrUsed = true;
    } else {
      throw new Error('Unsupported document type. Please upload PDF, DOCX, JPG, JPEG or PNG.');
    }

    const text = normalizeText(rawText);
    
    if (!text) {
      throw new Error('No readable text was found in this document.');
    }

    return {
      text,
      sourceType,
      ocrUsed
    };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  processDocument
};
