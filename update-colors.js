const fs = require('fs');
const path = require('path');
const dir = 'frontend/src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

const replacements = [
  [/('#4C51BF'|"#4C51BF")/gi, "'#8B4A3C'"],
  [/('#26326B'|"#26326B")/gi, "'#4A443D'"],
  [/('#1F2937'|"#1F2937")/gi, "'#2D2A26'"],
  [/('#9CA3AF'|"#9CA3AF")/gi, "'#A89F95'"],
  [/('#6B7280'|"#6B7280")/gi, "'#6B6259'"],
  [/('#5B5FEF'|"#5B5FEF")/gi, "'#C08552'"],
  [/('#161B33'|"#161B33")/gi, "'#2D2A26'"],
  [/('#F7F8FA'|"#F7F8FA")/gi, "'#FAF7F2'"],
  [/('#E5E7EB'|"#E5E7EB")/gi, "'#E8E0D5'"],
  [/rgba\(91,95,239,0\.15\)/gi, 'rgba(192,133,82,0.15)'],
  [/rgba\(76,81,191,0\.25\)/gi, 'rgba(139,74,60,0.25)'],
  [/('#1a237e'|"#1a237e")/gi, "'#4A443D'"], 
  [/('#e3f2fd'|"#e3f2fd")/gi, "'#F4EBE1'"], 
  [/('#1565c0'|"#1565c0")/gi, "'#C08552'"], 
  [/('#546e7a'|"#546e7a")/gi, "'#6B6259'"], 
  [/('#e8eaf6'|"#e8eaf6")/gi, "'#E8E0D5'"],
  [/('#e8f5e9'|"#e8f5e9")/gi, "'var(--risk-low-bg)'"],
  [/('#2e7d32'|"#2e7d32")/gi, "'var(--risk-low)'"],
  [/('#fff3e0'|"#fff3e0")/gi, "'var(--risk-medium-bg)'"],
  [/('#ef6c00'|"#ef6c00")/gi, "'var(--risk-medium)'"],
  [/('#f57c00'|"#f57c00")/gi, "'var(--risk-medium)'"],
  [/('#eceff1'|"#eceff1")/gi, "'var(--border)'"],
  [/('#c62828'|"#c62828")/gi, "'var(--risk-high)'"],
  [/('#ffebee'|"#ffebee")/gi, "'var(--risk-high-bg)'"],
  [/('#ef9a9a'|"#ef9a9a")/gi, "'rgba(166,58,40,0.3)'"], 
  [/('#d32f2f'|"#d32f2f")/gi, "'var(--risk-high)'"],
  [/(#4C51BF)/gi, "#8B4A3C"],
  [/(#26326B)/gi, "#4A443D"],
  [/(#1F2937)/gi, "#2D2A26"],
  [/(#9CA3AF)/gi, "#A89F95"],
  [/(#6B7280)/gi, "#6B6259"],
  [/(#5B5FEF)/gi, "#C08552"],
  [/(#161B33)/gi, "#2D2A26"],
  [/(#F7F8FA)/gi, "#FAF7F2"],
  [/(#E5E7EB)/gi, "#E8E0D5"]
];

for (let file of files) {
  let content = fs.readFileSync(path.join(dir, file), 'utf8');
  let original = content;
  for (let [regex, replacement] of replacements) {
    content = content.replace(regex, replacement);
  }
  if (content !== original) {
    fs.writeFileSync(path.join(dir, file), content);
    console.log('Updated ' + file);
  }
}
