const fs = require('fs');
const path = require('path');

const htmlContent = fs.readFileSync(path.join(__dirname, 'dataset', 'banking-ai-rm-platform.html'), 'utf-8');

const styleRegex = /<style>([\s\S]*?)<\/style>/;
const scriptRegex = /<script>([\s\S]*?)<\/script>/;

const styleMatch = htmlContent.match(styleRegex);
if (styleMatch) {
  fs.writeFileSync(path.join(__dirname, 'frontend', 'src', 'index.css'), styleMatch[1]);
  console.log('Extracted CSS.');
}

const scriptMatch = htmlContent.match(scriptRegex);
if (scriptMatch) {
  fs.writeFileSync(path.join(__dirname, 'extracted_script.js'), scriptMatch[1]);
  console.log('Extracted JS.');
}

// Extract body inner content manually (everything between <body> and </body>)
const bodyRegex = /<body>([\s\S]*?)<\/body>/;
const bodyMatch = htmlContent.match(bodyRegex);
if (bodyMatch) {
  fs.writeFileSync(path.join(__dirname, 'extracted_body.html'), bodyMatch[1]);
  console.log('Extracted Body.');
}
