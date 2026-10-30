const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Customer = require('../models/Customer');
const { processDocument } = require('../services/documentService');
const { extractDocumentData } = require('../services/extractionService');
const Analysis = require('../models/Analysis');
const { buildEvidenceReview } = require('../services/evidenceReview');
const { CUSTOMER_ID_PATTERN } = require('../middleware/validate');

const removeFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error('Failed to delete temp file:', err.message);
  }
};

// Runs multer and turns its errors (size, type, field name) into JSON 400s.
const receiveDocument = (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (!err) return next();
    let message = err.message || 'Upload failed.';
    if (err instanceof multer.MulterError) {
      message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Document exceeds the maximum allowed size of 5 MB.'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Upload the file in the "document" field.'
          : message;
    }
    return res.status(400).json({ success: false, message });
  });
};

// Setup multer for temporary uploads
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File validation
const fileFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.docx', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported document type. Please upload PDF, DOCX, JPG, JPEG or PNG.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post('/', receiveDocument, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document uploaded.' });
    }
    console.log(`[G3] Document received: ${req.file.originalname}`);

    const customerId = typeof req.body.customerId === 'string' ? req.body.customerId.trim() : '';
    if (customerId && !CUSTOMER_ID_PATTERN.test(customerId)) {
      removeFile(req.file.path);
      return res.status(400).json({ success: false, message: 'Invalid customer ID. Customer IDs are numeric.' });
    }
    let textInfo;

    try {
      textInfo = await processDocument(req.file);
    } catch (docError) {
      // Clean up file if text extraction fails
      removeFile(req.file.path);
      return res.status(400).json({ success: false, message: docError.message });
    }

    let extractionResult;
    try {
      extractionResult = await extractDocumentData(textInfo.text);
    } catch (aiError) {
      // Clean up file
      removeFile(req.file.path);
      return res.status(500).json({ success: false, message: aiError.message });
    }

    // Clean up file after successful extraction
    removeFile(req.file.path);

    // Debugging logs
    console.log(`[G3] OCR text length: ${textInfo.text ? textInfo.text.length : 0}`);
    console.log(`[G3] Document type: ${extractionResult.document_type}`);
    console.log(`[G3] Extracted customer ID: ${extractionResult.customer?.customer_id}`);
    console.log(`[G3] Extracted customer name: ${extractionResult.customer?.name}`);
    console.log(`[G3] Extracted DOB: ${extractionResult.customer?.date_of_birth}`);
    console.log(`[G3] Extracted monthly income: ${extractionResult.customer?.monthly_income}`);
    console.log(`[G3] Extracted dates: ${JSON.stringify(extractionResult.dates || [])}`);
    console.log(`[G3] Gemini extraction completed`);

    // Customer Matching Logic
    let customerMatch = null;
    let dbCustomer = null;
    if (customerId) {
      dbCustomer = await Customer.findOne({ customer_id: customerId });
      if (dbCustomer) {
        const docCustomerId = extractionResult.customer?.customer_id;
        if (docCustomerId && docCustomerId.toString() === customerId.toString()) {
          customerMatch = { status: 'MATCHED', message: 'Confirmed', document_customer_id: docCustomerId, database_customer_id: customerId };
        } else {
          customerMatch = {
            status: 'REVIEW_REQUIRED',
            message: docCustomerId ? 'Document and selected customer IDs differ.' : 'No customer ID was extracted; confirm the document belongs to the selected customer.',
            document_customer_id: docCustomerId || null,
            database_customer_id: customerId
          };
        }
      } else {
        customerMatch = { status: 'NOT_AVAILABLE', message: 'Customer ID not found in database' };
      }
    }

    console.log(`[G3] Customer match status: ${customerMatch ? customerMatch.status : 'N/A'}`);

    extractionResult.customer_match = customerMatch;
    const evidenceReview = buildEvidenceReview({
      extractedCustomer: extractionResult.customer || {},
      customerRecord: dbCustomer,
      fileName: req.file.originalname,
      ocrUsed: textInfo.ocrUsed,
      missingInformation: extractionResult.missing_information || [],
      attentionFlags: extractionResult.attention_flags || []
    });

    const finalResult = {
      success: true,
      document: {
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        ocrUsed: textInfo.ocrUsed
      },
      customerMatch,
      evidenceReview,
      extractedData: extractionResult,
      summary: extractionResult.summary
    };

    // Save Analysis History
    try {
      await Analysis.create({
        analysisType: 'G3_DOCUMENT_SUMMARY',
        customerId: customerId || 'UNKNOWN',
        customerName: extractionResult.customer?.name || 'Unknown',
        status: 'COMPLETED',
        summary: `Document processed: ${req.file.originalname} as ${extractionResult.document_type || 'Unknown'}`,
        result: {
          document: finalResult.document,
          customerMatch,
          evidenceReview,
          extractedData: finalResult.extractedData,
          summary: finalResult.summary
        }
      });
    } catch (e) {
      console.error("[G3] Failed to save analysis history", e);
    }
    
    console.log(`[G3] Analysis completed for document: ${req.file.originalname}`);

    return res.json(finalResult);
  } catch (error) {
    console.error("G3 Route Error:", error);
    // Attempt cleanup if crashed unexpectedly
    if (req.file) removeFile(req.file.path);
    // Handle multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Document exceeds the maximum allowed size.' });
      }
    }
    res.status(500).json({ success: false, message: error.message || 'An internal server error occurred.' });
  }
});

module.exports = router;
