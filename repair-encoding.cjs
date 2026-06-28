const fs = require('fs');
const path = require('path');
const files = [
  'frontend/index.html',
  'frontend/style.css',
  'frontend/script.js',
  'frontend/blackline-config.js',
  'frontend/firebase-data.js',
  'frontend/firebase-config.js'
];
const replacements = [
  ['ÃÂ', 'Ã'],
  ['ÃÂ', 'Ã'],
  ['Ã', 'Ã'],
  ['Ã¡', 'á'],
  ['Ã©', 'é'],
  ['Ã­', 'í'],
  ['Ã³', 'ó'],
  ['Ãº', 'ú'],
  ['Ãª', 'ê'],
  ['Ã´', 'ô'],
  ['Ã¶', 'ö'],
  ['Ã¼', 'ü'],
  ['Ã£', 'ã'],
  ['Ã§', 'ç'],
  ['Ã±', 'ñ'],
  ['Ã€', 'À'],
  ['Ã‰', 'É'],
  ['ÃŒ', 'Í'],
  ['Ã“', 'Ó'],
  ['Ãš', 'Ú'],
  ['Ã‘', 'Á'],
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
  ['Ã‡', 'Ç'],
  ['Ãƒ', 'Ã'],
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
for (const rel of files) {
  const full = path.resolve(rel);
  let text = fs.readFileSync(full, 'utf8');
  for (const [from, to] of replacements) {
    text = text.split(from).join(to);
  }
  fs.writeFileSync(full, text, 'utf8');
  console.log(`Repaired ${rel}`);
}
