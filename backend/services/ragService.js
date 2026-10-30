const fs = require('fs');
const path = require('path');
const ProductPolicy = require('../models/ProductPolicy');

let cachedKnowledge = null;

// Policies are stored in MongoDB (productpolicies); the local files are a fallback.
async function loadKnowledgeBase() {
  if (cachedKnowledge) return cachedKnowledge;

  try {
    const policies = await ProductPolicy.find({}).lean();
    if (policies.length > 0) {
      cachedKnowledge = policies.map(p => ({ source: p.source, text: p.text }));
      return cachedKnowledge;
    }
  } catch (err) {
    console.warn('[RAG] Could not load policies from MongoDB, using local files:', err.message);
  }

  const knowledgeDir = path.join(__dirname, '../knowledge');
  if (!fs.existsSync(knowledgeDir)) return [];

  const files = fs.readdirSync(knowledgeDir);
  const knowledgeDocs = [];

  for (const file of files) {
    if (file.endsWith('.txt')) {
      const content = fs.readFileSync(path.join(knowledgeDir, file), 'utf-8');
      knowledgeDocs.push({
        source: file,
        text: content
      });
    }
  }
  cachedKnowledge = knowledgeDocs;
  return cachedKnowledge;
}

/**
 * Retrieve relevant context for a query from local knowledge files.
 */
const GENERIC_PRODUCT_WORDS = ['loan', 'account', 'policy', 'products', 'insurance'];

async function retrieveRelevantContext(query, topK = 4, productType = '') {
  const docs = await loadKnowledgeBase();
  if (docs.length === 0) {
    return "No relevant product information was found.";
  }

  // When the product is known, use its policy file(s) plus the shared document checklist.
  const productWords = (productType || '').toLowerCase().split(/[^a-z]+/)
    .filter(w => w.length > 2 && !GENERIC_PRODUCT_WORDS.includes(w));
  if (/insurance/i.test(productType)) productWords.push('insurance');
  if (productWords.length > 0) {
    const productDocs = docs.filter(doc => productWords.some(w => doc.source.toLowerCase().includes(w)));
    if (productDocs.length > 0) {
      const checklist = docs.filter(doc => doc.source === 'required-documents.txt' && !productDocs.includes(doc));
      return [...productDocs, ...checklist].map(c => `[Source: ${c.source}]\n${c.text}`).join('\n\n---\n\n');
    }
  }

  const queryLower = (query || '').toLowerCase();
  
  // Filter or prioritize docs containing query keywords, or include all policy docs if short
  const relevantDocs = docs.filter(doc => {
    const textLower = doc.text.toLowerCase();
    const filenameLower = doc.source.toLowerCase();
    return queryLower.split(' ').some(word => word.length > 3 && (textLower.includes(word) || filenameLower.includes(word)));
  });

  const selectedDocs = relevantDocs.length > 0 ? relevantDocs : docs;

  return selectedDocs.map(c => `[Source: ${c.source}]\n${c.text}`).join('\n\n---\n\n');
}

module.exports = {
  retrieveRelevantContext
};

