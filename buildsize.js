const fs = require('fs');
const entry = fs.statSync('dist/entry.zip');
console.info(`${entry.size} / 13312`);
console.info(`${13312 - entry.size} bytes left`);
