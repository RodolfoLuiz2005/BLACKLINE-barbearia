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
for (const relativePath of files) {
  const fullPath = path.resolve(relativePath);
  const bytes = fs.readFileSync(fullPath);
  const text = bytes.toString('latin1');
  fs.writeFileSync(fullPath, text, 'utf8');
  console.log(`Converted ${relativePath}`);
}
