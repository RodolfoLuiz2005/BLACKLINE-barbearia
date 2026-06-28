const fs = require('fs');
const path = require('path');

const root = process.cwd();
const files = [
  'frontend/index.html',
  'frontend/style.css',
  'frontend/script.js',
  'frontend/blackline-config.js',
  'frontend/firebase-data.js',
  'frontend/firebase-config.js'
];

const replacements = [
  ['Ã§', 'ç'],
  ['Ã£', 'ã'],
  ['Ã¡', 'á'],
  ['Ã©', 'é'],
  ['Ã­', 'í'],
  ['Ã³', 'ó'],
  ['Ãº', 'ú'],
  ['Ãª', 'ê'],
  ['Ã´', 'ô'],
  ['Ã¶', 'ö'],
  ['Ã¼', 'ü'],
  ['Ã ', 'à'],
  ['Ã¨', 'è'],
  ['Ã¬', 'ì'],
  ['Ã²', 'ò'],
  ['Ã¹', 'ù'],
  ['Ã±', 'ñ'],
  ['Ã‡', 'Ç'],
  ['Ãƒ', 'Ã'],
  ['Ã‰', 'É'],
  ['Ã“', 'Ó'],
  ['Ãš', 'Ú'],
  ['Ã‘', 'Á'],
  ['ÃŒ', 'Í'],
  ['Ã€', 'À'],
  ['Ãˆ', 'È'],
  ['ÃŠ', 'Ê'],
  ['Ã‹', 'Ë'],
  ['ÃŽ', 'Î'],
  ['Ã', 'Ï'],
  ['Ã”', 'Ô'],
  ['Ã•', 'Õ'],
  ['Ã–', 'Ö'],
  ['Ã™', 'Ù'],
  ['Ã›', 'Û'],
  ['Ãœ', 'Ü'],
  ['ÃŸ', 'ß'],
  ['Â ', ' '],
  ['Â', ''],
  ['â€¢', '•'],
  ['â€™', '’'],
  ['â€“', '–'],
  ['â€œ', '“'],
  ['â€', '”'],
  ['â€¦', '…'],
  ['�', ''],
  ['â€', '“']
];

for (const relativePath of files) {
  const filePath = path.join(root, relativePath);
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [from, to] of replacements) {
    content = content.split(from).join(to);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed ${relativePath}`);
}
