const FIELD_MAPPINGS = [
  { key: 'customer_id', label: 'Customer ID', recordKey: 'customer_id' },
  { key: 'name', label: 'Customer name', recordKey: 'name_1' },
  { key: 'date_of_birth', label: 'Date of birth', recordKey: 'date_of_birth' },
  { key: 'monthly_income', label: 'Monthly income', recordKey: 'monthly_income' },
  { key: 'employment_type', label: 'Employment type', recordKey: 'employment_type' },
  { key: 'nationality', label: 'Nationality', recordKey: 'nationality' },
  { key: 'residence', label: 'Residence', recordKey: 'residence' }
];

function normalizeValue(value) {
  if (typeof value === 'number') return String(value);
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildEvidenceReview({
  extractedCustomer = {},
  customerRecord,
  fileName,
  ocrUsed,
  missingInformation = [],
  attentionFlags = []
}) {
  const comparisons = FIELD_MAPPINGS
    .filter(({ key }) => extractedCustomer[key] !== undefined && extractedCustomer[key] !== null && extractedCustomer[key] !== '')
    .map(({ key, label, recordKey }) => {
      const extractedValue = extractedCustomer[key];
      const recordValue = customerRecord?.[recordKey];
      const hasRecordValue = recordValue !== undefined && recordValue !== null && recordValue !== '';
      const status = !customerRecord
        ? 'CUSTOMER_NOT_AVAILABLE'
        : !hasRecordValue
          ? 'NOT_IN_RECORD'
          : normalizeValue(extractedValue) === normalizeValue(recordValue)
            ? 'MATCH'
            : 'MISMATCH';

      return {
        field: key,
        label,
        extractedValue,
        customerRecordValue: hasRecordValue ? recordValue : null,
        status,
        sources: {
          extracted: `Uploaded document: ${fileName}`,
          customerRecord: customerRecord ? 'Customer profile' : null
        }
      };
    });

  const verificationActions = [];
  for (const comparison of comparisons) {
    if (comparison.status === 'MISMATCH') {
      verificationActions.push(
        `Confirm ${comparison.label.toLowerCase()} using the original document and an authoritative customer record before changing profile data.`
      );
    } else if (comparison.status === 'NOT_IN_RECORD') {
      verificationActions.push(
        `Review the extracted ${comparison.label.toLowerCase()} and update the customer profile only after independent verification.`
      );
    } else if (comparison.status === 'CUSTOMER_NOT_AVAILABLE') {
      verificationActions.push(
        `Select a customer profile to compare the extracted ${comparison.label.toLowerCase()} against existing records.`
      );
    }
  }

  for (const item of missingInformation) {
    verificationActions.push(`The extraction flagged missing information: ${item}. Request or verify it if needed for this case.`);
  }

  for (const flag of attentionFlags) {
    verificationActions.push(`Review the document attention flag: ${flag}`);
  }

  if (!customerRecord && comparisons.length === 0) {
    verificationActions.push('Select a customer profile to compare extracted facts with existing records.');
  } else if (customerRecord && comparisons.length === 0) {
    verificationActions.push('No comparable customer facts were extracted; verify the document and customer identity manually.');
  }

  if (verificationActions.length === 0) {
    verificationActions.push('No mismatches were found in the fields compared. Verify extracted facts against the original document before relying on them.');
  }

  const hasMismatch = comparisons.some(({ status }) => status === 'MISMATCH');
  const hasUnverified = comparisons.length === 0
    || comparisons.some(({ status }) => status !== 'MATCH')
    || missingInformation.length > 0
    || attentionFlags.length > 0;

  return {
    status: hasMismatch ? 'MISMATCHES_FOUND' : hasUnverified ? 'REVIEW_REQUIRED' : 'NO_MISMATCHES_FOUND',
    documentSource: fileName,
    extractionMethod: ocrUsed ? 'OCR plus AI extraction' : 'Text extraction plus AI extraction',
    evidenceNote: 'Values are AI-extracted from the uploaded document. This review does not provide page-level citations; verify each value against the original.',
    comparisons,
    verificationActions
  };
}

module.exports = { buildEvidenceReview };
